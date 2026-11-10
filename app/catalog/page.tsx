import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CatalogClient } from "../../components/CatalogClient";
import { CatalogHero } from "../../components/CatalogHero";
import { getCatalogPage } from "../../lib/catalog/publication-service";
import { getCatalogCategories, getCatalogFilterDefinitions } from "../../lib/catalog/service";

export const metadata: Metadata = {
  title: "Каталог неодимовых магнитов",
  description:
    "Каталог неодимовых магнитов с фильтрами по категории, применению, отрасли, характеристикам и цене.",
  alternates: {
    canonical: "/catalog",
  },
};

export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const [categories, filterDefinitions] = await Promise.all([getCatalogCategories(), getCatalogFilterDefinitions()]);
  const value = (key: string) => typeof params[key] === "string" ? params[key] as string : "";
  const rawPage = value("page");
  const parsedPage = Number(rawPage);
  const requestedPage = rawPage && Number.isSafeInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  const characteristicFilters = Object.fromEntries(filterDefinitions.map((filter) => [filter.key, value(filter.key)]).filter(([, selected]) => selected));
  const catalog = await getCatalogPage({
    search: value("search"),
    category: value("category"),
    characteristics: characteristicFilters,
    priceFrom: value("priceFrom") ? Number(value("priceFrom")) : undefined,
    priceTo: value("priceTo") ? Number(value("priceTo")) : undefined,
    sort: (value("sort") || "popular") as "popular" | "new" | "price-asc" | "price-desc",
    page: requestedPage,
    pageSize: 24,
  });
  if (rawPage && String(requestedPage) !== rawPage || (rawPage && requestedPage !== catalog.page)) {
    const canonicalParams = new URLSearchParams();
    for (const [key, rawValue] of Object.entries(params)) {
      if (typeof rawValue === "string" && key !== "page") canonicalParams.set(key, rawValue);
    }
    if (catalog.page > 1) canonicalParams.set("page", String(catalog.page));
    const query = canonicalParams.toString();
    redirect(query ? `/catalog?${query}` : "/catalog");
  }

  return (
    <main className="inner-main">
      <CatalogHero
        title="Неодимовые магниты"
        description="Подберите готовую позицию по форме, размеру и цене. Если нужного типоразмера нет, привезём или изготовим под заказ."
        breadcrumbs={[{ href: "/", label: "Главная" }, { label: "Каталог" }]}
      />

      <section className="section catalog-section">
        <div className="container">
          <CatalogClient
            products={catalog.items}
            total={catalog.total}
            page={catalog.page}
            pageCount={catalog.pageCount}
            initialSearch={value("search")}
            initialCategory={value("category")}
            initialFilters={characteristicFilters}
            initialPriceFrom={value("priceFrom")}
            initialPriceTo={value("priceTo")}
            initialSort={value("sort") || "popular"}
            categories={categories.map((category) => ({ slug: category.slug, title: category.title }))}
            filterDefinitions={filterDefinitions}
          />
        </div>
      </section>

      <section className="section catalog-seo">
        <div className="container catalog-seo-grid">
          <div>
            <span className="eyebrow">Как выбрать</span>
            <h2>Размер — не единственный важный параметр</h2>
          </div>
          <div>
            <p>
              На силу удержания влияют класс магнитного материала, толщина
              ответного металла, зазор, температура и направление нагрузки.
              Паспортная сила указывается для идеальных лабораторных условий.
            </p>
            <p>
              Для упаковки, мебели, оборудования и других ответственных задач
              лучше заложить запас. Опишите условия менеджеру — мы сравним
              несколько типоразмеров и предложим практичный вариант.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
