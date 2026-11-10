import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { CSRF_COOKIE, SESSION_COOKIE, getCurrentAdmin, revokeAdminSession, csrfMatches } from "@/lib/security/auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const admin = await getCurrentAdmin();
  const store = await cookies();
  const csrfToken = request.headers.get("x-csrf-token") || store.get(CSRF_COOKIE)?.value;
  if (admin && !csrfMatches(admin, csrfToken)) return Response.json({ error: "Недействительный CSRF-токен" }, { status: 403 });
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) await revokeAdminSession(token);
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(SESSION_COOKIE);
  response.cookies.delete(CSRF_COOKIE);
  return response;
}
