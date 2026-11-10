import { NextResponse } from "next/server";
import {
  AdminCategoryNotFoundError,
  AdminProductNotFoundError,
  bulkAssignAdminProductCategory,
  InvalidCategoryAssignmentError,
  isAdminCategoryDatabaseConfigured,
  isValidAdminBulkProductCategoryInput,
  parseAdminBulkProductCategoryInput,
} from "@/lib/catalog/category-service";
import { revalidateCatalog } from "@/lib/catalog/revalidation";
import { authorizeAdmin } from "@/lib/security/admin-request";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request) {
  const auth = await authorizeAdmin(request, true);
  if (auth.error) return auth.error;
  if (!isAdminCategoryDatabaseConfigured()) {
    return Response.json({ error: "Подключите PostgreSQL для изменения категорий" }, { status: 503 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "Некорректное тело запроса" }, { status: 400 });
  }

  const input = parseAdminBulkProductCategoryInput(body);
  if (!isValidAdminBulkProductCategoryInput(input)) {
    return Response.json({ error: "Выберите товары, категорию и действие" }, { status: 422 });
  }

  try {
    const result = await bulkAssignAdminProductCategory(input, auth.admin!.id);
    revalidateCatalog();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof AdminProductNotFoundError) {
      return Response.json({ error: "Один или несколько товаров не найдены" }, { status: 404 });
    }
    if (error instanceof AdminCategoryNotFoundError) {
      return Response.json({ error: "Категория не найдена" }, { status: 404 });
    }
    if (error instanceof InvalidCategoryAssignmentError) {
      return Response.json({ error: "Выберите товары, категорию и действие" }, { status: 422 });
    }
    return Response.json({ error: "Не удалось изменить категории товаров" }, { status: 500 });
  }
}
