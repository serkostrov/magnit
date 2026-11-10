import { NextResponse } from "next/server";
import { isDatabaseConfigured } from "@/lib/db/client";
import { listAuditEntries } from "@/lib/audit/service";
import { authorizeAdmin } from "@/lib/security/admin-request";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await authorizeAdmin(request);
  if (auth.error) return auth.error;
  if (!isDatabaseConfigured()) return NextResponse.json({ items: [], demo: true });
  const url = new URL(request.url);
  return NextResponse.json(
    await listAuditEntries({
      action: url.searchParams.get("action") || "",
      entityType: url.searchParams.get("entityType") || "",
      search: url.searchParams.get("search") || "",
      page: Number(url.searchParams.get("page")) || 1,
      pageSize: 30,
    }),
  );
}
