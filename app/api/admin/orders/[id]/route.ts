import { NextResponse } from "next/server";
import { getOrder, isOrdersDatabaseConfigured, OrderNotFoundError, updateOrderStatus } from "@/lib/orders/service";
import { cleanText } from "@/lib/forms/validation";
import { authorizeAdmin } from "@/lib/security/admin-request";

export const dynamic = "force-dynamic";
const statuses = new Set(["new", "in_progress", "confirmed", "paid", "completed", "cancelled"]);

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeAdmin(request);
  if (auth.error) return auth.error;
  if (!isOrdersDatabaseConfigured()) return Response.json({ error: "Заказы доступны после подключения PostgreSQL" }, { status: 503 });
  const { id } = await params;
  const order = await getOrder(id);
  if (!order) return Response.json({ error: "Заказ не найден" }, { status: 404 });
  return NextResponse.json(order);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeAdmin(request, true);
  if (auth.error) return auth.error;
  if (!isOrdersDatabaseConfigured()) return Response.json({ error: "Подключите PostgreSQL для изменения заказов" }, { status: 503 });
  const { id } = await params;
  let body: Record<string, unknown>;
  try { body = (await request.json()) as Record<string, unknown>; } catch { return Response.json({ error: "Некорректное тело запроса" }, { status: 400 }); }
  const status = cleanText(body.status, 30);
  if (!statuses.has(status)) return Response.json({ error: "Неизвестный статус заказа" }, { status: 422 });
  try {
    const result = await updateOrderStatus(id, status, auth.admin!.id);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof OrderNotFoundError) return Response.json({ error: "Заказ не найден" }, { status: 404 });
    return Response.json({ error: "Не удалось обновить заказ" }, { status: 500 });
  }
}
