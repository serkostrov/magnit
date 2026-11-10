"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ExternalLink, Pencil, Plus, Trash2 } from "lucide-react";

type ProductRow = {
  id: string;
  external_id?: string;
  slug: string;
  sku?: string;
  name: string;
  price: number | string;
  status?: string;
  quantity?: number | null;
  category_title?: string;
  updated_at?: string;
};

type CategoryOption = { slug: string; title: string };
type BulkCategoryResult = {
  changedCount: number;
  unchangedCount: number;
  primarySkippedCount: number;
};
type ProductFilters = {
  search: string;
  status: string;
  category: string;
  characteristic: string;
};

const statusNames: Record<string, string> = {
  published: "Опубликован",
  draft: "Черновик",
  hidden: "Скрыт",
};

function csrfToken() {
  return document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("site_magnit_csrf="))
    ?.split("=")
    .slice(1)
    .join("=") || "";
}

export default function AdminProductsPage() {
  const router = useRouter();
  const [items, setItems] = useState<ProductRow[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [category, setCategory] = useState("");
  const [characteristic, setCharacteristic] = useState("");
  const [characteristicLabel, setCharacteristicLabel] = useState("");
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkCategory, setBulkCategory] = useState("");
  const [bulkSaving, setBulkSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const selectAllRef = useRef<HTMLInputElement>(null);

  async function load(
    nextPage = page,
    filters: ProductFilters = { search, status, category, characteristic },
  ) {
    setLoading(true);
    setError("");
    setNotice("");
    try {
      const query = new URLSearchParams();
      if (filters.search.trim()) query.set("search", filters.search.trim());
      if (filters.status) query.set("status", filters.status);
      if (filters.category) query.set("category", filters.category);
      if (filters.characteristic) query.set("characteristic", filters.characteristic);
      query.set("page", String(nextPage));

      const response = await fetch(`/api/admin/products?${query}`);
      if (response.status === 401) {
        router.replace("/admin/login");
        return;
      }
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Не удалось загрузить каталог");
      setItems(payload.items || []);
      setSelectedIds([]);
      setCategories(payload.categories || []);
      setPage(payload.page || nextPage);
      setPageCount(payload.pageCount || 1);
      setTotal(payload.total || 0);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось загрузить каталог");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const initialFilters: ProductFilters = {
      search: query.get("search") || "",
      status: query.get("status") || "",
      category: query.get("category") || "",
      characteristic: query.get("characteristic") || "",
    };
    const timer = window.setTimeout(() => {
      setSearch(initialFilters.search);
      setStatus(initialFilters.status);
      setCategory(initialFilters.category);
      setCharacteristic(initialFilters.characteristic);
      setCharacteristicLabel(query.get("characteristicLabel") || "");
      void load(1, initialFilters);
    }, 0);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void load(1);
  }

  function resetFilters() {
    const emptyFilters = { search: "", status: "", category: "", characteristic: "" };
    setSearch("");
    setStatus("");
    setCategory("");
    setCharacteristic("");
    setCharacteristicLabel("");
    window.history.replaceState(null, "", "/admin/products");
    void load(1, emptyFilters);
  }

  function changePage(nextPage: number) {
    if (nextPage < 1 || nextPage > pageCount) return;
    void load(nextPage);
  }

  async function deleteProduct(item: ProductRow) {
    if (!window.confirm(`Удалить товар «${item.name}»? Это действие нельзя отменить.`)) return;
    setError("");
    try {
      const response = await fetch(`/api/admin/products/${item.id}`, {
        method: "DELETE",
        headers: { "x-csrf-token": csrfToken() },
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Не удалось удалить товар");
      await load(items.length === 1 && page > 1 ? page - 1 : page);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось удалить товар");
    }
  }

  function toggleProduct(id: string, checked: boolean) {
    setSelectedIds((current) => checked
      ? [...new Set([...current, id])]
      : current.filter((selectedId) => selectedId !== id));
  }

  function toggleAllProducts(checked: boolean) {
    setSelectedIds(checked ? items.map((item) => item.id) : []);
  }

  async function applyBulkCategory(action: "add" | "remove") {
    if (!selectedIds.length) {
      setError("Выберите товары");
      return;
    }
    if (!bulkCategory) {
      setError("Выберите категорию");
      return;
    }

    setBulkSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/admin/products/bulk-categories", {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          "x-csrf-token": csrfToken(),
        },
        body: JSON.stringify({ productIds: selectedIds, categorySlug: bulkCategory, action }),
      });
      const payload = await response.json() as BulkCategoryResult & { error?: string };
      if (!response.ok) throw new Error(payload.error || "Не удалось изменить категории товаров");

      const categoryTitle = categories.find((item) => item.slug === bulkCategory)?.title || bulkCategory;
      const parts = [
        action === "add"
          ? `Категория «${categoryTitle}» добавлена к товарам: ${payload.changedCount}.`
          : `Категория «${categoryTitle}» удалена у товаров: ${payload.changedCount}.`,
      ];
      if (payload.unchangedCount > 0) parts.push(`Без изменений: ${payload.unchangedCount}.`);
      if (payload.primarySkippedCount > 0) {
        parts.push(`Не удалена как основная категория: ${payload.primarySkippedCount}.`);
      }

      await load(page);
      setNotice(parts.join(" "));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось изменить категории товаров");
    } finally {
      setBulkSaving(false);
    }
  }

  const allProductsSelected = items.length > 0 && items.every((item) => selectedIds.includes(item.id));

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = selectedIds.length > 0 && !allProductsSelected;
    }
  }, [allProductsSelected, selectedIds.length]);

  const hasFilters = Boolean(search || status || category || characteristic);

  return (
    <section className="admin-page">
      <div className="admin-page-head">
        <div>
          <span className="eyebrow">Админка</span>
          <h1>Каталог товаров</h1>
        </div>
        <Link className="button button-primary" href="/admin/products/new">
          <Plus size={18} aria-hidden="true" />
          Добавить товар
        </Link>
      </div>

      <form className="admin-toolbar admin-toolbar--catalog" onSubmit={submit} role="search">
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Название, артикул или внешний ID"
          aria-label="Поиск по каталогу"
        />
        <select
          aria-label="Фильтр по статусу"
          value={status}
          onChange={(event) => setStatus(event.target.value)}
        >
          <option value="">Все статусы</option>
          <option value="published">Опубликован</option>
          <option value="draft">Черновик</option>
          <option value="hidden">Скрыт</option>
        </select>
        <select
          aria-label="Фильтр по категории"
          value={category}
          onChange={(event) => setCategory(event.target.value)}
        >
          <option value="">Все категории</option>
          {categories.map((item) => (
            <option value={item.slug} key={item.slug}>{item.title}</option>
          ))}
        </select>
        <button className="button button-primary" type="submit" disabled={loading}>
          {loading ? "Ищем…" : "Найти"}
        </button>
        {hasFilters && (
          <button className="button button-quiet" type="button" onClick={resetFilters} disabled={loading}>
            Сбросить
          </button>
        )}
      </form>

      <div className="admin-list-meta" aria-live="polite">
        <span>Найдено товаров: <strong>{total}</strong></span>
        {characteristic && (
          <span>Характеристика: <strong>{characteristicLabel || characteristic}</strong></span>
        )}
        {pageCount > 1 && <span>Страница {page} из {pageCount}</span>}
      </div>

      {selectedIds.length > 0 && (
        <div className="admin-toolbar admin-toolbar--bulk" aria-label="Массовое изменение категорий">
          <strong>Выбрано: {selectedIds.length}</strong>
          <select
            aria-label="Категория для выбранных товаров"
            value={bulkCategory}
            onChange={(event) => setBulkCategory(event.target.value)}
            disabled={loading || bulkSaving}
          >
            <option value="">Выберите категорию</option>
            {categories.map((item) => (
              <option value={item.slug} key={item.slug}>{item.title}</option>
            ))}
          </select>
          <button
            className="button button-primary"
            type="button"
            onClick={() => void applyBulkCategory("add")}
            disabled={loading || bulkSaving || !bulkCategory}
          >
            {bulkSaving ? "Сохраняем…" : "Добавить в категорию"}
          </button>
          <button
            className="button button-secondary"
            type="button"
            onClick={() => void applyBulkCategory("remove")}
            disabled={loading || bulkSaving || !bulkCategory}
          >
            Убрать из категории
          </button>
          <button
            className="button button-quiet"
            type="button"
            onClick={() => setSelectedIds([])}
            disabled={loading || bulkSaving}
          >
            Снять выделение
          </button>
        </div>
      )}

      {notice && <p className="form-success" role="status">{notice}</p>}
      {error && <p className="form-error" role="alert">{error}</p>}

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th className="admin-select-cell">
                <input
                  ref={selectAllRef}
                  type="checkbox"
                  checked={allProductsSelected}
                  onChange={(event) => toggleAllProducts(event.target.checked)}
                  disabled={loading || items.length === 0 || bulkSaving}
                  aria-label="Выбрать все товары на странице"
                />
              </th>
              <th>Товар</th>
              <th>Артикул</th>
              <th>Внешний ID</th>
              <th>Категория</th>
              <th>Цена</th>
              <th>Статус</th>
              <th>Остаток</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const itemStatus = item.status || "published";
              return (
                <tr className={selectedIds.includes(item.id) ? "is-selected" : undefined} key={item.id}>
                  <td className="admin-select-cell">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(item.id)}
                      onChange={(event) => toggleProduct(item.id, event.target.checked)}
                      disabled={loading || bulkSaving}
                      aria-label={`Выбрать товар ${item.name}`}
                    />
                  </td>
                  <td>
                    <Link className="admin-product-name" href={`/admin/products/${item.id}`}>
                      <strong>{item.name}</strong><small>{item.slug}</small>
                    </Link>
                  </td>
                  <td>{item.sku || "—"}</td>
                  <td>{item.external_id || "—"}</td>
                  <td>{item.category_title || "—"}</td>
                  <td>{Number(item.price).toLocaleString("ru-RU")} ₽</td>
                  <td>
                    <span className={`admin-status status-${itemStatus}`}>
                      {statusNames[itemStatus] || itemStatus}
                    </span>
                  </td>
                  <td>{item.quantity ?? "—"}</td>
                  <td>
                    <div className="admin-table-actions">
                      <Link
                        className="admin-icon-action"
                        href={`/admin/products/${item.id}`}
                        aria-label={`Открыть товар ${item.name}`}
                        title="Открыть товар"
                      >
                        <Pencil size={17} aria-hidden="true" />
                      </Link>
                      <Link
                        className="admin-icon-action"
                        href={`/catalog/${item.slug}`}
                        target="_blank"
                        aria-label={`Открыть ${item.name} на сайте`}
                        title="Открыть на сайте"
                      >
                        <ExternalLink size={17} aria-hidden="true" />
                      </Link>
                      <button
                        className="admin-icon-action is-danger"
                        type="button"
                        aria-label={`Удалить товар ${item.name}`}
                        title="Удалить товар"
                        onClick={() => void deleteProduct(item)}
                      >
                        <Trash2 size={17} aria-hidden="true" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!loading && items.length === 0 && (
          <p className="admin-empty">Товары по выбранным условиям не найдены.</p>
        )}
      </div>

      {pageCount > 1 && (
        <nav className="pagination" aria-label="Пагинация каталога">
          <button
            type="button"
            onClick={() => changePage(page - 1)}
            disabled={page <= 1 || loading}
            aria-label="Предыдущая страница"
          >
            ←
          </button>
          <span aria-current="page">{page} из {pageCount}</span>
          <button
            type="button"
            onClick={() => changePage(page + 1)}
            disabled={page >= pageCount || loading}
            aria-label="Следующая страница"
          >
            →
          </button>
        </nav>
      )}

    </section>
  );
}
