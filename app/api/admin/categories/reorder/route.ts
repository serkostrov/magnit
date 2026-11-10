import { NextResponse } from "next/server";
import {
  AdminCategoryNotFoundError,
  InvalidCategoryAssignmentError,
  isAdminCategoryDatabaseConfigured,
  reorderAdminCategories,
} from "@/lib/catalog/category-service";
import { revalidateCatalog } from "@/lib/catalog/revalidation";
import { authorizeAdmin } from "@/lib/security/admin-request";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request) {
  const auth = await authorizeAdmin(request, true);
  if (auth.error) return auth.error;
  if (!isAdminCategoryDatabaseConfigured()) {
    return Response.json({ error: "Подключите PostgreSQL для изменения порядка" }, { status: 503 });
  }
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "Некорректное тело запроса" }, { status: 400 });
  }
  const ids = Array.isArray(body.ids)
    ? body.ids.filter((value): value is string => typeof value === "string")
    : [];
  try {
    await reorderAdminCategories(ids, auth.admin!.id);
    revalidateCatalog();
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AdminCategoryNotFoundError) {
      return Response.json({ error: "Категория не найдена" }, { status: 404 });
    }
    if (error instanceof InvalidCategoryAssignmentError) {
      return Response.json({ error: "Проверьте порядок категорий" }, { status: 422 });
    }
    return Response.json({ error: "Не удалось изменить порядок" }, { status: 500 });
  }
}
