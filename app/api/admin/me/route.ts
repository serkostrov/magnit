import { NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/security/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ authenticated: false }, { status: 401 });
  return NextResponse.json({ authenticated: true, user: { id: admin.id, login: admin.login } });
}
