import { NextResponse } from "next/server";
import {
  createAdminCategory,
  isAdminCategoryDatabaseConfigured,
  isValidAdminCategoryInput,
  listAdminCategories,
  parseAdminCategoryInput,
} from "@/lib/catalog/category-service";
import { revalidateCatalog } from "@/lib/catalog/revalidation";
import { authorizeAdmin } from "@/lib/security/admin-request";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await authorizeAdmin(request);
  if (auth.error) return auth.error;
  if (!isAdminCategoryDatabaseConfigured()) return NextResponse.json({ items: [], demo: true });
  return NextResponse.json({ items: await listAdminCategories() });
}

export async function POST(request: Request) {
  const auth = await authorizeAdmin(request, true);
  if (auth.error) return auth.error;
  if (!isAdminCategoryDatabaseConfigured()) return Response.json({ error: "Подключите PostgreSQL для записи категорий" }, { status: 503 });
  let body: Record<string, unknown>;
  try { body = (await request.json()) as Record<string, unknown>; } catch { return Response.json({ error: "Некорректное тело запроса" }, { status: 400 }); }
  const input = parseAdminCategoryInput(body);
  if (!isValidAdminCategoryInput(input)) return Response.json({ error: "Заполните slug и название категории" }, { status: 422 });
  try {
    const item = await createAdminCategory(input, auth.admin!.id);
    revalidateCatalog();
    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && /duplicate|unique/i.test(error.message)) return Response.json({ error: "Такой slug категории уже существует" }, { status: 409 });
    return Response.json({ error: "Не удалось создать категорию" }, { status: 500 });
  }
}
