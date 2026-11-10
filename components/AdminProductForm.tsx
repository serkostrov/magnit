import type { FormEvent, ReactNode } from "react";
import { AdminRichTextEditor } from "./AdminRichTextEditor";

export function productFormPayload(form: FormData) {
  const field = (key: string) => form.get(key) || "";
  const json = <T,>(key: string, fallback: T): T => {
    try {
      return JSON.parse(String(field(key))) as T;
    } catch {
      return fallback;
    }
  };
  return {
    name: field("name"),
    slug: field("slug"),
    sku: field("sku"),
    price: field("price"),
    oldPrice: field("oldPrice"),
    form: field("form"),
    categorySlug: field("categorySlug"),
    categoryTitle: field("categoryTitle"),
    imageUrl: field("imageUrl"),
    gallery: String(field("gallery"))
      .split(/\n|,/)
      .map((value) => value.trim())
      .filter(Boolean),
    shortName: field("shortName"),
    shortDescription: field("shortDescription"),
    descriptionHtml: field("descriptionHtml"),
    seoTitle: field("seoTitle"),
    seoDescription: field("seoDescription"),
    status: field("status"),
    quantity: field("quantity"),
    primaryCategoryId: String(field("primaryCategoryId")),
    additionalCategoryIds: json<string[]>("additionalCategoryIds", []),
    characteristics: json<Array<{
      label: string;
      value: string;
      confidence?: number | null;
      needsReview?: boolean;
    }>>("characteristicsJson", []),
  };
}

export function AdminProductForm({
  onSubmit,
  error,
  saving,
  submitLabel,
  initial = {},
  children,
}: {
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  error: string;
  saving: boolean;
  submitLabel: string;
  initial?: Record<string, unknown>;
  children?: ReactNode;
}) {
  const value = (key: string, fallback = "") => String(initial[key] ?? fallback);
  const images = Array.isArray(initial.images)
    ? initial.images
        .map((item) =>
          item && typeof item === "object"
            ? String((item as Record<string, unknown>).url || "")
            : "",
        )
        .filter(Boolean)
    : [];
  const imageUrl = value("imageUrl", value("image_url", images[0] || ""));
  const gallery = images.length ? images.join("\n") : value("gallery");
  return (
    <form className="admin-form admin-product-form" onSubmit={onSubmit}>
      <section className="admin-form-section">
        <div className="admin-form-section-head">
          <h3>Основные данные</h3>
        </div>
        <div className="admin-form-grid">
          {Boolean(initial.external_id) && (
            <label>
              Внешний ID
              <input value={value("external_id")} readOnly />
            </label>
          )}
          <label className={initial.external_id ? "" : "span-2"}>
            Название
            <input name="name" defaultValue={value("name")} required />
          </label>
          <label className="span-2">
            Slug
            <input name="slug" defaultValue={value("slug")} required pattern="[a-z0-9-]+" />
          </label>
          <label>
            Артикул
            <input name="sku" defaultValue={value("sku")} />
          </label>
          <input type="hidden" name="form" value={value("form", "Диск")} />
          <label>
            Цена, ₽
            <input name="price" type="number" min="0" step="0.01" defaultValue={value("price", "0")} required />
          </label>
          <label>
            Старая цена
            <input name="oldPrice" type="number" min="0" step="0.01" defaultValue={value("oldPrice", value("old_price"))} />
          </label>
          <label>
            Статус
            <select name="status" defaultValue={value("status", "draft")}>
              <option value="draft">Черновик</option>
              <option value="published">Опубликован</option>
              <option value="hidden">Скрыт</option>
            </select>
          </label>
          <label>
            Количество
            <input name="quantity" type="number" min="0" defaultValue={value("quantity")} />
          </label>
          <input type="hidden" name="categorySlug" value={value("category_slug", "diski")} />
          <input type="hidden" name="categoryTitle" value={value("category_title", "Диски и цилиндры")} />
        </div>
      </section>

      <section className="admin-form-section">
        <div className="admin-form-section-head">
          <h3>Описание</h3>
        </div>
        <div className="admin-form-grid">
          <label>
            Короткое название
            <input name="shortName" defaultValue={value("short_name", value("name"))} />
          </label>
          <label>
            SEO title
            <input name="seoTitle" defaultValue={value("seo_title")} />
          </label>
          <label className="span-2">
            Короткое описание
            <textarea name="shortDescription" rows={3} defaultValue={value("short_description")} />
          </label>
          <div className="span-2 admin-rich-editor-field">
            <span>Полное описание</span>
            <AdminRichTextEditor name="descriptionHtml" initialHtml={value("description_html")} />
          </div>
          <label className="span-2">
            SEO description
            <textarea name="seoDescription" rows={3} defaultValue={value("seo_description")} />
          </label>
        </div>
      </section>

      {children}

      <input type="hidden" name="imageUrl" value={imageUrl} />
      <input type="hidden" name="gallery" value={gallery} />

      {error && <p className="form-error" role="alert">{error}</p>}

      <div className="admin-form-actions">
        <button className="button button-primary" type="submit" disabled={saving}>
          {saving ? "Сохраняем…" : submitLabel}
        </button>
      </div>
    </form>
  );
}
