"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type Review = { id: string; order_id: string; author_name: string; rating: number; body: string; photo_url: string; status: "moderation" | "hidden" | "published"; created_at: string };
const statusNames = { moderation: "На модерации", hidden: "Скрытые", published: "Опубликованные" } as const;

function csrfToken() {
  return document.cookie.split(";").map((part) => part.trim()).find((part) => part.startsWith("site_magnit_csrf="))?.split("=").slice(1).join("=") || "";
}

export default function AdminReviewsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialStatus = searchParams.get("status");
  const [status, setStatus] = useState(initialStatus && initialStatus in statusNames ? initialStatus : "moderation");
  const [items, setItems] = useState<Review[]>([]);
  const [error, setError] = useState("");
  const [savingId, setSavingId] = useState("");

  useEffect(() => {
    fetch(`/api/admin/reviews?status=${encodeURIComponent(status)}`)
      .then(async (response) => {
        if (response.status === 401) { router.replace("/admin/login"); return null; }
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "Не удалось загрузить отзывы");
        return payload;
      })
      .then((payload) => { if (payload) { setItems(payload.items || []); setError(""); } })
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Не удалось загрузить отзывы"));
  }, [status, router]);

  async function changeStatus(id: string, nextStatus: Review["status"]) {
    setSavingId(id);
    setError("");
    try {
      const response = await fetch(`/api/admin/reviews/${id}`, { method: "PATCH", headers: { "content-type": "application/json", "x-csrf-token": csrfToken() }, body: JSON.stringify({ status: nextStatus }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Не удалось обновить отзыв");
      setItems((current) => current.filter((item) => item.id !== id));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось обновить отзыв");
    } finally {
      setSavingId("");
    }
  }

  return (
    <section className="admin-page">
      <div className="admin-page-head"><div><span className="eyebrow">Клиенты</span><h1>Отзывы</h1></div></div>
      <div className="admin-review-tabs" role="tablist" aria-label="Статус отзывов">
        {Object.entries(statusNames).map(([value, label]) => <button className={status === value ? "is-active" : ""} type="button" role="tab" aria-selected={status === value} onClick={() => setStatus(value)} key={value}>{label}</button>)}
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="admin-review-list">
        {items.map((review) => (
          <article className="admin-review-card" key={review.id}>
            <div className="admin-review-card-head"><div><strong>{review.author_name}</strong><span className="admin-review-stars" aria-label={`Оценка ${review.rating} из 5`}>{"★".repeat(review.rating)}<i>{"★".repeat(5 - review.rating)}</i></span></div><small>{new Date(review.created_at).toLocaleString("ru-RU")} · заказ #{review.order_id.slice(0, 8)}</small></div>
            <div className="admin-review-content">{review.photo_url && <a href={review.photo_url} target="_blank" rel="noreferrer"><img src={review.photo_url} alt={`Фотография к отзыву ${review.author_name}`} /></a>}<p>{review.body}</p></div>
            <div className="admin-actions">
              {review.status !== "published" && <button className="button button-primary" type="button" disabled={savingId === review.id} onClick={() => void changeStatus(review.id, "published")}>Опубликовать</button>}
              {review.status !== "hidden" && <button className="button button-secondary" type="button" disabled={savingId === review.id} onClick={() => void changeStatus(review.id, "hidden")}>Скрыть</button>}
              {review.status !== "moderation" && <button className="button button-secondary" type="button" disabled={savingId === review.id} onClick={() => void changeStatus(review.id, "moderation")}>На модерацию</button>}
            </div>
          </article>
        ))}
        {!items.length && !error && <p className="admin-empty">В этом разделе отзывов пока нет.</p>}
      </div>
    </section>
  );
}
