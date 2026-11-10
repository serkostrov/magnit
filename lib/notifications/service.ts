import { query, withTransaction } from "../db/client";
import { notifyByEmail, type NotificationPayload } from "./email";

type QueryExecutor = { query: (text: string, values?: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }> };

export type QueueNotificationInput = NotificationPayload & {
  entityType: "order" | "lead" | "review_request" | "review";
  entityId: string;
  recipientKind?: "manager" | "customer";
};

export type NotificationDelivery = {
  id: string;
  status: "pending" | "sending" | "sent" | "failed" | "missing";
  delivered: boolean;
  retryable: boolean;
  attempts?: number;
  reason?: string;
};

export async function enqueueNotification(client: QueryExecutor, input: QueueNotificationInput) {
  const result = await client.query(
    `INSERT INTO notification_outbox (channel, entity_type, entity_id, recipient_kind, payload)
     VALUES ('email', $1, $2, $3, $4::jsonb)
     ON CONFLICT (channel, entity_type, entity_id, recipient_kind) DO UPDATE SET updated_at = now()
     RETURNING id`,
    [
      input.entityType,
      input.entityId,
      input.recipientKind || "manager",
      JSON.stringify({
        subject: input.subject,
        text: input.text,
        html: input.html || "",
        to: input.to || "",
        replyTo: input.replyTo || "",
      }),
    ],
  );
  return String(result.rows[0].id);
}

function messageFromPayload(value: unknown): NotificationPayload {
  const payload = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return {
    subject: typeof payload.subject === "string" ? payload.subject : "Новое обращение",
    text: typeof payload.text === "string" ? payload.text : "Новое обращение",
    html: typeof payload.html === "string" && payload.html ? payload.html : undefined,
    to: typeof payload.to === "string" && payload.to ? payload.to : undefined,
    replyTo: typeof payload.replyTo === "string" && payload.replyTo ? payload.replyTo : undefined,
  };
}

async function currentDelivery(id: string): Promise<NotificationDelivery> {
  const result = await query<Record<string, unknown>>(
    "SELECT id,status,attempts,last_error FROM notification_outbox WHERE id=$1",
    [id],
  );
  const row = result.rows[0];
  if (!row) return { id, status: "missing", delivered: false, retryable: false };
  const status = String(row.status) as NotificationDelivery["status"];
  return {
    id,
    status,
    delivered: status === "sent",
    retryable: status === "failed" || status === "pending",
    attempts: Number(row.attempts || 0),
    reason: row.last_error ? String(row.last_error) : undefined,
  };
}

export async function deliverNotification(id: string): Promise<NotificationDelivery> {
  const claimed = await withTransaction(async (client) => {
    const result = await client.query<{ id: string; payload: unknown; attempts: number; entity_type: string; entity_id: string }>(
      `UPDATE notification_outbox
       SET status='sending', attempts=attempts + 1, updated_at=now()
       WHERE id=$1 AND (
         status IN ('pending', 'failed')
         OR (status='sending' AND updated_at < now() - INTERVAL '5 minutes')
       )
       RETURNING id,payload,attempts,entity_type,entity_id`,
      [id],
    );
    return result.rows[0] || null;
  });
  if (!claimed) return currentDelivery(id);

  const delivery = await notifyByEmail(messageFromPayload(claimed.payload));
  const status = delivery.delivered ? "sent" : "failed";
  const reason = delivery.delivered ? "" : (delivery.reason || "Notification delivery failed").slice(0, 2_000);
  await query(
    `UPDATE notification_outbox
     SET status=$2, last_error=$3, sent_at=CASE WHEN $2='sent' THEN now() ELSE sent_at END, updated_at=now()
     WHERE id=$1`,
    [id, status, reason],
  );
  if (delivery.delivered && claimed.entity_type === "review_request") {
    await query("UPDATE review_requests SET sent_at=COALESCE(sent_at,now()),updated_at=now() WHERE id=$1", [claimed.entity_id]);
  }
  return {
    id,
    status,
    delivered: delivery.delivered,
    retryable: !delivery.delivered,
    attempts: Number(claimed.attempts),
    reason: reason || undefined,
  };
}

export function publicNotificationStatus(delivery: NotificationDelivery) {
  return { status: delivery.status, delivered: delivery.delivered, retryable: delivery.retryable };
}

export async function listNotificationAttempts(status = "") {
  const params: unknown[] = [];
  const where = status ? "WHERE status=$1" : "";
  if (status) params.push(status);
  const result = await query<Record<string, unknown>>(
    `SELECT id,channel,entity_type,entity_id,recipient_kind,status,attempts,last_error,created_at,updated_at,sent_at,
            payload->>'subject' AS subject
     FROM notification_outbox ${where} ORDER BY created_at DESC LIMIT 100`,
    params,
  );
  return result.rows;
}
