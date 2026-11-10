import type { Metadata } from "next";
import { Breadcrumbs } from "../../components/Breadcrumbs";
import { listPublishedReviews } from "../../lib/reviews/service";
import { reviewInitials } from "../../lib/reviews/validation";
import { yandexReviewsUrl } from "../../lib/reviews/notifications";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Отзывы",
  description: "Отзывы покупателей о магазине «Сайт Магнитов» на сайте, в Яндексе, Ozon и Wildberries.",
  alternates: { canonical: "/reviews" },
};

const marketplaceReviews = [
  { id: "wb-ivan", name: "Иван К.", source: "Wildberries", image: "/assets/rev1.webp", rating: 5, text: "Сила магнитов достаточно для моей задумки. Хватило две штучки для ночника. Я доволен." },
  { id: "ozon-lydia", name: "Lydia K.", source: "Ozon", image: "/assets/rev2.webp", rating: 5, text: "Мощные, прикрепила на штору в ванной, очень удобно." },
  { id: "ozon-vitalina", name: "Виталина Т.", source: "Ozon", image: "/assets/rev3.webp", rating: 5, text: "Все магниты были целые. Магнитятся очень хорошо. Брала для фиксации геотекстиля на металлические грядки." },
  { id: "wb-nikolay", name: "Николай П.", source: "Wildberries", image: "/assets/rev4.webp", rating: 5, text: "Использовал для крепления пластиковой решётки к металлическому каркасу. Рекомендую." },
  { id: "ozon-andrey", name: "Андрей Х.", source: "Ozon", image: "/assets/rev5.webp", rating: 5, text: "Отличные сильные магниты. Брал для закрепления микрофона в мотошлеме." },
  { id: "wb-anna", name: "Анна Н.", source: "Wildberries", image: "/assets/rev6.webp", rating: 5, text: "Доставлены быстро, упаковка целая. Крепкие магниты, покупкой довольна." },
];

export default async function ReviewsPage() {
  const stored = await listPublishedReviews();
  const reviews = [
    ...stored.map((review) => ({ id: String(review.id), name: String(review.author_name), source: "Сайт Магнитов", image: String(review.photo_url || ""), rating: Number(review.rating || 5), text: String(review.body) })),
    ...marketplaceReviews,
  ];
  return (
    <main className="inner-main">
      <section className="section info-page reviews-page">
        <div className="container">
          <Breadcrumbs items={[{ href: "/", label: "Главная" }, { label: "Отзывы" }]} />
          <span className="eyebrow">Отзывы</span>
          <h1>Отзывы покупателей</h1>
          <div className="reviews-page-grid">
            {reviews.map((review) => (
              <article className="reviews-page-card" key={review.id}>
                <div className="reviews-page-author">
                  {review.image ? <img src={review.image} alt="" /> : <span className="reviews-page-initials" aria-hidden="true">{reviewInitials(review.name)}</span>}
                  <div><strong>{review.name}</strong><span>{review.source}</span></div>
                </div>
                <div className="reviews-page-stars" aria-label={`Оценка ${review.rating} из 5`}>{"★".repeat(review.rating)}<span>{"★".repeat(5 - review.rating)}</span></div>
                <p>{review.text}</p>
              </article>
            ))}
          </div>
          <div className="reviews-market-links">
            <a className="button button-primary" href={yandexReviewsUrl} target="_blank" rel="noreferrer">Отзывы в Яндексе ↗</a>
            <a className="button button-secondary" href="https://www.ozon.ru/seller/rumag-3898271/" target="_blank" rel="noreferrer">Отзывы на Ozon ↗</a>
            <a className="button button-secondary" href="https://www.wildberries.ru/seller/250083964" target="_blank" rel="noreferrer">Отзывы на Wildberries ↗</a>
          </div>
        </div>
      </section>
    </main>
  );
}
