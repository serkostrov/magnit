"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AdminDialog } from "../../../components/AdminDialog";

type Collection = {
  id: string;
  slug: string;
  title: string;
  description: string;
  sortOrder: number;
  isFeatured: boolean;
  productCount: number;
};

type CollectionForm = Omit<Collection, "id" | "productCount">;
type Product = { id: string; name: string; sku?: string; slug: string };

const emptyForm: CollectionForm = {
  slug: "",
  title: "",
  description: "",
  sortOrder: 0,
  isFeatured: false,
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

export default function AdminCollectionsPage() {
  const router = useRouter();
  const [items, setItems] = useState<Collection[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [form, setForm] = useState<CollectionForm>(emptyForm);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const [loadingComposition, setLoadingComposition] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function loadCollections() {
    const response = await fetch("/api/admin/collections");
    if (response.status === 401) {
      router.replace("/admin/login");
      return;
    }
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Не удалось загрузить подборки");
    setItems(payload.items || []);
  }

  async function loadProducts() {
    const response = await fetch("/api/admin/products?pageSize=500");
    if (response.status === 401) {
      router.replace("/admin/login");
      return;
    }
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Не удалось загрузить товары");
    setProducts(
      (payload.items || []).map((item: Record<string, unknown>) => ({
        id: String(item.id),
        name: String(item.name),
        sku: item.sku ? String(item.sku) : "",
        slug: String(item.slug),
      })),
    );
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void Promise.all([loadCollections(), loadProducts()]).catch((reason) =>
        setError(reason instanceof Error ? reason.message : "Не удалось загрузить подборки"),
      );
    }, 0);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  const selectedProducts = selectedProductIds
    .map((id) => products.find((product) => product.id === id))
    .filter((product): product is Product => Boolean(product));

  const matchingProducts = useMemo(() => {
    const search = productSearch.trim().toLocaleLowerCase("ru-RU");
    return products.filter((product) => {
      if (selectedProductIds.includes(product.id)) return false;
      if (!search) return true;
      return `${product.name} ${product.sku || ""} ${product.slug}`
        .toLocaleLowerCase("ru-RU")
        .includes(search);
    });
  }, [productSearch, products, selectedProductIds]);

  function openCreate() {
    setSelectedId("");
    setSelectedProductIds([]);
    setForm(emptyForm);
    setProductSearch("");
    setError("");
    setDialogOpen(true);
  }

  async function openCollection(item: Collection) {
    setSelectedId(item.id);
    setSelectedProductIds([]);
    setForm({
      slug: item.slug,
      title: item.title,
      description: item.description,
      sortOrder: item.sortOrder,
      isFeatured: item.isFeatured,
    });
    setProductSearch("");
    setError("");
    setLoadingComposition(true);
    setDialogOpen(true);
    try {
      const response = await fetch(`/api/admin/collections/${item.id}/products`);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Не удалось загрузить состав подборки");
      setSelectedProductIds(
        (payload.items || [])
          .sort(
            (left: { sortOrder: number }, right: { sortOrder: number }) =>
              left.sortOrder - right.sortOrder,
          )
          .map((product: { id: string }) => product.id),
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось загрузить состав подборки");
    } finally {
      setLoadingComposition(false);
    }
  }

  function closeDialog() {
    if (saving) return;
    setDialogOpen(false);
    setError("");
  }

  function addProduct(id: string) {
    setSelectedProductIds((current) => current.includes(id) ? current : [...current, id]);
  }

  function removeProduct(id: string) {
    setSelectedProductIds((current) => current.filter((value) => value !== id));
  }

  function moveProduct(index: number, direction: -1 | 1) {
    const next = [...selectedProductIds];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setSelectedProductIds(next);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const collectionResponse = await fetch(
        selectedId ? `/api/admin/collections/${selectedId}` : "/api/admin/collections",
        {
          method: selectedId ? "PATCH" : "POST",
          headers: {
            "content-type": "application/json",
            "x-csrf-token": csrfToken(),
          },
          body: JSON.stringify(form),
        },
      );
      const collectionPayload = await collectionResponse.json();
      if (!collectionResponse.ok) {
        throw new Error(collectionPayload.error || "Не удалось сохранить подборку");
      }

      const id = String(collectionPayload.item.id);
      const productsResponse = await fetch(`/api/admin/collections/${id}/products`, {
        method: "PUT",
        headers: {
          "content-type": "application/json",
          "x-csrf-token": csrfToken(),
        },
        body: JSON.stringify({ productIds: selectedProductIds }),
      });
      const productsPayload = await productsResponse.json();
      if (!productsResponse.ok) {
        throw new Error(productsPayload.error || "Не удалось сохранить порядок товаров");
      }

      await loadCollections();
      setDialogOpen(false);
      setSelectedId("");
      setSelectedProductIds([]);
      setForm(emptyForm);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось сохранить подборку");
    } finally {
      setSaving(false);
    }
  }

  async function remove(item: Collection) {
    if (!window.confirm(`Удалить подборку «${item.title}» и её состав?`)) return;
    setError("");
    try {
      const response = await fetch(`/api/admin/collections/${item.id}`, {
        method: "DELETE",
        headers: { "x-csrf-token": csrfToken() },
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Не удалось удалить подборку");
      await loadCollections();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось удалить подборку");
    }
  }

  return (
    <section className="admin-page">
      <div className="admin-page-head">
        <div>
          <span className="eyebrow">Каталог</span>
          <h1>Подборки</h1>
          <p>Маркетинговые группы товаров с ручным порядком на витрине.</p>
        </div>
        <button className="button button-primary" type="button" onClick={openCreate}>
          Новая подборка
        </button>
      </div>

      {error && !dialogOpen && <p className="form-error" role="alert">{error}</p>}

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Подборка</th>
              <th>Товаров</th>
              <th>Порядок</th>
              <th>Главная</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td>
                  <strong>{item.title}</strong>
                  <small>{item.slug}</small>
                </td>
                <td>{item.productCount}</td>
                <td>{item.sortOrder}</td>
                <td>{item.isFeatured ? "Показывается" : "Нет"}</td>
                <td>
                  <div className="admin-actions admin-actions--end">
                    <button
                      className="button button-secondary"
                      type="button"
                      onClick={() => void openCollection(item)}
                    >
                      Настроить
                    </button>
                    <button className="button button-quiet" type="button" onClick={() => void remove(item)}>
                      Удалить
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {items.length === 0 && (
          <p className="admin-empty">Подборок пока нет или PostgreSQL не подключён.</p>
        )}
      </div>

      <AdminDialog
        open={dialogOpen}
        title={selectedId ? "Настроить подборку" : "Новая подборка"}
        description="Сначала заполните параметры, затем найдите и добавьте товары в нужном порядке."
        onClose={closeDialog}
        wide
      >
        <form className="admin-dialog-form" onSubmit={(event) => void save(event)}>
          <div className="admin-form-grid">
            <label>
              Slug
              <input
                value={form.slug}
                onChange={(event) => setForm({ ...form, slug: event.target.value })}
                required
                pattern="[a-z0-9-]+"
              />
            </label>
            <label>
              Название
              <input
                value={form.title}
                onChange={(event) => setForm({ ...form, title: event.target.value })}
                required
              />
            </label>
            <label>
              Порядок
              <input
                type="number"
                min="0"
                value={form.sortOrder}
                onChange={(event) => setForm({ ...form, sortOrder: Number(event.target.value) })}
              />
            </label>
            <label className="admin-checkbox admin-checkbox--bottom">
              <input
                type="checkbox"
                checked={form.isFeatured}
                onChange={(event) => setForm({ ...form, isFeatured: event.target.checked })}
              />
              Показывать на главной
            </label>
            <label className="span-2">
              Описание
              <textarea
                rows={3}
                value={form.description}
                onChange={(event) => setForm({ ...form, description: event.target.value })}
              />
            </label>
          </div>

          <section className="admin-picker-section" aria-labelledby="collection-products-title">
            <div className="admin-section-head">
              <div>
                <h3 id="collection-products-title">Товары подборки</h3>
                <p>Добавляйте товары поиском. Порядок выбранных позиций сохраняется сверху вниз.</p>
              </div>
              <span className="admin-count-badge">Выбрано: {selectedProductIds.length}</span>
            </div>

            {loadingComposition ? (
              <p className="admin-empty">Загружаем состав…</p>
            ) : (
              <div className="admin-product-picker">
                <div className="admin-picker-panel">
                  <div className="admin-picker-panel-head">
                    <h4>Выбранные товары</h4>
                    <span>{selectedProductIds.length}</span>
                  </div>
                  <div className="admin-picker-list">
                    {selectedProducts.map((product, index) => (
                      <div className="admin-picker-row admin-picker-row--selected" key={product.id}>
                        <span className="admin-picker-index">{index + 1}</span>
                        <span>
                          <strong>{product.name}</strong>
                          <small>{product.sku || product.slug}</small>
                        </span>
                        <div className="admin-picker-actions">
                          <button
                            className="admin-icon-button"
                            type="button"
                            aria-label={`Поднять ${product.name}`}
                            onClick={() => moveProduct(index, -1)}
                            disabled={index === 0 || saving}
                          >
                            ↑
                          </button>
                          <button
                            className="admin-icon-button"
                            type="button"
                            aria-label={`Опустить ${product.name}`}
                            onClick={() => moveProduct(index, 1)}
                            disabled={index === selectedProducts.length - 1 || saving}
                          >
                            ↓
                          </button>
                          <button
                            className="admin-text-button"
                            type="button"
                            onClick={() => removeProduct(product.id)}
                            disabled={saving}
                          >
                            Убрать
                          </button>
                        </div>
                      </div>
                    ))}
                    {!selectedProducts.length && (
                      <p className="admin-picker-empty">Пока ничего не выбрано.</p>
                    )}
                  </div>
                </div>

                <div className="admin-picker-panel">
                  <div className="admin-picker-panel-head">
                    <h4>Добавить товары</h4>
                    <span>{matchingProducts.length}</span>
                  </div>
                  <input
                    className="admin-picker-search"
                    type="search"
                    value={productSearch}
                    onChange={(event) => setProductSearch(event.target.value)}
                    placeholder="Название, артикул или slug"
                    aria-label="Поиск товаров для подборки"
                  />
                  <div className="admin-picker-list">
                    {matchingProducts.slice(0, 30).map((product) => (
                      <div className="admin-picker-row" key={product.id}>
                        <span>
                          <strong>{product.name}</strong>
                          <small>{product.sku || product.slug}</small>
                        </span>
                        <button
                          className="button button-secondary"
                          type="button"
                          onClick={() => addProduct(product.id)}
                          disabled={saving}
                        >
                          Добавить
                        </button>
                      </div>
                    ))}
                    {!matchingProducts.length && (
                      <p className="admin-picker-empty">Подходящих товаров нет.</p>
                    )}
                  </div>
                  {matchingProducts.length > 30 && (
                    <p className="admin-picker-hint">Показаны первые 30. Уточните запрос.</p>
                  )}
                </div>
              </div>
            )}
          </section>

          {error && <p className="form-error" role="alert">{error}</p>}

          <div className="admin-dialog-actions">
            <button className="button button-secondary" type="button" onClick={closeDialog} disabled={saving}>
              Отмена
            </button>
            <button className="button button-primary" type="submit" disabled={saving || loadingComposition}>
              {saving ? "Сохраняем…" : selectedId ? "Сохранить подборку" : "Создать подборку"}
            </button>
          </div>
        </form>
      </AdminDialog>
    </section>
  );
}
