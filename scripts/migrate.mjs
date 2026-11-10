import { readdir, readFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const { Pool } = pg;
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const root = dirname(fileURLToPath(import.meta.url));
const migrationDirectory = join(root, "..", "db", "migrations");
const pool = new Pool({ connectionString: databaseUrl });
const client = await pool.connect();
try {
  await client.query("CREATE EXTENSION IF NOT EXISTS pgcrypto");
  await client.query("CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())");
  const files = (await readdir(migrationDirectory)).filter((file) => /^\d+_.+\.sql$/.test(file)).sort();
  for (const file of files) {
    const version = basename(file, ".sql");
    const applied = await client.query("SELECT 1 FROM schema_migrations WHERE version = $1", [version]);
    if (applied.rowCount) continue;
    await client.query("BEGIN");
    try {
      await client.query(await readFile(join(migrationDirectory, file), "utf8"));
      await client.query("INSERT INTO schema_migrations (version) VALUES ($1)", [version]);
      await client.query("COMMIT");
      console.log(`applied ${version}`);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  }
} finally {
  client.release();
  await pool.end();
}
