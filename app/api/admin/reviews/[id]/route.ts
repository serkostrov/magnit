import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { authorizeAdmin } from "../../../../../lib/security/admin-request";
import { cleanText } from "../../../../../lib/forms/validation";
import { isDatabaseConfigured } from "../../../../../lib/db/client";
import { REVIEW_STATUSES, type ReviewStatus, updateReviewStatus } from "../../../../../lib/reviews/service";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeAdmin(request, true);
  if (auth.error) return auth.error;
  if (!isDatabaseConfigured()) return NextResponse.json({ error: "Подключите PostgreSQL" }, { status: 503 });
  let body: Record<string, unknown>;
  try { body = await request.json() as Record<string, unknown>; } catch { return NextResponse.json({ error: "Некорректное тело запроса" }, { status: 400 }); }
  const status = cleanText(body.status, 30) as ReviewStatus;
  if (!REVIEW_STATUSES.has(status)) return NextResponse.json({ error: "Неизвестный статус отзыва" }, { status: 422 });
  const { id } = await params;
  try {
    await updateReviewStatus(id, status, auth.admin!.id);
    revalidatePath("/reviews");
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error && error.message === "REVIEW_NOT_FOUND") return NextResponse.json({ error: "Отзыв не найден" }, { status: 404 });
    return NextResponse.json({ error: "Не удалось обновить отзыв" }, { status: 500 });
  }
}
