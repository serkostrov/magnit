"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { CART_UPDATED_EVENT, readFavorites } from "../lib/cart";
import type { Product } from "../lib/catalog/types";
import type { CatalogFilterDefinition } from "../lib/catalog/filter-definitions";
import { ProductCard } from "./ProductCard";

const pageSize = 24;

function queryWith(current: URLSearchParams, key: string, value: string) {
  const next = new URLSearchParams(current);
  if (value) next.set(key, value); else next.delete(key);
  next.delete("page");
  return next;
}

export function CatalogClient({
  products,
  total = products.length,
  page = 1,
  pageCount = Math.max(1, Math.ceil(products.length / pageSize)),
  initialSearch = "",
  initialCategory = "",
  initialFilters = {},
  initialPriceFrom = "",
  initialPriceTo = "",
  initialSort = "popular",
  categories = [],
  filterDefinitions = [],
  favoritesMode = false,
}: {
  products: Product[];
  total?: number;
  page?: number;
  pageCount?: number;
  initialSearch?: string;
  initialCategory?: string;
  initialFilters?: Record<string, string>;
  initialPriceFrom?: string;
  initialPriceTo?: string;
  initialSort?: string;
  categories?: Array<{ slug: string; title: string }>;
  filterDefinitions?: CatalogFilterDefinition[];
  favoritesMode?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [favoriteSlugs, setFavoriteSlugs] = useState<string[]>([]);
  const [favoritesLoaded, setFavoritesLoaded] = useState(!favoritesMode);
  const [search, setSearch] = useState(initialSearch);
  const [priceFrom, setPriceFrom] = useState(initialPriceFrom);
  const [priceTo, setPriceTo] = useState(initialPriceTo);
  const categoryOptions = [
    { value: "", label: "Все категории" },
    ...categories.map((category) => ({
      value: category.slug,
      label: category.title,
    })),
  ];

  useEffect(() => {
    const updateFavorites = () => { setFavoriteSlugs(readFavorites()); setFavoritesLoaded(true); };
    updateFavorites();
    window.addEventListener(CART_UPDATED_EVENT, updateFavorites);
    window.addEventListener("storage", updateFavorites);
    return () => { window.removeEventListener(CART_UPDATED_EVENT, updateFavorites); window.removeEventListener("storage", updateFavorites); };
  }, []);

  const favoriteProducts = useMemo(() => favoritesMode ? products.filter((product) => favoriteSlugs.includes(product.slug)) : products, [favoritesMode, favoriteSlugs, products]);
  const visibleProducts = favoritesMode ? favoriteProducts : products;
  const visibleTotal = favoritesMode ? favoriteProducts.length : total;

  function updateRoute(key: string, value: string) {
    const current = new URLSearchParams(window.location.search);
    if (key === "category") {
      current.delete("category");
      current.delete("page");
      const query = current.toString();
      const destination = value
        ? `/catalog/category/${encodeURIComponent(value)}`
        : "/catalog";
      router.push(query ? `${destination}?${query}` : destination);
      return;
    }
    router.push(`${pathname}?${queryWith(current, key, value).toString()}`);
  }

  function resetFilters() {
    setSearch(""); setPriceFrom(""); setPriceTo("");
    router.push(initialCategory ? `/catalog/category/${encodeURIComponent(initialCategory)}` : "/catalog");
  }

  function submitSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    updateRoute("search", search.trim());
  }

  function updatePagination(nextPage: number) {
    const current = new URLSearchParams(window.location.search);
    if (nextPage <= 1) current.delete("page"); else current.set("page", String(nextPage));
    router.push(`${pathname}?${current.toString()}`);
  }

  const emptyTitle = favoritesMode ? "В избранном пока нет товаров" : "По таким параметрам ничего не нашли";
  return (
    <div className="catalog-shell">
      <button className="button button-secondary filters-mobile-button" type="button" onClick={() => setFiltersOpen((value) => !value)}>{filtersOpen ? "Скрыть фильтры" : "Фильтры"}</button>
      <aside className={`catalog-filters ${filtersOpen ? "is-open" : ""}`}>
        <div className="filter-heading"><h2>Фильтры</h2><button type="button" onClick={resetFilters}>Сбросить</button></div>
        <fieldset><legend>Категория</legend>{categoryOptions.map((option) => <label className="radio-row" key={option.value || "all"}><input type="radio" name="category" checked={initialCategory === option.value} onChange={() => updateRoute("category", option.value)} /><span>{option.label}</span></label>)}</fieldset>
        {filterDefinitions.map((filter) => (
          <fieldset key={filter.key}>
            <legend>{filter.label}</legend>
            <label className="radio-row">
              <input type="radio" name={filter.key} checked={!initialFilters[filter.key]} onChange={() => updateRoute(filter.key, "")} />
              <span>Все</span>
            </label>
            {filter.options.map((option) => (
              <label className="radio-row" key={option.slug}>
                <input type="radio" name={filter.key} checked={initialFilters[filter.key] === option.slug} onChange={() => updateRoute(filter.key, option.slug)} />
                <span>{option.value}</span>
              </label>
            ))}
          </fieldset>
        ))}
        <fieldset><legend>Цена, ₽</legend><div className="price-filter"><input inputMode="numeric" placeholder="от" value={priceFrom} onChange={(event) => setPriceFrom(event.target.value)} onBlur={() => updateRoute("priceFrom", priceFrom)} /><span>—</span><input inputMode="numeric" placeholder="до" value={priceTo} onChange={(event) => setPriceTo(event.target.value)} onBlur={() => updateRoute("priceTo", priceTo)} /></div></fieldset>
      </aside>

      <section className="catalog-results" aria-live="polite">
        <div className="catalog-toolbar">
          <form className="catalog-search-top" role="search" onSubmit={submitSearch}><label className="sr-only" htmlFor="catalog-search">Поиск по каталогу</label><input id="catalog-search" type="search" placeholder="Размер, название или артикул" value={search} onChange={(event) => setSearch(event.target.value)} /><button type="submit">Найти</button></form>
          <p>Найдено: <b>{visibleTotal}</b>{!favoritesMode && pageCount > 1 ? <span className="catalog-page-hint"> · страница {page} из {pageCount}</span> : null}</p>
          <label><span>Сортировка</span><select value={initialSort} onChange={(event) => updateRoute("sort", event.target.value)}><option value="popular">Сначала популярные</option><option value="new">Сначала новые</option><option value="price-asc">Сначала дешевле</option><option value="price-desc">Сначала дороже</option></select></label>
        </div>
        {!favoritesLoaded ? <div className="catalog-empty"><h2>Загружаем избранное…</h2></div> : visibleProducts.length > 0 ? <div className="catalog-products">{visibleProducts.map((product) => <ProductCard product={product} key={product.slug} />)}</div> : <div className="catalog-empty"><h2>{emptyTitle}</h2><p>{favoritesMode ? "Добавляйте товары сердечком в каталоге — они появятся на этой странице." : "Сбросьте часть фильтров или оставьте запрос — нестандартную позицию привезём под заказ."}</p>{favoritesMode ? <Link className="button button-primary" href="/catalog">Перейти в каталог</Link> : <button className="button button-primary" type="button" onClick={resetFilters}>Сбросить фильтры</button>}</div>}
        {!favoritesMode && pageCount > 1 && <nav className="pagination" aria-label="Страницы каталога"><button type="button" disabled={page === 1} onClick={() => updatePagination(Math.max(1, page - 1))}>←</button>{Array.from({ length: pageCount }, (_, index) => index + 1).map((number) => <button className={number === page ? "is-active" : ""} type="button" key={number} onClick={() => updatePagination(number)}>{number}</button>)}<button type="button" disabled={page === pageCount} onClick={() => updatePagination(Math.min(pageCount, page + 1))}>→</button></nav>}
      </section>
    </div>
  );
}
