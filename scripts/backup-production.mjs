import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  scryptSync,
} from "node:crypto";
import { gzipSync, gunzipSync } from "node:zlib";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import pg from "pg";

const { Pool } = pg;
const MAGIC = Buffer.from("SITE_MAGNIT_DB_BACKUP_V1\n", "utf8");
const SALT_BYTES = 16;
const IV_BYTES = 12;
const TAG_BYTES = 16;

const databaseUrl = process.env.DATABASE_URL;
const keyFile = process.env.BACKUP_KEY_FILE;
const backupDirectory =
  process.env.BACKUP_DIRECTORY ||
  "/app/storage/media/.private-db-backups";

if (!databaseUrl) throw new Error("DATABASE_URL is required");

function quoteIdentifier(value) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

function encrypt(payload, passphrase) {
  const salt = randomBytes(SALT_BYTES);
  const iv = randomBytes(IV_BYTES);
  const key = scryptSync(passphrase, salt, 32);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(payload), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([MAGIC, salt, iv, tag, encrypted]);
}

function decrypt(payload, passphrase) {
  if (!payload.subarray(0, MAGIC.length).equals(MAGIC)) {
    throw new Error("Unsupported backup format");
  }
  let offset = MAGIC.length;
  const salt = payload.subarray(offset, offset + SALT_BYTES);
  offset += SALT_BYTES;
  const iv = payload.subarray(offset, offset + IV_BYTES);
  offset += IV_BYTES;
  const tag = payload.subarray(offset, offset + TAG_BYTES);
  offset += TAG_BYTES;
  const key = scryptSync(passphrase, salt, 32);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([
    decipher.update(payload.subarray(offset)),
    decipher.final(),
  ]);
}

async function createSnapshot(client) {
  const tableResult = await client.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `);
  const columnResult = await client.query(`
    SELECT table_name, column_name, ordinal_position, data_type,
           udt_name, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema = 'public'
    ORDER BY table_name, ordinal_position
  `);
  const constraintResult = await client.query(`
    SELECT tc.table_name, tc.constraint_name, tc.constraint_type,
           kcu.column_name, kcu.ordinal_position
    FROM information_schema.table_constraints tc
    LEFT JOIN information_schema.key_column_usage kcu
      ON tc.constraint_catalog = kcu.constraint_catalog
     AND tc.constraint_schema = kcu.constraint_schema
     AND tc.constraint_name = kcu.constraint_name
    WHERE tc.table_schema = 'public'
    ORDER BY tc.table_name, tc.constraint_name, kcu.ordinal_position
  `);

  const tables = {};
  for (const { table_name: tableName } of tableResult.rows) {
    const rows = await client.query(
      `SELECT * FROM ${quoteIdentifier(tableName)}`,
    );
    tables[tableName] = rows.rows;
  }

  return {
    formatVersion: 1,
    createdAt: new Date().toISOString(),
    schema: {
      columns: columnResult.rows,
      constraints: constraintResult.rows,
    },
    tables,
  };
}

const passphrase = keyFile
  ? (await readFile(keyFile, "utf8")).trim()
  : databaseUrl;
if (!passphrase) throw new Error("Backup passphrase is empty");

const pool = new Pool({ connectionString: databaseUrl, max: 1 });
const client = await pool.connect();
let backupPath;

try {
  await client.query(
    "BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY",
  );
  const snapshot = await createSnapshot(client);
  await client.query("COMMIT");

  const plain = Buffer.from(JSON.stringify(snapshot), "utf8");
  const encrypted = encrypt(gzipSync(plain, { level: 9 }), passphrase);
  const timestamp = snapshot.createdAt.replaceAll(/[:.]/g, "-");
  const suffix = randomBytes(6).toString("hex");
  const filename = `site-magnit-${timestamp}-${suffix}.smdb`;
  backupPath = join(backupDirectory, filename);
  const temporaryPath = `${backupPath}.tmp`;

  await mkdir(backupDirectory, { recursive: true, mode: 0o700 });
  await writeFile(temporaryPath, encrypted, { mode: 0o600 });
  await rename(temporaryPath, backupPath);

  const verified = JSON.parse(
    gunzipSync(decrypt(await readFile(backupPath), passphrase)).toString(
      "utf8",
    ),
  );
  const tableCounts = Object.fromEntries(
    Object.entries(verified.tables).map(([tableName, rows]) => [
      tableName,
      rows.length,
    ]),
  );
  const totalRows = Object.values(tableCounts).reduce(
    (sum, count) => sum + count,
    0,
  );

  console.log(
    JSON.stringify({
      backup: basename(backupPath),
      sha256: createHash("sha256").update(encrypted).digest("hex"),
      encryptedBytes: encrypted.length,
      tableCounts,
      totalRows,
      verified: true,
    }),
  );
} catch (error) {
  await client.query("ROLLBACK").catch(() => undefined);
  if (backupPath) await unlink(`${backupPath}.tmp`).catch(() => undefined);
  throw error;
} finally {
  client.release();
  await pool.end();
  if (keyFile) await unlink(keyFile).catch(() => undefined);
}
