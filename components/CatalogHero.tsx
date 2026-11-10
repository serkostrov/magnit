import { Breadcrumbs, type BreadcrumbItem } from "./Breadcrumbs";

export function CatalogHero({
  title,
  description,
  breadcrumbs,
}: {
  title: string;
  description: string;
  breadcrumbs: BreadcrumbItem[];
}) {
  return (
    <section className="catalog-hero">
      <div className="container">
        <Breadcrumbs items={breadcrumbs} />
        <div className="catalog-hero-grid">
          <div>
            <span className="eyebrow">Каталог</span>
            <h1>{title}</h1>
            <p>{description}</p>
          </div>
          <div className="catalog-hero-note">
            <b>Оптовый заказ?</b>
            <span>Пришлите список артикулов — рассчитаем персональную цену от 30 000 ₽.</span>
            <a href="mailto:info@smagn.ru">Отправить список →</a>
          </div>
        </div>
      </div>
    </section>
  );
}
