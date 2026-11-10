import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "../../components/Breadcrumbs";
import { CatalogClient } from "../../components/CatalogClient";
import { getAllProducts } from "../../lib/catalog/service";

export const metadata: Metadata = {
  title: "Избранное",
  description: "Сохранённые товары каталога «Сайт Магнитов».",
  robots: {
    index: false,
    follow: true,
  },
};

export const dynamic = "force-dynamic";

export default async function FavoritesPage() {
  const products = await getAllProducts();

  return (
    <main className="inner-main">
      <section className="catalog-hero favorites-hero">
        <div className="container">
          <Breadcrumbs items={[{ href: "/", label: "Главная" }, { label: "Избранное" }]} />
          <div className="catalog-hero-grid">
            <div>
              <span className="eyebrow">Сохранённые товары</span>
              <h1>Избранное</h1>
              <p>
                Здесь собраны товары, которые вы отметили сердечком. Используйте
                фильтры, чтобы быстро найти нужную позицию.
              </p>
            </div>
            <div className="catalog-hero-note">
              <b>Список хранится в браузере</b>
              <span>
                Сохранённые позиции доступны на этом устройстве без регистрации.
              </span>
              <Link href="/catalog">Добавить товары →</Link>
            </div>
          </div>
        </div>
      </section>

      <section className="section catalog-section">
        <div className="container">
          <CatalogClient products={products} favoritesMode />
        </div>
      </section>
    </main>
  );
}
