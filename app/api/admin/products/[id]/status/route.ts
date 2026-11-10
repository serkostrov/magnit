import { NextResponse } from "next/server";
import {
  changeAdminProductStatus,
  isAdminCatalogDatabaseConfigured,
  isAdminProductStatus,
  AdminProductNotFoundError,
  AdminProductStatusTransitionError,
} from "@/lib/catalog/admin-service";
import { authorizeAdmin } from "@/lib/security/admin-request";
import { revalidateCatalog } from "@/lib/catalog/revalidation";

export const dynamic = "force-dynamic";

const lifecycleActions = {
  publish: "published",
  hide: "hidden",
  unpublish: "draft",
} as const;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeAdmin(request, true);
  if (auth.error) return auth.error;
  if (!isAdminCatalogDatabaseConfigured()) return Response.json({ error: "Подключите PostgreSQL для записи каталога" }, { status: 503 });
  let body: Record<string, unknown>;
  try { body = (await request.json()) as Record<string, unknown>; } catch { return Response.json({ error: "Некорректное тело запроса" }, { status: 400 }); }
  const action = typeof body.action === "string" ? body.action : "";
  const status = lifecycleActions[action as keyof typeof lifecycleActions];
  if (!status || !isAdminProductStatus(status)) return Response.json({ error: "Неизвестная команда публикации" }, { status: 422 });
  try {
    const { id } = await params;
    const result = await changeAdminProductStatus(id, status, auth.admin!.id);
    revalidateCatalog(result.slug);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof AdminProductNotFoundError) return Response.json({ error: "Товар не найден" }, { status: 404 });
    if (error instanceof AdminProductStatusTransitionError) return Response.json({ error: "Недопустимый переход статуса" }, { status: 422 });
    return Response.json({ error: "Не удалось изменить статус товара" }, { status: 500 });
  }
}
