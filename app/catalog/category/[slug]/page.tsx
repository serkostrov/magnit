import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { CatalogClient } from "../../../../components/CatalogClient";
import { CatalogHero } from "../../../../components/CatalogHero";
import { getCatalogPage } from "../../../../lib/catalog/publication-service";
import { getCatalogCategories, getCatalogFilterDefinitions } from "../../../../lib/catalog/service";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Pick<PageProps, "params">): Promise<Metadata> {
  const { slug } = await params;
  const category = (await getCatalogCategories()).find((item) => item.slug === slug);
  if (!category) return {};
  return {
    title: `${category.title} — каталог магнитов`,
    description: category.description || `${category.title}: цены, размеры и характеристики магнитов.`,
    alternates: { canonical: `/catalog/category/${category.slug}` },
  };
}

export default async function CategoryPage({ params, searchParams }: PageProps) {
  const [{ slug }, queryParams, categories, filterDefinitions] = await Promise.all([
    params,
    searchParams,
    getCatalogCategories(),
    getCatalogFilterDefinitions(),
  ]);
  const category = categories.find((item) => item.slug === slug);
  if (!category) notFound();

  const value = (key: string) =>
    typeof queryParams[key] === "string" ? (queryParams[key] as string) : "";
  const rawPage = value("page");
  const parsedPage = Number(rawPage);
  const requestedPage =
    rawPage && Number.isSafeInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  const characteristicFilters = Object.fromEntries(filterDefinitions.map((filter) => [filter.key, value(filter.key)]).filter(([, selected]) => selected));
  const catalog = await getCatalogPage({
    search: value("search"),
    category: category.slug,
    characteristics: characteristicFilters,
    priceFrom: value("priceFrom") ? Number(value("priceFrom")) : undefined,
    priceTo: value("priceTo") ? Number(value("priceTo")) : undefined,
    sort: (value("sort") || "popular") as "popular" | "new" | "price-asc" | "price-desc",
    page: requestedPage,
    pageSize: 24,
  });

  if (
    (rawPage && String(requestedPage) !== rawPage) ||
    (rawPage && requestedPage !== catalog.page)
  ) {
    const canonicalParams = new URLSearchParams();
    for (const [key, rawValue] of Object.entries(queryParams)) {
      if (typeof rawValue === "string" && key !== "page") canonicalParams.set(key, rawValue);
    }
    if (catalog.page > 1) canonicalParams.set("page", String(catalog.page));
    const nextQuery = canonicalParams.toString();
    const path = `/catalog/category/${category.slug}`;
    redirect(nextQuery ? `${path}?${nextQuery}` : path);
  }

  return (
    <main className="inner-main">
      <CatalogHero
        title={category.title}
        description={category.description || `Товары категории «${category.title}» с ценами и характеристиками.`}
        breadcrumbs={[
          { href: "/", label: "Главная" },
          { href: "/catalog", label: "Каталог" },
          { label: category.title },
        ]}
      />
      <section className="section catalog-section">
        <div className="container">
          <CatalogClient
            products={catalog.items}
            total={catalog.total}
            page={catalog.page}
            pageCount={catalog.pageCount}
            initialSearch={value("search")}
            initialCategory={category.slug}
            initialFilters={characteristicFilters}
            initialPriceFrom={value("priceFrom")}
            initialPriceTo={value("priceTo")}
            initialSort={value("sort") || "popular"}
            categories={categories.map((item) => ({ slug: item.slug, title: item.title }))}
            filterDefinitions={filterDefinitions}
          />
        </div>
      </section>
    </main>
  );
}
