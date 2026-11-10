import { NextResponse } from "next/server";
import {
  AdminCollectionNotFoundError,
  deleteAdminCollection,
  isAdminCollectionDatabaseConfigured,
  isValidAdminCollectionInput,
  parseAdminCollectionInput,
  updateAdminCollection,
} from "@/lib/catalog/collection-service";
import { authorizeAdmin } from "@/lib/security/admin-request";
import { revalidateCatalog } from "@/lib/catalog/revalidation";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeAdmin(request, true);
  if (auth.error) return auth.error;
  if (!isAdminCollectionDatabaseConfigured()) return Response.json({ error: "Подключите PostgreSQL для записи подборок" }, { status: 503 });
  let body: Record<string, unknown>;
  try { body = (await request.json()) as Record<string, unknown>; } catch { return Response.json({ error: "Некорректное тело запроса" }, { status: 400 }); }
  const input = parseAdminCollectionInput(body);
  if (!isValidAdminCollectionInput(input)) return Response.json({ error: "Заполните slug и название подборки" }, { status: 422 });
  try {
    const { id } = await params;
    const item = await updateAdminCollection(id, input, auth.admin!.id);
    revalidateCatalog();
    return NextResponse.json({ item });
  } catch (error) {
    if (error instanceof AdminCollectionNotFoundError) return Response.json({ error: "Подборка не найдена" }, { status: 404 });
    if (error instanceof Error && /duplicate|unique/i.test(error.message)) return Response.json({ error: "Такой slug подборки уже существует" }, { status: 409 });
    return Response.json({ error: "Не удалось обновить подборку" }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeAdmin(request, true);
  if (auth.error) return auth.error;
  if (!isAdminCollectionDatabaseConfigured()) return Response.json({ error: "Подключите PostgreSQL для записи подборок" }, { status: 503 });
  try {
    const { id } = await params;
    await deleteAdminCollection(id, auth.admin!.id);
    revalidateCatalog();
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AdminCollectionNotFoundError) return Response.json({ error: "Подборка не найдена" }, { status: 404 });
    return Response.json({ error: "Не удалось удалить подборку" }, { status: 500 });
  }
}
