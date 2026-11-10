import { NextResponse } from "next/server";
import { isOrdersDatabaseConfigured, listOrders } from "@/lib/orders/service";
import { authorizeAdmin } from "@/lib/security/admin-request";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await authorizeAdmin(request);
  if (auth.error) return auth.error;
  const url = new URL(request.url);
  const status = url.searchParams.get("status") || "";
  if (!isOrdersDatabaseConfigured()) return NextResponse.json({ items: [], total: 0, demo: true });
  const items = await listOrders(status);
  return NextResponse.json({ items, total: items.length });
}
