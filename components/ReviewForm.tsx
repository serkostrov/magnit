"use client";

import Link from "next/link";
import { useState } from "react";

export function ReviewForm({ token, orderNumber }: { token: string; orderNumber: string }) {
  const [rating, setRating] = useState(5);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSending(true);
    setError("");
    try {
      const formData = new FormData(event.currentTarget);
      formData.set("rating", String(rating));
      formData.set("token", token);
      const response = await fetch("/api/reviews", { method: "POST", body: formData });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Не удалось отправить отзыв");
      setSent(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось отправить отзыв");
    } finally {
      setSending(false);
    }
  }

  if (sent) {
    return (
      <div className="review-form-card review-form-success" role="status">
        <div className="review-success-mark">✓</div>
        <h1>Спасибо за отзыв!</h1>
        <p>Он отправлен на модерацию.</p>
        <Link className="button button-primary" href="/reviews">Перейти к отзывам</Link>
      </div>
    );
  }

  return (
    <form className="review-form-card" onSubmit={submit}>
      <span className="eyebrow">Заказ №{orderNumber}</span>
      <h1>Оставьте отзыв</h1>
      <fieldset className="review-rating-field">
        <legend>Ваша оценка</legend>
        <div className="review-rating-buttons" role="radiogroup" aria-label="Оценка от 1 до 5">
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              className={value <= rating ? "is-active" : ""}
              type="button"
              role="radio"
              aria-checked={rating === value}
              aria-label={`${value} из 5`}
              onClick={() => setRating(value)}
              key={value}
            >★</button>
          ))}
        </div>
      </fieldset>
      <label>
        Имя и фамилия
        <input name="authorName" autoComplete="name" maxLength={160} required />
      </label>
      <label>
        Отзыв
        <textarea name="body" rows={7} minLength={10} maxLength={4000} required />
      </label>
      <label>
        Фотография <span className="review-optional">необязательно</span>
        <input name="photo" type="file" accept="image/jpeg,image/png,image/webp" />
      </label>
      <label className="review-consent">
        <input name="consent" type="checkbox" value="true" required />
        <span>Согласен на обработку и публикацию отзыва, имени и загруженной фотографии согласно <Link href="/privacy" target="_blank">политике конфиденциальности</Link></span>
      </label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="button button-primary" type="submit" disabled={sending}>{sending ? "Отправляем…" : "Отправить отзыв"}</button>
    </form>
  );
}
