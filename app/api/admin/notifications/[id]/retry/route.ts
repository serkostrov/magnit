import { NextResponse } from "next/server";
import { isDatabaseConfigured } from "@/lib/db/client";
import { deliverNotification } from "@/lib/notifications/service";
import { authorizeAdmin } from "@/lib/security/admin-request";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeAdmin(request, true);
  if (auth.error) return auth.error;
  if (!isDatabaseConfigured()) return NextResponse.json({ error: "Подключите PostgreSQL для повтора уведомления" }, { status: 503 });
  const { id } = await params;
  const result = await deliverNotification(id);
  if (result.status === "missing") return NextResponse.json({ error: "Уведомление не найдено" }, { status: 404 });
  return NextResponse.json(result);
}
