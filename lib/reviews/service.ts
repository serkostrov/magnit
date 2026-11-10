import { createHash, randomBytes } from "node:crypto";
import { unlink, writeFile } from "node:fs/promises";
import type { PoolClient } from "pg";
import { recordAdminAudit, recordSystemAudit } from "../audit/service";
import { consentVersion } from "../forms/validation";
import { ensureMediaFileDirectory, mediaFilePath, mediaPublicBase } from "../media/storage";
import { isDatabaseConfigured, query, withTransaction } from "../db/client";
import { deliverNotification, enqueueNotification, publicNotificationStatus } from "../notifications/service";
import { managerReviewNotification, reviewRequestNotification } from "./notifications";
import { detectReviewPhoto, REVIEW_PHOTO_MAX_BYTES, validateReviewFields } from "./validation";

export type ReviewStatus = "moderation" | "hidden" | "published";
export const REVIEW_STATUSES = new Set<ReviewStatus>(["moderation", "hidden", "published"]);

type ReviewRequestOrder = { id: string; first_name: string; email: string };

function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function siteUrl() {
  return (process.env.SITE_URL?.trim() || process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://saitmagnitov.ru").replace(/\/$/, "");
}

export async function createReviewRequestForPaidOrder(client: PoolClient, order: ReviewRequestOrder) {
  const rawToken = randomBytes(32).toString("base64url");
  const inserted = await client.query(
    `INSERT INTO review_requests (order_id, token_hash, expires_at)
     VALUES ($1,$2,now() + INTERVAL '180 days')
     ON CONFLICT (order_id) DO NOTHING
     RETURNING id`,
    [order.id, tokenHash(rawToken)],
  );
  const requestId = inserted.rows[0]?.id as string | undefined;
  if (!requestId) return null;
  const reviewUrl = `${siteUrl()}/reviews/new?token=${encodeURIComponent(rawToken)}`;
  const notificationId = await enqueueNotification(client, {
    entityType: "review_request",
    entityId: requestId,
    recipientKind: "customer",
    ...reviewRequestNotification({ orderId: order.id, firstName: order.first_name, email: order.email, reviewUrl }),
  });
  return { requestId, notificationId };
}

export async function getReviewRequestState(token: string) {
  if (!isDatabaseConfigured() || token.length < 20 || token.length > 200) return null;
  const result = await query<{ id: string; order_id: string; expires_at: string; submitted_at: string | null }>(
    `SELECT id,order_id,expires_at::text,submitted_at::text
     FROM review_requests WHERE token_hash=$1`,
    [tokenHash(token)],
  );
  const row = result.rows[0];
  if (!row) return null;
  return {
    requestId: row.id,
    orderNumber: row.order_id.slice(0, 8).toUpperCase(),
    expired: new Date(row.expires_at).getTime() <= Date.now(),
    submitted: Boolean(row.submitted_at),
  };
}

function reviewImageKey(requestId: string, extension: string) {
  return `reviews/${requestId}/${Date.now()}-${randomBytes(8).toString("hex")}.${extension}`;
}

export async function submitReview(input: {
  token: string;
  authorName: string;
  rating: number;
  body: string;
  consent: boolean;
  photo?: File | null;
  consentIp?: string;
  consentUserAgent?: string;
}) {
  const fields = validateReviewFields(input);
  if ("error" in fields) throw new Error(fields.error);
  if (input.token.length < 20 || input.token.length > 200) throw new Error("Ссылка на отзыв недействительна");

  const state = await getReviewRequestState(input.token);
  if (!state || state.expired || state.submitted) throw new Error(state?.submitted ? "Отзыв по этой ссылке уже отправлен" : "Ссылка на отзыв недействительна или устарела");

  let photoUrl = "";
  let photoTarget = "";
  if (input.photo && input.photo.size > 0) {
    if (input.photo.size > REVIEW_PHOTO_MAX_BYTES) throw new Error("Фотография должна быть не больше 5 МБ");
    const bytes = Buffer.from(await input.photo.arrayBuffer());
    if (!bytes.length || bytes.length > REVIEW_PHOTO_MAX_BYTES) throw new Error("Фотография должна быть не больше 5 МБ");
    const detected = detectReviewPhoto(bytes);
    if (!detected) throw new Error("Поддерживаются фотографии JPG, PNG и WebP");
    const key = reviewImageKey(state.requestId, detected.extension);
    photoTarget = mediaFilePath(key);
    await ensureMediaFileDirectory(key);
    await writeFile(photoTarget, bytes, { flag: "wx" });
    photoUrl = `${mediaPublicBase()}/${key}`;
  }

  try {
    const created = await withTransaction(async (client) => {
      const request = await client.query<{ id: string; order_id: string; expires_at: Date; submitted_at: Date | null }>(
        `SELECT id,order_id,expires_at,submitted_at FROM review_requests WHERE token_hash=$1 FOR UPDATE`,
        [tokenHash(input.token)],
      );
      const current = request.rows[0];
      if (!current || current.submitted_at || current.expires_at.getTime() <= Date.now()) throw new Error("Ссылка на отзыв недействительна или уже использована");
      const review = await client.query<{ id: string }>(
        `INSERT INTO reviews (order_id,request_id,author_name,rating,body,photo_url,consent_version,consent_at,consent_ip,consent_user_agent)
         VALUES ($1,$2,$3,$4,$5,$6,$7,now(),$8,$9) RETURNING id`,
        [current.order_id, current.id, fields.value.authorName, fields.value.rating, fields.value.body, photoUrl, consentVersion(), input.consentIp || "", input.consentUserAgent || ""],
      );
      const reviewId = review.rows[0].id;
      await client.query("UPDATE review_requests SET submitted_at=now(),updated_at=now() WHERE id=$1", [current.id]);
      const notificationId = await enqueueNotification(client, {
        entityType: "review",
        entityId: reviewId,
        recipientKind: "manager",
        ...managerReviewNotification({ reviewId, authorName: fields.value.authorName, rating: fields.value.rating, body: fields.value.body, adminUrl: `${siteUrl()}/admin/reviews?status=moderation` }),
      });
      await recordSystemAudit("submit", "review", reviewId, { rating: fields.value.rating, hasPhoto: Boolean(photoUrl), consentVersion: consentVersion() }, client);
      return { reviewId, notificationId };
    });
    const notification = await deliverNotification(created.notificationId);
    return { reviewId: created.reviewId, notification: publicNotificationStatus(notification) };
  } catch (error) {
    if (photoTarget) await unlink(photoTarget).catch(() => undefined);
    throw error;
  }
}

export async function listPublishedReviews() {
  if (!isDatabaseConfigured()) return [];
  const result = await query<Record<string, unknown>>(
    `SELECT id,author_name,rating,body,photo_url,published_at,created_at
     FROM reviews WHERE status='published' ORDER BY published_at DESC NULLS LAST,created_at DESC`,
  );
  return result.rows;
}

export async function listAdminReviews(status = "") {
  if (!isDatabaseConfigured()) return [];
  const params: unknown[] = [];
  const where = status && REVIEW_STATUSES.has(status as ReviewStatus) ? "WHERE r.status=$1" : "";
  if (where) params.push(status);
  const result = await query<Record<string, unknown>>(
    `SELECT r.id,r.order_id,r.author_name,r.rating,r.body,r.photo_url,r.status,r.created_at,r.moderated_at,r.published_at
     FROM reviews r ${where} ORDER BY r.created_at DESC LIMIT 200`,
    params,
  );
  return result.rows;
}

export async function updateReviewStatus(id: string, status: ReviewStatus, adminId: string) {
  return withTransaction(async (client) => {
    const updated = await client.query<{ id: string; previous_status: string }>(
      `WITH current AS (SELECT id,status AS previous_status FROM reviews WHERE id=$1 FOR UPDATE)
       UPDATE reviews r SET status=$2,moderated_at=now(),moderated_by=$3,
         published_at=CASE WHEN $2='published' THEN COALESCE(r.published_at,now()) ELSE NULL END,
         updated_at=now()
       FROM current WHERE r.id=current.id RETURNING r.id,current.previous_status`,
      [id, status, adminId],
    );
    if (!updated.rows[0]) throw new Error("REVIEW_NOT_FOUND");
    await recordAdminAudit(adminId, "update_status", "review", id, { from: updated.rows[0].previous_status, to: status }, client);
    return updated.rows[0];
  });
}
