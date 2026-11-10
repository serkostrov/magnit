import crypto from "node:crypto";
import { cookies } from "next/headers";
import { query } from "../db/client";

export const SESSION_COOKIE = "site_magnit_admin_session";
export const CSRF_COOKIE = "site_magnit_csrf";
const SESSION_TTL_DAYS = Number(process.env.SESSION_TTL_DAYS || 14);

function hash(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function passwordHash(password: string) {
  return crypto.scryptSync(password, process.env.ADMIN_PASSWORD_SALT || "site-magnit-admin", 64).toString("hex");
}

function safeEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export async function authenticateAdmin(login: string, password: string) {
  const result = await query<{ id: string; login: string; password_hash: string }>("SELECT id, login, password_hash FROM admin_users WHERE login = $1 AND is_active = true LIMIT 1", [login.trim()]);
  const user = result.rows[0];
  if (!user || !safeEqual(user.password_hash, passwordHash(password))) return null;
  return { id: user.id, login: user.login };
}

export async function createAdminSession(userId: string) {
  const token = crypto.randomBytes(32).toString("hex");
  const csrfToken = crypto.randomBytes(24).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 86_400_000);
  await query("INSERT INTO admin_sessions (admin_user_id, token_hash, csrf_token_hash, expires_at) VALUES ($1, $2, $3, $4)", [userId, hash(token), hash(csrfToken), expiresAt]);
  return { token, csrfToken, expiresAt };
}

export async function revokeAdminSession(token: string) {
  if (!token) return;
  await query("UPDATE admin_sessions SET revoked_at = now() WHERE token_hash = $1 AND revoked_at IS NULL", [hash(token)]);
}

export async function getAdminFromToken(token: string | undefined) {
  if (!token) return null;
  const result = await query<{ id: string; login: string; session_id: string; csrf_token_hash: string }>(`
    SELECT au.id, au.login, s.id AS session_id, s.csrf_token_hash
    FROM admin_sessions s JOIN admin_users au ON au.id = s.admin_user_id
    WHERE s.token_hash = $1 AND s.revoked_at IS NULL AND s.expires_at > now() AND au.is_active = true LIMIT 1`, [hash(token)]);
  return result.rows[0] || null;
}

export async function getCurrentAdmin() {
  try {
    const store = await cookies();
    return await getAdminFromToken(store.get(SESSION_COOKIE)?.value);
  } catch {
    return null;
  }
}

export async function requireAdmin() {
  const admin = await getCurrentAdmin();
  if (!admin) throw new Error("ADMIN_AUTH_REQUIRED");
  return admin;
}

export function csrfMatches(admin: { csrf_token_hash: string } | null, csrfToken: string | undefined) {
  return Boolean(admin && csrfToken && safeEqual(admin.csrf_token_hash, hash(csrfToken)));
}

export function sessionCookieOptions(expiresAt: Date) {
  return { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/", expires: expiresAt };
}

export function csrfCookieOptions(expiresAt: Date) {
  return { httpOnly: false, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/", expires: expiresAt };
}

export { hash as hashToken, passwordHash };
