import { NextResponse } from "next/server";
import {
  AdminCategoryInUseError,
  AdminCategoryNotFoundError,
  deleteAdminCategory,
  isAdminCategoryDatabaseConfigured,
  isValidAdminCategoryInput,
  parseAdminCategoryInput,
  updateAdminCategory,
} from "@/lib/catalog/category-service";
import { authorizeAdmin } from "@/lib/security/admin-request";
import { revalidateCatalog } from "@/lib/catalog/revalidation";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeAdmin(request, true);
  if (auth.error) return auth.error;
  if (!isAdminCategoryDatabaseConfigured()) return Response.json({ error: "Подключите PostgreSQL для записи категорий" }, { status: 503 });
  let body: Record<string, unknown>;
  try { body = (await request.json()) as Record<string, unknown>; } catch { return Response.json({ error: "Некорректное тело запроса" }, { status: 400 }); }
  const input = parseAdminCategoryInput(body);
  if (!isValidAdminCategoryInput(input)) return Response.json({ error: "Заполните slug и название категории" }, { status: 422 });
  try {
    const { id } = await params;
    const item = await updateAdminCategory(id, input, auth.admin!.id);
    revalidateCatalog();
    return NextResponse.json({ item });
  } catch (error) {
    if (error instanceof AdminCategoryNotFoundError) return Response.json({ error: "Категория не найдена" }, { status: 404 });
    if (error instanceof Error && /duplicate|unique/i.test(error.message)) return Response.json({ error: "Такой slug категории уже существует" }, { status: 409 });
    if (error instanceof Error && error.name === "InvalidCategoryAssignmentError") return Response.json({ error: "Категория не может быть родителем самой себя" }, { status: 422 });
    return Response.json({ error: "Не удалось обновить категорию" }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeAdmin(request, true);
  if (auth.error) return auth.error;
  if (!isAdminCategoryDatabaseConfigured()) return Response.json({ error: "Подключите PostgreSQL для записи категорий" }, { status: 503 });
  try {
    const { id } = await params;
    await deleteAdminCategory(id, auth.admin!.id);
    revalidateCatalog();
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AdminCategoryNotFoundError) return Response.json({ error: "Категория не найдена" }, { status: 404 });
    if (error instanceof AdminCategoryInUseError) return Response.json({ error: `Нельзя удалить категорию: к ней привязано ${error.productCount} товаров. Сначала перенесите их в другую категорию.` }, { status: 409 });
    return Response.json({ error: "Не удалось удалить категорию" }, { status: 500 });
  }
}
