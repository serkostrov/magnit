import { NextResponse } from "next/server";
import {
  AdminCategoryNotFoundError,
  assignAdminProductCategories,
  InvalidCategoryAssignmentError,
  isAdminCategoryDatabaseConfigured,
} from "@/lib/catalog/category-service";
import { authorizeAdmin } from "@/lib/security/admin-request";
import { revalidateCatalog } from "@/lib/catalog/revalidation";

export const dynamic = "force-dynamic";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeAdmin(request, true);
  if (auth.error) return auth.error;
  if (!isAdminCategoryDatabaseConfigured()) return Response.json({ error: "Подключите PostgreSQL для записи категорий" }, { status: 503 });
  let body: Record<string, unknown>;
  try { body = (await request.json()) as Record<string, unknown>; } catch { return Response.json({ error: "Некорректное тело запроса" }, { status: 400 }); }
  const primaryCategoryId = typeof body.primaryCategoryId === "string" ? body.primaryCategoryId : "";
  const additionalCategoryIds = Array.isArray(body.additionalCategoryIds) ? body.additionalCategoryIds.filter((value): value is string => typeof value === "string") : [];
  try {
    const { id } = await params;
    const result = await assignAdminProductCategories(id, primaryCategoryId, additionalCategoryIds, auth.admin!.id);
    revalidateCatalog(result.slug);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof AdminCategoryNotFoundError) return Response.json({ error: "Товар не найден" }, { status: 404 });
    if (error instanceof InvalidCategoryAssignmentError) return Response.json({ error: "Выберите существующую основную категорию и дополнительные категории" }, { status: 422 });
    return Response.json({ error: "Не удалось сохранить категории товара" }, { status: 500 });
  }
}
