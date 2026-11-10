import { createReadStream, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { appendFile, mkdir, rename, rm, stat, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const root = dirname(fileURLToPath(import.meta.url));
const databaseUrl = process.env.DATABASE_URL?.trim() || "";
const backupRoot = resolve(process.env.BACKUP_STORAGE_DIR || join(root, "..", "storage", "backups"));
const mediaDirectory = resolve(process.env.MEDIA_STORAGE_DIR || join(root, "..", "storage", "media"));
const timestamp = new Date().toISOString().replace(/[.:]/g, "-");
const backupName = timestamp;
const workDirectory = join(backupRoot, `.tmp-${backupName}-${process.pid}`);
const finalDirectory = join(backupRoot, backupName);
const journalPath = join(backupRoot, "backup-journal.jsonl");
const pgDumpPath = process.env.PG_DUMP_BIN?.trim()
  || (existsSync("/opt/homebrew/opt/postgresql@16/bin/pg_dump") ? "/opt/homebrew/opt/postgresql@16/bin/pg_dump" : "pg_dump");

function databaseArguments(url, outputPath) {
  const parsed = new URL(url);
  const databaseName = decodeURIComponent(parsed.pathname.replace(/^\/+/, ""));
  if (!databaseName) throw new Error("DATABASE_URL must include a database name");
  const args = ["--format=custom", "--no-owner", "--file", outputPath];
  if (parsed.hostname) args.push("--host", parsed.hostname);
  if (parsed.port) args.push("--port", parsed.port);
  if (parsed.username) args.push("--username", decodeURIComponent(parsed.username));
  args.push("--dbname", databaseName);
  return { args, password: parsed.password ? decodeURIComponent(parsed.password) : "" };
}

function sha256(filePath) {
  return new Promise((resolveHash, reject) => {
    const hash = createHash("sha256");
    const stream = createReadStream(filePath);
    stream.on("error", reject);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolveHash(hash.digest("hex")));
  });
}

async function fileManifest(filePath) {
  const details = await stat(filePath);
  return { file: basename(filePath), bytes: details.size, sha256: await sha256(filePath) };
}

async function notifyFailure(error) {
  const webhook = process.env.BACKUP_NOTIFY_WEBHOOK_URL?.trim() || process.env.NOTIFICATION_WEBHOOK_URL?.trim();
  if (!webhook) return;
  try {
    await fetch(webhook, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ event: "site-magnit-backup-failed", timestamp, error: error instanceof Error ? error.message : String(error) }),
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    // The backup failure remains in the local journal when notification delivery also fails.
  }
}

async function appendJournal(entry) {
  await mkdir(backupRoot, { recursive: true });
  await appendFile(journalPath, `${JSON.stringify(entry)}\n`);
}

if (!databaseUrl) {
  console.error("DATABASE_URL is required for a PostgreSQL backup");
  process.exit(1);
}

try {
  await mkdir(workDirectory, { recursive: true });
  await mkdir(mediaDirectory, { recursive: true });
  const databaseDump = join(workDirectory, "postgres.dump");
  const mediaArchive = join(workDirectory, "media.tar.gz");
  const database = databaseArguments(databaseUrl, databaseDump);
  const childEnv = { ...process.env };
  if (database.password) childEnv.PGPASSWORD = database.password;
  delete childEnv.DATABASE_URL;

  await execFileAsync(pgDumpPath, database.args, { env: childEnv, maxBuffer: 1024 * 1024 });
  await execFileAsync("tar", ["-czf", mediaArchive, "-C", mediaDirectory, "."], { maxBuffer: 1024 * 1024 });

  const files = {
    postgres: await fileManifest(databaseDump),
    media: await fileManifest(mediaArchive),
  };
  const manifest = {
    formatVersion: 1,
    status: "completed",
    createdAt: new Date().toISOString(),
    backupName,
    mediaSource: mediaDirectory,
    files,
  };
  await writeFile(join(workDirectory, "manifest.json"), JSON.stringify(manifest, null, 2));
  await rename(workDirectory, finalDirectory);
  await appendJournal({ status: "completed", createdAt: manifest.createdAt, backupName, directory: finalDirectory, files });
  console.log(JSON.stringify({ status: "completed", directory: finalDirectory, files }, null, 2));
} catch (error) {
  await appendJournal({ status: "failed", createdAt: new Date().toISOString(), backupName, error: error instanceof Error ? error.message : String(error) });
  await notifyFailure(error);
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
} finally {
  await rm(workDirectory, { recursive: true, force: true });
}
