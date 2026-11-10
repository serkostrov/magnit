import { Pool, type PoolClient, type QueryResultRow } from "pg";

let pool: Pool | null = null;

export function databaseUrl() {
  return process.env.DATABASE_URL?.trim() || "";
}

export function isDatabaseConfigured() {
  return Boolean(databaseUrl());
}

function getPool() {
  if (!databaseUrl()) return null;
  if (!pool) {
    pool = new Pool({
      connectionString: databaseUrl(),
      max: Number(process.env.DATABASE_POOL_MAX || 10),
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
      ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined,
    });
  }
  return pool;
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  values: unknown[] = [],
) {
  const currentPool = getPool();
  if (!currentPool) throw new Error("DATABASE_URL is not configured");
  return currentPool.query<T>(text, values);
}

export async function withTransaction<T>(callback: (client: PoolClient) => Promise<T>) {
  const currentPool = getPool();
  if (!currentPool) throw new Error("DATABASE_URL is not configured");
  const client = await currentPool.connect();
  try {
    await client.query("BEGIN");
    const value = await callback(client);
    await client.query("COMMIT");
    return value;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function checkDatabase() {
  if (!isDatabaseConfigured()) return { configured: false, healthy: false };
  try {
    await query("SELECT 1");
    return { configured: true, healthy: true };
  } catch (error) {
    return {
      configured: true,
      healthy: false,
      error: error instanceof Error ? error.message : "Database unavailable",
    };
  }
}

export async function closeDatabase() {
  if (pool) await pool.end();
  pool = null;
}
