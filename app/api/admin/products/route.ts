import { NextResponse } from "next/server";
import {
  createAdminProduct,
  isAdminCatalogDatabaseConfigured,
  isValidAdminProductInput,
  listAdminProducts,
  parseAdminProductInput,
} from "@/lib/catalog/admin-service";
import { authorizeAdmin } from "@/lib/security/admin-request";
import { revalidateCatalog } from "@/lib/catalog/revalidation";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await authorizeAdmin(request);
  if (auth.error) return auth.error;
  const url = new URL(request.url);
  return NextResponse.json(await listAdminProducts({
    search: url.searchParams.get("search") || "",
    status: url.searchParams.get("status") || "",
    categorySlug: url.searchParams.get("category") || "",
    characteristicKey: url.searchParams.get("characteristic") || "",
    page: Number(url.searchParams.get("page")) || 1,
    pageSize: Number(url.searchParams.get("pageSize")) || 30,
  }));
}

export async function POST(request: Request) {
  const auth = await authorizeAdmin(request, true);
  if (auth.error) return auth.error;
  if (!isAdminCatalogDatabaseConfigured()) return Response.json({ error: "Подключите PostgreSQL для записи каталога" }, { status: 503 });
  let body: Record<string, unknown>;
  try { body = (await request.json()) as Record<string, unknown>; } catch { return Response.json({ error: "Некорректное тело запроса" }, { status: 400 }); }
  const input = parseAdminProductInput(body);
  if (!isValidAdminProductInput(input)) return Response.json({ error: "Заполните обязательные поля карточки и проверьте числовые значения" }, { status: 422 });
  try {
    const created = await createAdminProduct(input, auth.admin!.id);
    revalidateCatalog(input.slug);
    return Response.json({ ok: true, id: created }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error && /duplicate|unique/i.test(error.message) ? "Такой slug или артикул уже существует" : "Не удалось создать товар";
    return Response.json({ error: message }, { status: 409 });
  }
}
