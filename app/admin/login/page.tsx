"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLoginPage() {
  const router = useRouter();
  const [login, setLogin] = useState("admin");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setLoading(true);
    try {
      const response = await fetch("/api/admin/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ login, password }) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Не удалось войти");
      router.replace("/admin");
    } catch (err) { setError(err instanceof Error ? err.message : "Ошибка входа"); } finally { setLoading(false); }
  }
  return <main className="admin-login-page"><form className="admin-login-card" onSubmit={submit}><span className="eyebrow">Закрытый раздел</span><h1>Вход в админку</h1><p>Управление каталогом, заказами и импортами.</p><label>Логин<input value={login} onChange={(event) => setLogin(event.target.value)} autoComplete="username" required /></label><label>Пароль<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required /></label>{error && <p className="form-error" role="alert">{error}</p>}<button className="button button-primary" type="submit" disabled={loading}>{loading ? "Проверяем…" : "Войти"}</button></form></main>;
}
