import { query } from "../db/client";

type AuditQueryClient = { query: (text: string, values?: unknown[]) => Promise<unknown> };

export type AuditFilters = {
  action?: string;
  entityType?: string;
  search?: string;
  limit?: number;
  page?: number;
  pageSize?: number;
};

const sensitiveKey = /password|token|secret|cookie|authorization/i;

function safeAuditValue(value: unknown): unknown {
  if (typeof value === "string") return value.slice(0, 2_000);
  if (typeof value === "number" || typeof value === "boolean" || value == null) return value;
  if (Array.isArray(value)) return value.slice(0, 100).map(safeAuditValue);
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([key]) => !sensitiveKey.test(key))
        .slice(0, 100)
        .map(([key, nested]) => [key, safeAuditValue(nested)]),
    );
  }
  return String(value).slice(0, 2_000);
}

export function sanitizeAuditChanges(changes: unknown) {
  return safeAuditValue(changes ?? {});
}

export async function recordAdminAudit(
  adminId: string,
  action: string,
  entityType: string,
  entityId: string,
  changes: unknown,
  client?: AuditQueryClient,
) {
  const executor = client || { query };
  await executor.query(
    "INSERT INTO audit_log (admin_user_id, action, entity_type, entity_id, changes) VALUES ($1, $2, $3, $4, $5)",
    [adminId, action, entityType, entityId, JSON.stringify(sanitizeAuditChanges(changes))],
  );
}

export async function recordSystemAudit(
  action: string,
  entityType: string,
  entityId: string,
  changes: unknown,
  client?: AuditQueryClient,
) {
  const executor = client || { query };
  await executor.query(
    "INSERT INTO audit_log (admin_user_id, action, entity_type, entity_id, changes) VALUES (NULL, $1, $2, $3, $4)",
    [action, entityType, entityId, JSON.stringify(sanitizeAuditChanges(changes))],
  );
}

export async function listAuditEntries(filters: AuditFilters = {}) {
  const params: unknown[] = [];
  const clauses = ["TRUE"];
  if (filters.action?.trim()) {
    params.push(filters.action.trim());
    clauses.push(`al.action = $${params.length}`);
  }
  if (filters.entityType?.trim()) {
    params.push(filters.entityType.trim());
    clauses.push(`al.entity_type = $${params.length}`);
  }
  if (filters.search?.trim()) {
    params.push(`%${filters.search.trim()}%`);
    clauses.push(`(COALESCE(au.login, 'Система') ILIKE $${params.length} OR al.action ILIKE $${params.length} OR al.entity_type ILIKE $${params.length} OR al.entity_id ILIKE $${params.length} OR al.changes::text ILIKE $${params.length})`);
  }
  const pageSize = Math.min(
    Math.max(Number(filters.pageSize || filters.limit) || 30, 1),
    100,
  );
  const requestedPage = Math.max(Number(filters.page) || 1, 1);
  const countResult = await query<{ total: string }>(
    `SELECT COUNT(*)::text AS total
     FROM audit_log al
     LEFT JOIN admin_users au ON au.id = al.admin_user_id
     WHERE ${clauses.join(" AND ")}`,
    params,
  );
  const total = Number(countResult.rows[0]?.total || 0);
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(requestedPage, pageCount);
  const itemParams = [...params, pageSize, (page - 1) * pageSize];
  const result = await query(
    `SELECT al.id, COALESCE(au.login, 'Система') AS actor, al.admin_user_id, al.action, al.entity_type, al.entity_id, al.changes, al.created_at
     FROM audit_log al
     LEFT JOIN admin_users au ON au.id = al.admin_user_id
     WHERE ${clauses.join(" AND ")}
     ORDER BY al.created_at DESC
     LIMIT $${params.length + 1}
     OFFSET $${params.length + 2}`,
    itemParams,
  );
  return { items: result.rows, total, page, pageCount, pageSize };
}
