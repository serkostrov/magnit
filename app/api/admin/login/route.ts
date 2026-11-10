import { NextResponse } from "next/server";
import { authenticateAdmin, createAdminSession, CSRF_COOKIE, SESSION_COOKIE, csrfCookieOptions, sessionCookieOptions } from "@/lib/security/auth";
import { isDatabaseConfigured } from "@/lib/db/client";
import { allowRequest, clientKey } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!(await allowRequest(`${clientKey(request)}:admin-login`, 8, 10 * 60_000))) {
    return Response.json({ error: "Слишком много попыток входа" }, { status: 429 });
  }
  if (!isDatabaseConfigured()) return Response.json({ error: "Админка будет доступна после подключения PostgreSQL" }, { status: 503 });
  let body: Record<string, unknown>;
  try { body = (await request.json()) as Record<string, unknown>; } catch { return Response.json({ error: "Некорректное тело запроса" }, { status: 400 }); }
  const login = typeof body.login === "string" ? body.login.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!login || !password) return Response.json({ error: "Введите логин и пароль" }, { status: 422 });
  const user = await authenticateAdmin(login, password);
  if (!user) return Response.json({ error: "Неверный логин или пароль" }, { status: 401 });
  const session = await createAdminSession(user.id);
  const response = NextResponse.json({ ok: true, user });
  response.cookies.set(SESSION_COOKIE, session.token, sessionCookieOptions(session.expiresAt));
  response.cookies.set(CSRF_COOKIE, session.csrfToken, csrfCookieOptions(session.expiresAt));
  return response;
}
