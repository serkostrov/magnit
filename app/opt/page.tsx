import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "../../components/Breadcrumbs";

export const metadata: Metadata = {
  title: "Опт и дилерам",
  description: "Оптовые поставки неодимовых магнитов для бизнеса и производства.",
  alternates: { canonical: "/opt" },
};

export default function WholesalePage() {
  return (
    <main className="inner-main">
      <section className="section info-page wholesale-page">
        <div className="container">
          <Breadcrumbs items={[{ href: "/", label: "Главная" }, { label: "Опт и дилерам" }]} />
          <span className="eyebrow">Опт и дилерам</span>
          <h1>Магниты для регулярных поставок</h1>
          <p className="info-lead">Соберём спецификацию, проверим типоразмеры и рассчитаем условия под объём.</p>
          <div className="info-grid wholesale-info-grid">
            <article>
              <h2>Что подготовим</h2>
              <ul>
                <li>Сверим артикулы и заменяемость позиций.</li>
                <li>Рассчитаем стоимость партии и упаковки.</li>
                <li>Согласуем документы и способ доставки.</li>
              </ul>
            </article>
            <article>
              <h2>Как начать</h2>
              <p>Отправьте список на <a href="mailto:info@smagn.ru">info@smagn.ru</a> или позвоните <a href="tel:+74951207567">+7 (495) 120-75-67</a>.</p>
              <Link className="button button-primary" href="/catalog">Открыть каталог</Link>
            </article>
          </div>
        </div>
      </section>
    </main>
  );
}
