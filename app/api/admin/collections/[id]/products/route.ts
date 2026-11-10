import { NextResponse } from "next/server";
import {
  AdminCollectionNotFoundError,
  InvalidCollectionProductsError,
  isAdminCollectionDatabaseConfigured,
  listAdminCollectionProducts,
  replaceAdminCollectionProducts,
} from "@/lib/catalog/collection-service";
import { authorizeAdmin } from "@/lib/security/admin-request";
import { revalidateCatalog } from "@/lib/catalog/revalidation";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeAdmin(request);
  if (auth.error) return auth.error;
  if (!isAdminCollectionDatabaseConfigured()) return NextResponse.json({ items: [], demo: true });
  try {
    const { id } = await params;
    return NextResponse.json({ items: await listAdminCollectionProducts(id) });
  } catch (error) {
    if (error instanceof AdminCollectionNotFoundError) return Response.json({ error: "Подборка не найдена" }, { status: 404 });
    return Response.json({ error: "Не удалось загрузить состав подборки" }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeAdmin(request, true);
  if (auth.error) return auth.error;
  if (!isAdminCollectionDatabaseConfigured()) return Response.json({ error: "Подключите PostgreSQL для записи подборок" }, { status: 503 });
  let body: Record<string, unknown>;
  try { body = (await request.json()) as Record<string, unknown>; } catch { return Response.json({ error: "Некорректное тело запроса" }, { status: 400 }); }
  const productIds = Array.isArray(body.productIds) ? body.productIds.filter((value): value is string => typeof value === "string") : [];
  try {
    const { id } = await params;
    const item = await replaceAdminCollectionProducts(id, productIds, auth.admin!.id);
    revalidateCatalog();
    return NextResponse.json({ item });
  } catch (error) {
    if (error instanceof AdminCollectionNotFoundError) return Response.json({ error: "Подборка не найдена" }, { status: 404 });
    if (error instanceof InvalidCollectionProductsError) return Response.json({ error: "В подборке указаны несуществующие товары" }, { status: 422 });
    return Response.json({ error: "Не удалось сохранить порядок товаров" }, { status: 500 });
  }
}
