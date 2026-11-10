import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { isDatabaseConfigured, query } from "../db/client";

const execFileAsync = promisify(execFile);

export function isImportDatabaseConfigured() {
  return isDatabaseConfigured();
}

export type ImportRunFilters = {
  mode?: "dry-run" | "apply";
  status?: "running" | "completed" | "failed";
  search?: string;
  hasErrors?: boolean;
};

export async function listImportRuns(filters: ImportRunFilters = {}) {
  const params: unknown[] = [];
  const clauses = ["TRUE"];
  if (filters.mode) { params.push(filters.mode); clauses.push(`mode=$${params.length}`); }
  if (filters.status) { params.push(filters.status); clauses.push(`status=$${params.length}`); }
  if (filters.search?.trim()) { params.push(`%${filters.search.trim()}%`); clauses.push(`(source_name ILIKE $${params.length} OR stats::text ILIKE $${params.length} OR errors::text ILIKE $${params.length})`); }
  if (filters.hasErrors) clauses.push("jsonb_array_length(errors) > 0");
  const result = await query<Record<string, unknown>>(
    `SELECT id,source_name,mode,status,stats,errors,started_at,finished_at FROM import_runs WHERE ${clauses.join(" AND ")} ORDER BY started_at DESC LIMIT 50`,
    params,
  );
  return result.rows;
}

export async function getImportRun(id: string) {
  const result = await query<Record<string, unknown>>(
    "SELECT id,source_name,mode,status,stats,errors,started_at,finished_at FROM import_runs WHERE id=$1",
    [id],
  );
  return result.rows[0] || null;
}

export async function runTildaImport(source: string, dryRun: boolean) {
  const script = path.join(process.cwd(), "scripts", "import-tilda.mjs");
  const args = [script, source];
  if (dryRun) args.push("--dry-run");
  return execFileAsync(process.execPath, args, {
    env: process.env,
    timeout: 120_000,
    maxBuffer: 2_000_000,
  });
}
