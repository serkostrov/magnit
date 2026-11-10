import { NextResponse } from "next/server";
import { clientKey, allowRequest } from "../../../lib/security/rate-limit";
import { submitReview } from "../../../lib/reviews/service";
import { REVIEW_PHOTO_MAX_BYTES } from "../../../lib/reviews/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const key = clientKey(request);
  if (!(await allowRequest(`review:${key}`, 6, 30 * 60_000))) {
    return NextResponse.json({ error: "Слишком много попыток. Попробуйте позже." }, { status: 429 });
  }
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > REVIEW_PHOTO_MAX_BYTES + 512 * 1024) {
    return NextResponse.json({ error: "Фотография должна быть не больше 5 МБ" }, { status: 413 });
  }
  try {
    const form = await request.formData();
    const photo = form.get("photo");
    const result = await submitReview({
      token: String(form.get("token") || ""),
      authorName: String(form.get("authorName") || ""),
      rating: Number(form.get("rating")),
      body: String(form.get("body") || ""),
      consent: form.get("consent") === "true",
      photo: photo instanceof File && photo.size > 0 ? photo : null,
      consentIp: key,
      consentUserAgent: request.headers.get("user-agent")?.slice(0, 500) || "",
    });
    return NextResponse.json({ ok: true, reviewId: result.reviewId, notification: result.notification }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось отправить отзыв";
    const publicMessage = message.startsWith("DATABASE_") || message.includes("constraint") ? "Не удалось отправить отзыв" : message;
    return NextResponse.json({ error: publicMessage }, { status: 422 });
  }
}
