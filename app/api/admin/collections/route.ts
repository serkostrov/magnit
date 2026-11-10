import { NextResponse } from "next/server";
import {
  createAdminCollection,
  isAdminCollectionDatabaseConfigured,
  isValidAdminCollectionInput,
  listAdminCollections,
  parseAdminCollectionInput,
} from "@/lib/catalog/collection-service";
import { authorizeAdmin } from "@/lib/security/admin-request";
import { revalidateCatalog } from "@/lib/catalog/revalidation";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await authorizeAdmin(request);
  if (auth.error) return auth.error;
  if (!isAdminCollectionDatabaseConfigured()) return NextResponse.json({ items: [], demo: true });
  return NextResponse.json({ items: await listAdminCollections() });
}

export async function POST(request: Request) {
  const auth = await authorizeAdmin(request, true);
  if (auth.error) return auth.error;
  if (!isAdminCollectionDatabaseConfigured()) return Response.json({ error: "Подключите PostgreSQL для записи подборок" }, { status: 503 });
  let body: Record<string, unknown>;
  try { body = (await request.json()) as Record<string, unknown>; } catch { return Response.json({ error: "Некорректное тело запроса" }, { status: 400 }); }
  const input = parseAdminCollectionInput(body);
  if (!isValidAdminCollectionInput(input)) return Response.json({ error: "Заполните slug и название подборки" }, { status: 422 });
  try {
    const item = await createAdminCollection(input, auth.admin!.id);
    revalidateCatalog();
    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && /duplicate|unique/i.test(error.message)) return Response.json({ error: "Такой slug подборки уже существует" }, { status: 409 });
    return Response.json({ error: "Не удалось создать подборку" }, { status: 500 });
  }
}
