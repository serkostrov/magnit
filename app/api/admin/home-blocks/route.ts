import { NextResponse } from "next/server";
import { homeBlockDefinitions, isValidHomeBlockOrder, listAdminHomeBlocks, updateHomeBlockOrder } from "@/lib/catalog/home-block-service";
import { revalidateCatalog } from "@/lib/catalog/revalidation";
import { authorizeAdmin } from "@/lib/security/admin-request";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await authorizeAdmin(request);
  if (auth.error) return auth.error;
  return NextResponse.json({ items: await listAdminHomeBlocks(), definitions: homeBlockDefinitions });
}

export async function PUT(request: Request) {
  const auth = await authorizeAdmin(request, true);
  if (auth.error) return auth.error;
  let body: Record<string, unknown>;
  try { body = (await request.json()) as Record<string, unknown>; } catch { return Response.json({ error: "Некорректное тело запроса" }, { status: 400 }); }
  const order = Array.isArray(body.order) ? body.order.filter((value): value is string => typeof value === "string") : [];
  if (!isValidHomeBlockOrder(order)) return Response.json({ error: "Порядок блоков не соответствует разрешённому списку" }, { status: 422 });
  try {
    const items = await updateHomeBlockOrder(order, auth.admin!.id);
    revalidateCatalog();
    return NextResponse.json({ items });
  } catch {
    return Response.json({ error: "Не удалось сохранить порядок блоков" }, { status: 500 });
  }
}
