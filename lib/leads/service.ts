import { isDatabaseConfigured, query } from "../db/client";

export function isLeadsDatabaseConfigured() {
  return isDatabaseConfigured();
}

export async function listLeads(kind = "") {
  if (!isDatabaseConfigured()) return [];
  const params: unknown[] = [];
  const where = kind ? "WHERE kind = $1" : "";
  if (kind) params.push(kind);
  const result = await query<Record<string, unknown>>(
    `SELECT id,kind,payload,phone,email,consent_version,consent_at,consent_ip,consent_user_agent,created_at
     FROM leads ${where} ORDER BY created_at DESC LIMIT 100`,
    params,
  );
  return result.rows;
}
