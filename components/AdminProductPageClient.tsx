"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ExternalLink, Pencil, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { AdminProductCategoryEditor, type AdminProductCategory } from "./AdminProductCategoryEditor";
import { AdminProductForm, productFormPayload } from "./AdminProductForm";
import {
  AdminProductMediaEditor,
  type AdminCharacteristic,
  type AdminCharacteristicDefinition,
  type AdminImage,
} from "./AdminProductMediaEditor";

type Product = Record<string, unknown>;
type LifecycleAction = "publish" | "hide" | "unpublish";

const lifecycleLabels: Record<LifecycleAction, string> = {
  publish: "Опубликовать",
  hide: "Скрыть",
  unpublish: "В черновик",
};

const statusLabels: Record<string, string> = {
  draft: "Черновик",
  published: "Опубликован",
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

function text(product: Product, key: string, fallback = "") {
  return String(product[key] ?? fallback);
}

function productImages(product: Product): AdminImage[] {
  return Array.isArray(product.images)
    ? product.images
        .map((item) => {
          const value = item && typeof item === "object" ? item as Record<string, unknown> : {};
          return {
            id: String(value.id || ""),
            url: String(value.url || ""),
            alt: String(value.alt || ""),
            sort_order: Number(value.sortOrder || value.sort_order || 0),
            is_primary: Boolean(value.isPrimary || value.is_primary),
          };
        })
        .filter((item) => item.id && item.url)
        .sort((left, right) => Number(left.sort_order || 0) - Number(right.sort_order || 0))
    : [];
}

function productCharacteristics(product: Product): AdminCharacteristic[] {
  return Array.isArray(product.characteristics)
    ? product.characteristics
        .map((item) => {
          const value = item && typeof item === "object" ? item as Record<string, unknown> : {};
          return {
            label: String(value.label || ""),
            value: String(value.value || ""),
            confidence: value.confidence == null ? null : Number(value.confidence),
            needsReview: Boolean(value.needsReview || value.needs_review),
          };
        })
        .filter((item) => item.label || item.value)
    : [];
}

function productCharacteristicDefinitions(product: Product): AdminCharacteristicDefinition[] {
  return Array.isArray(product.characteristic_definitions)
    ? product.characteristic_definitions
        .map((item) => {
          const value = item && typeof item === "object" ? item as Record<string, unknown> : {};
          return {
            key: String(value.key || ""),
            label: String(value.label || ""),
            enabled: Boolean(value.enabled),
            sortOrder: Number(value.sortOrder || 0),
            options: Array.isArray(value.options) ? value.options.map(String) : [],
          };
        })
        .filter((item) => item.key && item.label)
    : [];
}

function productCategories(product: Product): AdminProductCategory[] {
  return Array.isArray(product.categories)
    ? product.categories
        .map((item) => {
          const value = item && typeof item === "object" ? item as Record<string, unknown> : {};
          return {
            id: String(value.id || ""),
            slug: String(value.slug || ""),
            title: String(value.title || ""),
            isPrimary: Boolean(value.isPrimary || value.is_primary),
            sortOrder: Number(value.sortOrder || value.sort_order || 0),
          };
        })
        .filter((item) => item.id && item.slug)
    : [];
}

function ProductDescription({ html }: { html: string }) {
  const [safeHtml, setSafeHtml] = useState("");

  useEffect(() => {
    let active = true;
    void import("dompurify").then(({ default: DOMPurify }) => {
      if (active) setSafeHtml(DOMPurify.sanitize(html));
    });
    return () => {
      active = false;
    };
  }, [html]);

  if (!html) return <p className="admin-empty admin-empty--compact">Описание не заполнено.</p>;
  return <div className="admin-product-description" dangerouslySetInnerHTML={{ __html: safeHtml }} />;
}

export function AdminProductPageClient({ productId }: { productId?: string }) {
  const router = useRouter();
  const [resolvedProductId, setResolvedProductId] = useState(productId || "");
  const [product, setProduct] = useState<Product | null>(null);
  const [mode, setMode] = useState<"view" | "edit">(productId ? "view" : "edit");
  const [loading, setLoading] = useState(Boolean(productId));
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lifecycleSaving, setLifecycleSaving] = useState(false);

  async function loadProduct(id: string) {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/products/${id}`);
      if (response.status === 401) {
        router.replace("/admin/login");
        return;
      }
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Не удалось загрузить товар");
      setProduct(payload);
    } catch (reason) {
      setProduct(null);
      setError(reason instanceof Error ? reason.message : "Не удалось загрузить товар");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!productId) return;
    const timer = window.setTimeout(() => void loadProduct(productId), 0);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload = productFormPayload(new FormData(event.currentTarget));
    if (
      product &&
      payload.slug !== text(product, "slug") &&
      !window.confirm(`Изменить публичный URL товара на /catalog/${payload.slug}?`)
    ) return;

    setSaving(true);
    setSaved(false);
    setError("");
    try {
      const response = await fetch(
        resolvedProductId ? `/api/admin/products/${resolvedProductId}` : "/api/admin/products",
        {
          method: resolvedProductId ? "PATCH" : "POST",
          headers: {
            "content-type": "application/json",
            "x-csrf-token": csrfToken(),
          },
          body: JSON.stringify(payload),
        },
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Не удалось сохранить товар");
      const nextId = resolvedProductId || String(result.id);
      setResolvedProductId(nextId);
      if (!resolvedProductId) {
        router.replace(`/admin/products/${nextId}`);
        return;
      }
      await loadProduct(nextId);
      setSaved(true);
      setMode("view");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось сохранить товар");
    } finally {
      setSaving(false);
    }
  }

  async function changeLifecycle(action: LifecycleAction) {
    if (!product || !resolvedProductId || !window.confirm(`${lifecycleLabels[action]} товар?`)) return;
    setLifecycleSaving(true);
    setSaved(false);
    setError("");
    try {
      const response = await fetch(`/api/admin/products/${resolvedProductId}/status`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-csrf-token": csrfToken(),
        },
        body: JSON.stringify({ action }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Не удалось изменить статус");
      setProduct({
        ...product,
        status: result.status,
        published_at: result.publishedAt,
        updated_at: result.updatedAt,
      });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось изменить статус");
    } finally {
      setLifecycleSaving(false);
    }
  }

  async function deleteProduct() {
    if (!product || !resolvedProductId || !window.confirm(`Удалить товар «${text(product, "name")}»? Это действие нельзя отменить.`)) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/products/${resolvedProductId}`, {
        method: "DELETE",
        headers: { "x-csrf-token": csrfToken() },
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Не удалось удалить товар");
      router.replace("/admin/products");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось удалить товар");
      setSaving(false);
    }
  }

  const status = product ? text(product, "status", "draft") : "draft";
  const actions: LifecycleAction[] = status === "published"
    ? ["hide", "unpublish"]
    : status === "hidden"
      ? ["publish", "unpublish"]
      : ["publish"];
  const images = useMemo(() => product ? productImages(product) : [], [product]);
  const characteristics = useMemo(() => product ? productCharacteristics(product) : [], [product]);
  const characteristicDefinitions = useMemo(
    () => product ? productCharacteristicDefinitions(product) : [],
    [product],
  );
  const categories = useMemo(() => product ? productCategories(product) : [], [product]);
  const primaryImage = images.find((image) => image.is_primary || image.isPrimary) || images[0];
  const busy = saving || lifecycleSaving;

  return (
    <section className="admin-page admin-product-page">
      <div className="admin-page-head admin-product-page-head">
        <div>
          <Link className="admin-back-link" href="/admin/products">
            <ArrowLeft size={17} aria-hidden="true" />
            Все товары
          </Link>
          <h1>{product ? text(product, "name") : "Новый товар"}</h1>
        </div>
        {product && (
          <div className="admin-product-page-actions">
            <span className={`admin-status status-${status}`}>{statusLabels[status] || status}</span>
            {mode === "view" ? (
              <button className="button button-primary" type="button" onClick={() => setMode("edit")}>
                <Pencil size={17} aria-hidden="true" />
                Редактировать
              </button>
            ) : (
              <button className="button button-secondary" type="button" onClick={() => setMode("view")} disabled={busy}>
                <X size={17} aria-hidden="true" />
                Отменить
              </button>
            )}
            <Link className="button button-secondary" href={`/catalog/${text(product, "slug")}`} target="_blank">
              <ExternalLink size={17} aria-hidden="true" />
              На сайте
            </Link>
            <button className="button button-danger" type="button" onClick={() => void deleteProduct()} disabled={busy}>
              <Trash2 size={17} aria-hidden="true" />
              Удалить
            </button>
          </div>
        )}
      </div>

      {loading && <p className="admin-drawer-state">Загружаем товар…</p>}
      {!loading && !product && resolvedProductId && <p className="form-error" role="alert">{error || "Товар не найден"}</p>}
      {saved && <p className="form-success admin-save-notice">Изменения сохранены</p>}

      {!loading && mode === "edit" && (!resolvedProductId || product) && (
        <div className="admin-product-editor-stack">
          <AdminProductForm
            key={`${resolvedProductId || "new"}-${product ? text(product, "updated_at") : "empty"}`}
            initial={product || {}}
            onSubmit={submit}
            error={error}
            saving={saving}
            submitLabel={resolvedProductId ? "Сохранить товар" : "Создать товар"}
          >
            {product && resolvedProductId && (
              <>
              <AdminProductCategoryEditor
                key={`${resolvedProductId}-${text(product, "updated_at")}-${text(product, "category_slug")}`}
                initialCategories={categories}
              />
              <AdminProductMediaEditor
                key={`${resolvedProductId}-${text(product, "updated_at")}`}
                productId={resolvedProductId}
                initialImages={images}
                initialCharacteristics={characteristics}
                initialCharacteristicDefinitions={characteristicDefinitions}
              />
              </>
            )}
          </AdminProductForm>
        </div>
      )}

      {!loading && product && mode === "view" && (
        <div className="admin-product-view">
          <section className="admin-product-overview">
            <div className="admin-product-overview-media">
              {primaryImage ? <img src={primaryImage.url} alt={primaryImage.alt || text(product, "name")} /> : <span>Нет изображения</span>}
            </div>
            <dl className="admin-product-facts">
              <div><dt>Цена</dt><dd>{Number(product.price || 0).toLocaleString("ru-RU")} ₽</dd></div>
              <div><dt>Артикул</dt><dd>{text(product, "sku", "—") || "—"}</dd></div>
              <div><dt>Внешний ID</dt><dd>{text(product, "external_id", "—") || "—"}</dd></div>
              <div><dt>Категория</dt><dd>{text(product, "category_title", "—") || "—"}</dd></div>
              <div><dt>Остаток</dt><dd>{product.quantity == null ? "—" : String(product.quantity)}</dd></div>
              <div><dt>Slug</dt><dd>{text(product, "slug")}</dd></div>
            </dl>
          </section>

          <section className="admin-editor-section">
            <h2>Описание</h2>
            <ProductDescription html={text(product, "description_html")} />
          </section>

          <section className="admin-editor-section">
            <h2>Характеристики</h2>
            {characteristics.length ? (
              <dl className="admin-product-characteristics-view">
                {characteristics.map((item, index) => (
                  <div key={`${item.label}-${index}`}><dt>{item.label}</dt><dd>{item.value}</dd></div>
                ))}
              </dl>
            ) : <p className="admin-empty admin-empty--compact">Характеристики не заполнены.</p>}
          </section>

          <div className="admin-product-lifecycle">
            {actions.map((action) => (
              <button
                className={action === "publish" ? "button button-primary" : "button button-secondary"}
                type="button"
                key={action}
                onClick={() => void changeLifecycle(action)}
                disabled={lifecycleSaving}
              >
                {lifecycleLabels[action]}
              </button>
            ))}
          </div>
          {error && <p className="form-error" role="alert">{error}</p>}
        </div>
      )}
    </section>
  );
}
