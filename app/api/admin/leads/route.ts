import { NextResponse } from "next/server";
import { authorizeAdmin } from "@/lib/security/admin-request";
import { isLeadsDatabaseConfigured, listLeads } from "@/lib/leads/service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await authorizeAdmin(request);
  if (auth.error) return auth.error;
  const kind = new URL(request.url).searchParams.get("kind") || "";
  if (!isLeadsDatabaseConfigured()) return NextResponse.json({ items: [], total: 0, demo: true });
  const items = await listLeads(kind);
  return NextResponse.json({ items, total: items.length });
}
