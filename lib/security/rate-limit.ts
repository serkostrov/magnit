import { isDatabaseConfigured, query } from "../db/client";

type MemoryBucket = { count: number; resetAt: number };

const memoryBuckets = new Map<string, MemoryBucket>();

function allowInMemory(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const current = memoryBuckets.get(key);
  if (!current || current.resetAt <= now) {
    memoryBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (current.count >= limit) return false;
  current.count += 1;
  return true;
}

/**
 * Uses PostgreSQL as the shared counter when the app runs on multiple
 * Dokploy instances. The in-memory path is only for the static/demo mode
 * where no database is configured.
 */
export async function allowRequest(key: string, limit = 20, windowMs = 60_000) {
  if (!isDatabaseConfigured()) return allowInMemory(key, limit, windowMs);

  try {
    const result = await query<{ allowed: boolean }>(
      `INSERT INTO rate_limit_buckets (key, window_started_at, request_count)
       VALUES ($1, now(), 1)
       ON CONFLICT (key) DO UPDATE SET
         request_count = CASE
           WHEN rate_limit_buckets.window_started_at + ($3 * INTERVAL '1 millisecond') <= now() THEN 1
           ELSE rate_limit_buckets.request_count + 1
         END,
         window_started_at = CASE
           WHEN rate_limit_buckets.window_started_at + ($3 * INTERVAL '1 millisecond') <= now() THEN now()
           ELSE rate_limit_buckets.window_started_at
         END,
         updated_at = now()
       RETURNING request_count <= $2 AS allowed`,
      [key, limit, windowMs],
    );
    return result.rows[0]?.allowed === true;
  } catch (error) {
    // Fail closed when a configured shared limiter is unavailable: otherwise
    // every instance could accept unlimited traffic during a DB incident.
    console.error("[security] shared rate limiter unavailable", error);
    return false;
  }
}

export function clientKey(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}
