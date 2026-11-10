import type { Metadata } from "next";
import Link from "next/link";
import { ReviewForm } from "../../../components/ReviewForm";
import { getReviewRequestState } from "../../../lib/reviews/service";
import { yandexReviewsUrl } from "../../../lib/reviews/notifications";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Оставить отзыв",
  robots: { index: false, follow: false },
};

export default async function NewReviewPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token = "" } = await searchParams;
  const state = await getReviewRequestState(token);
  return (
    <main className="inner-main review-form-page">
      <section className="section">
        <div className="container review-form-container">
          {state && !state.expired && !state.submitted ? (
            <ReviewForm token={token} orderNumber={state.orderNumber} />
          ) : (
            <div className="review-form-card review-form-invalid">
              <h1>{state?.submitted ? "Отзыв уже отправлен" : "Ссылка недействительна"}</h1>
              <p>{state?.submitted ? "Спасибо — ваш отзыв уже находится на модерации." : "Срок действия ссылки истёк или она была скопирована не полностью."}</p>
              <div className="review-form-actions">
                <a className="button button-primary" href={yandexReviewsUrl} target="_blank" rel="noreferrer">Оставить отзыв в Яндексе ↗</a>
                <Link className="button button-secondary" href="/">На главную</Link>
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
