import { NextResponse } from "next/server";
import { getImportRun, isImportDatabaseConfigured } from "@/lib/imports/service";
import { authorizeAdmin } from "@/lib/security/admin-request";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeAdmin(request);
  if (auth.error) return auth.error;
  if (!isImportDatabaseConfigured()) return NextResponse.json({ item: null, demo: true });
  const { id } = await params;
  const item = await getImportRun(id);
  if (!item) return Response.json({ error: "Запуск импорта не найден" }, { status: 404 });
  return NextResponse.json({ item });
}
