"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type NotificationAttempt = {
  id: string;
  channel: string;
  entity_type: string;
  entity_id: string;
  status: string;
  attempts: number;
  last_error?: string;
  subject?: string;
  created_at?: string;
  updated_at?: string;
  sent_at?: string | null;
};

function csrfToken() {
  return document.cookie.split(";").map((part) => part.trim()).find((part) => part.startsWith("site_magnit_csrf="))?.split("=").slice(1).join("=") || "";
}

function date(value?: string) { return value ? new Date(value).toLocaleString("ru-RU") : "—"; }
const statusNames: Record<string, string> = { pending: "Ожидает", sending: "Отправляется", sent: "Доставлено", failed: "Ошибка" };
const entityNames: Record<string, string> = { order: "Заказ", lead: "Заявка с формы", review_request: "Просьба об отзыве", review: "Новый отзыв" };

export default function AdminNotificationsPage() {
  const router = useRouter();
  const [items, setItems] = useState<NotificationAttempt[]>([]);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [retrying, setRetrying] = useState("");

  async function load() {
    const query = status ? `?status=${encodeURIComponent(status)}` : "";
    const response = await fetch(`/api/admin/notifications${query}`);
    if (response.status === 401) { router.replace("/admin/login"); return; }
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Не удалось загрузить уведомления");
    setItems(payload.items || []);
    setError("");
  }

  useEffect(() => {
    const timer = window.setTimeout(() => { void load().catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Не удалось загрузить уведомления")); }, 0);
    return () => window.clearTimeout(timer);
  }, [status, router]); // eslint-disable-line react-hooks/exhaustive-deps

  async function retry(id: string) {
    setRetrying(id);
    try {
      const response = await fetch(`/api/admin/notifications/${id}/retry`, { method: "POST", headers: { "x-csrf-token": csrfToken() } });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Не удалось повторить отправку");
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось повторить отправку");
    } finally {
      setRetrying("");
    }
  }

  return <section className="admin-page"><div className="admin-page-head"><div><span className="eyebrow">Система</span><h1>Уведомления</h1><p>Состояние доставки email по заказам и заявкам с форм.</p></div></div><div className="admin-toolbar admin-toolbar--compact"><select aria-label="Фильтр по статусу" value={status} onChange={(event) => setStatus(event.target.value)}><option value="">Все статусы</option><option value="pending">Ожидает</option><option value="sending">Отправляется</option><option value="sent">Доставлено</option><option value="failed">Ошибка</option></select></div>{error && <p className="form-error" role="alert">{error}</p>}<div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Время</th><th>Источник</th><th>Тема</th><th>Статус</th><th>Попытки</th><th /></tr></thead><tbody>{items.map((item) => <tr key={item.id}><td>{date(item.created_at)}<small>обновлено {date(item.updated_at)}</small></td><td><strong>{entityNames[item.entity_type] || item.entity_type}</strong><small>#{item.entity_id.slice(0, 8)}</small></td><td>{item.subject || "—"}</td><td><span className={`admin-status status-${item.status}`}>{statusNames[item.status] || item.status}</span>{item.last_error && <small>{item.last_error}</small>}</td><td>{item.attempts}</td><td>{item.status !== "sent" && <button className="button button-secondary" type="button" onClick={() => void retry(item.id)} disabled={retrying === item.id}>{retrying === item.id ? "Повторяем…" : "Повторить"}</button>}</td></tr>)}</tbody></table>{items.length === 0 && !error && <p className="admin-empty">Попыток уведомлений пока нет.</p>}</div></section>;
}
