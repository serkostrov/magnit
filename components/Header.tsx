"use client";

import Link from "next/link";
import {
  FormEvent,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  CART_UPDATED_EVENT,
  readCart,
  readFavorites,
} from "../lib/cart";

type HeaderCategory = { slug: string; title: string };

export function Header({ categories }: { categories: HeaderCategory[] }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [catalogMenuOpen, setCatalogMenuOpen] = useState(false);
  const [search, setSearch] = useState("");
  const catalogButtonRef = useRef<HTMLButtonElement>(null);
  const catalogMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!catalogMenuOpen) return;

    const getMenuItems = () =>
      Array.from(
        catalogMenuRef.current?.querySelectorAll<HTMLElement>(
          '[role="menuitem"]',
        ) ?? [],
      );

    const closeFromOutside = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (
        !catalogButtonRef.current?.contains(target) &&
        !catalogMenuRef.current?.contains(target)
      ) {
        setCatalogMenuOpen(false);
      }
    };

    const handleMenuKeyboard = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setCatalogMenuOpen(false);
        catalogButtonRef.current?.focus();
        return;
      }

      const menu = catalogMenuRef.current;
      if (!menu || !menu.contains(document.activeElement)) return;
      const items = getMenuItems();
      const currentIndex = items.indexOf(document.activeElement as HTMLElement);
      if (items.length === 0 || currentIndex < 0) return;

      let nextIndex = currentIndex;
      if (event.key === "ArrowDown") nextIndex = (currentIndex + 1) % items.length;
      if (event.key === "ArrowUp") nextIndex = (currentIndex - 1 + items.length) % items.length;
      if (event.key === "Home") nextIndex = 0;
      if (event.key === "End") nextIndex = items.length - 1;
      if (nextIndex !== currentIndex) {
        event.preventDefault();
        items[nextIndex]?.focus();
      }
      if (event.key === "Tab") setCatalogMenuOpen(false);
    };

    document.addEventListener("pointerdown", closeFromOutside);
    document.addEventListener("keydown", handleMenuKeyboard);
    getMenuItems()[0]?.focus();

    return () => {
      document.removeEventListener("pointerdown", closeFromOutside);
      document.removeEventListener("keydown", handleMenuKeyboard);
    };
  }, [catalogMenuOpen]);

  const subscribeToStorage = (callback: () => void) => {
    window.addEventListener(CART_UPDATED_EVENT, callback);
    window.addEventListener("storage", callback);
    return () => {
      window.removeEventListener(CART_UPDATED_EVENT, callback);
      window.removeEventListener("storage", callback);
    };
  };

  const cartCount = useSyncExternalStore(
    subscribeToStorage,
    () => readCart().reduce((sum, line) => sum + line.quantity, 0),
    () => 0,
  );
  const favoriteCount = useSyncExternalStore(
    subscribeToStorage,
    () => readFavorites().length,
    () => 0,
  );

  const currentTheme = useSyncExternalStore<"light" | "dark">(
    (callback) => {
      window.addEventListener("themechange", callback);
      return () => window.removeEventListener("themechange", callback);
    },
    (): "light" | "dark" => {
      const value = document.documentElement.dataset.theme;
      return value === "dark" ? "dark" : "light";
    },
    (): "light" | "dark" => "light",
  );

  function toggleTheme() {
    const next =
      document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    window.localStorage.setItem("saitmagnitov-theme", next);
    window.dispatchEvent(new Event("themechange"));
  }

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = search.trim();
    window.location.href = query
      ? `/catalog?search=${encodeURIComponent(query)}`
      : "/catalog";
  }

  return (
    <>
      <div className="topbar site-topbar">
        <div className="container topbar-inner marketplaces-left">
          <nav aria-label="Сервисная навигация">
            <Link href="/opt">Опт и дилерам</Link>
            <Link href="/delivery">Доставка</Link>
            <Link href="/reviews">Отзывы</Link>
          </nav>
          <div className="topbar-marketplaces">
            <a
              className="market-link market-ozon"
              href="https://www.ozon.ru/seller/rumag-3898271/"
              target="_blank"
              rel="noreferrer"
            >
              Ozon
            </a>
            <a
              className="market-link market-wb"
              href="https://www.wildberries.ru/seller/250083964"
              target="_blank"
              rel="noreferrer"
            >
              Wildberries
            </a>
          </div>
        </div>
      </div>

      <header className="site-header">
        <div className="container header-main">
          <Link className="brand" href="/" aria-label="Сайт Магнитов — главная">
            <img
              className="brand-light"
              src="/assets/logo-site-light.webp"
              alt="Сайт Магнитов"
            />
            <img
              className="brand-dark"
              src="/assets/logo-site-dark.webp"
              alt="Сайт Магнитов"
            />
          </Link>

          <button
            className="catalog-button"
            id="header-catalog-button"
            ref={catalogButtonRef}
            type="button"
            aria-haspopup="menu"
            aria-expanded={catalogMenuOpen}
            aria-controls="header-catalog-menu"
            onClick={() => setCatalogMenuOpen((value) => !value)}
          >
            <span className="catalog-button-grid" aria-hidden="true">
              <i />
              <i />
              <i />
              <i />
            </span>
            Каталог
          </button>
          {catalogMenuOpen && (
            <div
              className="header-catalog-menu"
              id="header-catalog-menu"
              ref={catalogMenuRef}
              role="menu"
              aria-labelledby="header-catalog-button"
            >
              <Link href="/catalog" role="menuitem" onClick={() => setCatalogMenuOpen(false)}>
                Все товары
              </Link>
              {categories.map((category) => (
                <Link
                  href={`/catalog/category/${encodeURIComponent(category.slug)}`}
                  role="menuitem"
                  onClick={() => setCatalogMenuOpen(false)}
                  key={category.slug}
                >
                  {category.title}
                </Link>
              ))}
            </div>
          )}

          <form className="header-search" role="search" onSubmit={submitSearch}>
            <label className="sr-only" htmlFor="site-search">
              Поиск по каталогу
            </label>
            <input
              id="site-search"
              type="search"
              placeholder="Название, размер или артикул"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <button type="submit" aria-label="Найти">
              Найти
            </button>
          </form>

          <div className="header-actions">
            <a className="header-phone" href="tel:+74951207567">
              <span>Пн–Пт 8:00–17:00</span>
              +7 (495) 120-75-67
            </a>
            <button
              className="round-action"
              type="button"
              onClick={toggleTheme}
              aria-label="Переключить тему"
              title="Светлая / тёмная тема"
            >
              {currentTheme === "light" ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M21 12.8A8.5 8.5 0 1 1 11.2 3a6.6 6.6 0 0 0 9.8 9.8Z" /></svg> : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="12" cy="12" r="4.5" /><path d="M12 2v2M12 20v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2 12h2M20 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" /></svg>}
            </button>
            <Link
              className="round-action action-with-count"
              href="/favorites"
              aria-label={`Избранное, ${favoriteCount}`}
              title="Избранное"
            >
              ♡
              {favoriteCount > 0 && <b>{favoriteCount}</b>}
            </Link>
            <Link
              className="round-action action-with-count"
              href="/cart"
              aria-label={`Корзина, ${cartCount}`}
              title="Корзина"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
              >
                <path d="M3 4h2l2.1 10.2a2 2 0 0 0 2 1.6h7.9a2 2 0 0 0 2-1.6L20.5 8H6" />
                <circle cx="10" cy="20" r="1" />
                <circle cx="18" cy="20" r="1" />
              </svg>
              {cartCount > 0 && <b>{cartCount}</b>}
            </Link>
            <button
              className="mobile-menu-button"
              type="button"
              aria-expanded={menuOpen}
              aria-controls="mobile-navigation"
              onClick={() => setMenuOpen((value) => !value)}
            >
              {menuOpen ? "Закрыть" : "Меню"}
            </button>
          </div>
        </div>

        <div
          className={`container mobile-navigation ${menuOpen ? "is-open" : ""}`}
          id="mobile-navigation"
        >
          <form className="mobile-search" role="search" onSubmit={submitSearch}>
            <label className="sr-only" htmlFor="mobile-site-search">
              Поиск по каталогу
            </label>
            <input
              id="mobile-site-search"
              type="search"
              placeholder="Название или артикул"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <button type="submit">Найти</button>
          </form>
          <Link href="/catalog" onClick={() => setMenuOpen(false)}>
            Каталог
          </Link>
          <Link href="/#apps" onClick={() => setMenuOpen(false)}>
            По применению
          </Link>
          <Link href="/otrasli" onClick={() => setMenuOpen(false)}>
            По отраслям
          </Link>
          <Link href="/opt" onClick={() => setMenuOpen(false)}>
            Опт и дилерам
          </Link>
          <Link href="/delivery" onClick={() => setMenuOpen(false)}>
            Доставка
          </Link>
          <Link href="/reviews" onClick={() => setMenuOpen(false)}>
            Отзывы
          </Link>
          <button className="mobile-theme-button" type="button" onClick={toggleTheme}>
            Переключить светлую / тёмную тему
          </button>
        </div>
      </header>
    </>
  );
}
