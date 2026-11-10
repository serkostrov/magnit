import { isDatabaseConfigured, withTransaction } from "../../../../lib/db/client";
import { consentVersion, isRecord, validateLeadPayload } from "../../../../lib/forms/validation";
import { notifyByEmail } from "../../../../lib/notifications/email";
import { deliverNotification, enqueueNotification, publicNotificationStatus } from "../../../../lib/notifications/service";
import { allowRequest, clientKey } from "../../../../lib/security/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!(await allowRequest(`${clientKey(request)}:lead`, 8, 10 * 60_000))) {
    return Response.json({ error: "Слишком много заявок. Попробуйте позже." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Некорректное тело запроса" }, { status: 400 });
  }

  if (!isRecord(body)) return Response.json({ error: "Некорректное тело запроса" }, { status: 400 });
  const validation = validateLeadPayload(body);
  if ("error" in validation) return Response.json({ error: validation.error }, { status: 422 });
  const { value } = validation;
  const { kind, phone, email, ...payload } = value;
  const consentIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("x-real-ip")?.trim()
    || "";
  const consentUserAgent = request.headers.get("user-agent")?.trim().slice(0, 500) || "";

  const notificationMessage = {
    subject: `Новая заявка на подбор (${kind})`,
    replyTo: email || undefined,
    text: [
      `Тип: ${kind}`,
      payload.name && `Имя: ${payload.name}`,
      payload.contact && `Контакт: ${payload.contact}`,
      `Телефон: ${phone || "не указан"}`,
      `Email: ${email || "не указан"}`,
      payload.task && `Задача: ${payload.task}`,
      payload.solution && `Решение: ${payload.solution}`,
      payload.parameters && `Параметры: ${payload.parameters}`,
      payload.company && `Компания: ${payload.company}`,
      payload.request && `Запрос: ${payload.request}`,
      payload.comment && `Комментарий: ${payload.comment}`,
      payload.newsletter && "Подписка на новости: да",
      payload.source && `Источник: ${payload.source}`,
    ].filter(Boolean).join("\n"),
  };

  if (isDatabaseConfigured()) {
    const saved = await withTransaction(async (client) => {
      const inserted = await client.query<{ id: string }>(
        `INSERT INTO leads (kind, payload, phone, email, consent_version, consent_at, consent_ip, consent_user_agent)
         VALUES ($1, $2::jsonb, $3, $4, $5, now(), $6, $7) RETURNING id`,
        [kind, JSON.stringify(payload), phone, email, consentVersion(), consentIp, consentUserAgent],
      );
      const leadId = inserted.rows[0].id;
      const notificationId = await enqueueNotification(client, { entityType: "lead", entityId: leadId, ...notificationMessage });
      return { notificationId };
    });
    const notification = await deliverNotification(saved.notificationId);
    return Response.json({ ok: true, stored: true, notification: publicNotificationStatus(notification) }, { status: 201 });
  }

  const notification = await notifyByEmail(notificationMessage);

  return Response.json({ ok: true, stored: false, notification: { status: notification.delivered ? "sent" : "failed", delivered: notification.delivered, retryable: false } }, { status: 201 });
}
