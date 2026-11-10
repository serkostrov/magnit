"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { AdminDialog } from "./AdminDialog";
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
    ? product.characteristic_definitions.map((item) => {
        const value = item && typeof item === "object" ? item as Record<string, unknown> : {};
        return {
          key: String(value.key || ""),
          label: String(value.label || ""),
          enabled: Boolean(value.enabled),
          sortOrder: Number(value.sortOrder || 0),
          options: Array.isArray(value.options) ? value.options.map(String) : [],
        };
      }).filter((item) => item.key && item.label)
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

export function AdminProductDrawer({
  open,
  productId,
  onClose,
  onChanged,
}: {
  open: boolean;
  productId?: string;
  onClose: () => void;
  onChanged?: () => void;
}) {
  const router = useRouter();
  const [resolvedProductId, setResolvedProductId] = useState(productId || "");
  const [product, setProduct] = useState<Product | null>(null);
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
    if (!open) return;
    const timer = window.setTimeout(() => {
      setSaved(false);
      setError("");
      setResolvedProductId(productId || "");
      setProduct(null);
      if (productId) {
        void loadProduct(productId);
      } else {
        setLoading(false);
      }
    }, 0);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, productId]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload = productFormPayload(new FormData(event.currentTarget));
    if (
      product &&
      payload.slug !== text(product, "slug") &&
      !window.confirm(`Изменить публичный URL товара на /catalog/${payload.slug}?`)
    ) {
      return;
    }

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
      await loadProduct(nextId);
      setSaved(true);
      onChanged?.();
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
      onChanged?.();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось изменить статус");
    } finally {
      setLifecycleSaving(false);
    }
  }

  const status = product ? text(product, "status", "draft") : "draft";
  const actions: LifecycleAction[] = status === "published"
    ? ["hide", "unpublish"]
    : status === "hidden"
      ? ["publish", "unpublish"]
      : ["publish"];
  const busy = saving || lifecycleSaving;

  return (
    <AdminDialog
      open={open}
      title={product ? text(product, "name") : resolvedProductId ? "Редактирование товара" : "Новый товар"}
      description={product ? `Slug: ${text(product, "slug")}` : "Заполните карточку; изображения и характеристики появятся после первого сохранения."}
      onClose={() => {
        if (!busy) onClose();
      }}
      wide
    >
      {loading && <p className="admin-drawer-state">Загружаем товар…</p>}

      {!loading && !product && resolvedProductId && (
        <p className="form-error" role="alert">{error || "Товар не найден"}</p>
      )}

      {!loading && (!resolvedProductId || product) && (
        <div className="admin-product-drawer-stack">
          {product && (
            <div className="admin-product-summary">
              <span className={`admin-status status-${status}`}>{statusLabels[status] || status}</span>
              <div className="admin-product-summary-actions">
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
                <Link className="button button-secondary" href={`/catalog/${text(product, "slug")}`} target="_blank">
                  На сайте ↗
                </Link>
              </div>
            </div>
          )}

          {saved && <p className="form-success admin-save-notice">Изменения сохранены</p>}

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
                initialCategories={productCategories(product)}
              />
              <AdminProductMediaEditor
                productId={resolvedProductId}
                initialImages={productImages(product)}
                initialCharacteristics={productCharacteristics(product)}
                initialCharacteristicDefinitions={productCharacteristicDefinitions(product)}
              />
              </>
            )}
          </AdminProductForm>
        </div>
      )}
    </AdminDialog>
  );
}
