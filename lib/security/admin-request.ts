import { cookies } from "next/headers";
import { CSRF_COOKIE, getCurrentAdmin, csrfMatches } from "./auth";

export async function authorizeAdmin(request: Request, mutate = false) {
  const admin = await getCurrentAdmin();
  if (!admin) return { admin: null, error: Response.json({ error: "Требуется вход администратора" }, { status: 401 }) };
  if (mutate) {
    const store = await cookies();
    const csrfToken = request.headers.get("x-csrf-token") || store.get(CSRF_COOKIE)?.value;
    if (!csrfMatches(admin, csrfToken)) {
      return { admin: null, error: Response.json({ error: "Недействительный CSRF-токен" }, { status: 403 }) };
    }
  }
  return { admin, error: null };
}
