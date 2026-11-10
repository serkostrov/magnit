import { NextResponse } from "next/server";
import { authorizeAdmin } from "../../../../lib/security/admin-request";
import { isDatabaseConfigured } from "../../../../lib/db/client";
import { listAdminReviews } from "../../../../lib/reviews/service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await authorizeAdmin(request);
  if (auth.error) return auth.error;
  if (!isDatabaseConfigured()) return NextResponse.json({ items: [], total: 0, demo: true });
  const status = new URL(request.url).searchParams.get("status") || "";
  const items = await listAdminReviews(status);
  return NextResponse.json({ items, total: items.length });
}
