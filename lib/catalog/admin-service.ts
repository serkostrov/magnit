import { unlink } from "node:fs/promises";
import { isDatabaseConfigured, query, withTransaction } from "../db/client";
import { products as demoProducts } from "./products";
import { cleanProductSummary, sanitizeProductHtml } from "./html";
import type { Product, ProductStatus } from "./types";
import { cleanText } from "../forms/validation";
import { recordAdminAudit } from "../audit/service";
import { mediaFilePath, mediaPublicBase } from "../media/storage";
import { listAdminCharacteristicDefinitions } from "./characteristic-definition-service";

const adminProductStatuses = new Set<ProductStatus>(["draft", "published", "hidden"]);

export const adminProductStatusTransitions: Readonly<Record<ProductStatus, readonly ProductStatus[]>> = {
  draft: ["draft", "published"],
  published: ["published", "hidden", "draft"],
  hidden: ["hidden", "published", "draft"],
};

export type AdminProductInput = {
  name: string;
  slug: string;
  sku: string;
  shortName: string;
  shortDescription: string;
  descriptionHtml: string;
  seoTitle: string;
  seoDescription: string;
  price: number;
  oldPrice: number | null;
  form: string;
  categorySlug: string;
  categoryTitle: string;
  imageUrl: string;
  gallery: string[];
  status: string;
  quantity: number | null;
  characteristics: Array<{ label: string; value: string }>;
};

export type AdminProductFilters = {
  search?: string;
  status?: string;
  categorySlug?: string;
  characteristicKey?: string;
  page?: number;
  pageSize?: number;
};

export type AdminProductCategory = { slug: string; title: string };

export type AdminProductListResult = {
  items: Array<Record<string, unknown> | Product>;
  total: number;
  page: number;
  pageCount: number;
  categories: AdminProductCategory[];
  demo?: boolean;
};

export class AdminProductNotFoundError extends Error {
  constructor() {
    super("NOT_FOUND");
    this.name = "AdminProductNotFoundError";
  }
}

export class AdminProductStatusTransitionError extends Error {
  readonly from: string;
  readonly to: string;

  constructor(from: string, to: string) {
    super(`Invalid product status transition: ${from} -> ${to}`);
    this.name = "AdminProductStatusTransitionError";
    this.from = from;
    this.to = to;
  }
}

export function isAdminCatalogDatabaseConfigured() {
  return isDatabaseConfigured();
}

export function isAdminProductStatus(value: string): value is ProductStatus {
  return adminProductStatuses.has(value as ProductStatus);
}

export function canTransitionAdminProductStatus(from: string, to: string) {
  if (!isAdminProductStatus(from) || !isAdminProductStatus(to)) return false;
  return adminProductStatusTransitions[from].includes(to);
}

export function parseAdminProductInput(body: Record<string, unknown>): AdminProductInput {
  const name = cleanText(body.name, 240);
  const slug = cleanText(body.slug, 120).toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-|-$/g, "");
  const price = Number(body.price);
  const status = cleanText(body.status, 20) || "draft";
  const characteristics = Array.isArray(body.characteristics)
    ? body.characteristics
      .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"))
      .map((item) => ({ label: cleanText(item.label, 120), value: cleanText(item.value, 240) }))
      .filter((item) => item.label && item.value)
    : [];
  const gallery = Array.isArray(body.gallery)
    ? body.gallery.map((item) => cleanText(item, 500)).filter(Boolean).slice(0, 30)
    : [];
  return {
    name,
    slug,
    sku: cleanText(body.sku, 80),
    shortName: cleanText(body.shortName, 240) || name,
    shortDescription: cleanProductSummary(cleanText(body.shortDescription, 500)),
    descriptionHtml: sanitizeProductHtml(cleanText(body.descriptionHtml, 30_000)),
    seoTitle: cleanText(body.seoTitle, 240),
    seoDescription: cleanText(body.seoDescription, 500),
    price,
    oldPrice: body.oldPrice == null || body.oldPrice === "" ? null : Number(body.oldPrice),
    form: cleanText(body.form, 60) || "Диск",
    categorySlug: cleanText(body.categorySlug, 120) || "diski",
    categoryTitle: cleanText(body.categoryTitle, 160) || "Диски и цилиндры",
    imageUrl: cleanText(body.imageUrl, 500) || gallery[0] || "",
    gallery,
    status,
    quantity: body.quantity == null || body.quantity === "" ? null : Number(body.quantity),
    characteristics,
  };
}

export function isValidAdminProductInput(input: AdminProductInput) {
  return Boolean(input.name && input.slug && /^[a-z0-9-]+$/.test(input.slug) && input.form && input.categorySlug && input.categoryTitle && isAdminProductStatus(input.status) && Number.isFinite(input.price) && input.price >= 0 && (input.oldPrice == null || Number.isFinite(input.oldPrice)) && (input.quantity == null || Number.isInteger(input.quantity)));
}

export async function listAdminProducts(filters: AdminProductFilters = {}): Promise<AdminProductListResult> {
  const search = filters.search?.trim() || "";
  const status = filters.status || "";
  const categorySlug = filters.categorySlug?.trim() || "";
  const characteristicKey = filters.characteristicKey?.trim() || "";
  const requestedPage = Math.max(1, filters.page || 1);
  const pageSize = Math.min(500, Math.max(1, filters.pageSize || 30));
  const demoCategories = Array.from(new Map(demoProducts.map((product) => [product.category, { slug: product.category, title: product.categoryLabel }])).values()).sort((left, right) => left.title.localeCompare(right.title, "ru"));
  if (!isDatabaseConfigured()) {
    const filtered = demoProducts.filter((product) =>
      (!search || `${product.name} ${product.sku} ${product.externalId || ""}`.toLowerCase().includes(search.toLowerCase())) &&
      (!status || (product.status || "published") === status) &&
      (!categorySlug || product.category === categorySlug) &&
      !characteristicKey,
    );
    const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
    const page = Math.min(requestedPage, pageCount);
    return { items: filtered.slice((page - 1) * pageSize, page * pageSize), total: filtered.length, page, pageCount, categories: demoCategories, demo: true };
  }
  const params: unknown[] = [];
  const clauses = ["TRUE"];
  if (search) {
    params.push(`%${search}%`);
    clauses.push(`(p.name ILIKE $${params.length} OR p.sku ILIKE $${params.length} OR p.external_id ILIKE $${params.length})`);
  }
  if (status && isAdminProductStatus(status)) {
    params.push(status);
    clauses.push(`p.status = $${params.length}`);
  }
  if (categorySlug) {
    params.push(categorySlug);
    clauses.push(`(c.slug = $${params.length} OR EXISTS (
      SELECT 1
      FROM product_categories category_relation
      JOIN categories related_category ON related_category.id = category_relation.category_id
      WHERE category_relation.product_id = p.id
        AND related_category.slug = $${params.length}
    ))`);
  }
  if (characteristicKey) {
    params.push(characteristicKey);
    clauses.push(`EXISTS (
      SELECT 1
      FROM product_characteristics characteristic_filter
      JOIN catalog_filter_settings characteristic_setting
        ON characteristic_setting.filter_key = $${params.length}
       AND lower(trim(characteristic_filter.label)) = lower(trim(characteristic_setting.source_label))
      WHERE characteristic_filter.product_id = p.id
    )`);
  }
  const where = clauses.join(" AND ");
  const count = await query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM products p LEFT JOIN categories c ON c.id = p.main_category_id WHERE ${where}`, params);
  const rows = await query<Record<string, unknown>>(
    `SELECT p.id,p.external_id,p.slug,p.sku,p.name,p.short_name,p.price,p.old_price,p.status,p.quantity,p.image_url,p.updated_at,p.needs_review,c.slug AS category_slug,c.title AS category_title FROM products p LEFT JOIN categories c ON c.id = p.main_category_id WHERE ${where} ORDER BY p.updated_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, pageSize, (Math.min(requestedPage, Math.max(1, Math.ceil(Number(count.rows[0]?.count || 0) / pageSize))) - 1) * pageSize],
  );
  const total = Number(count.rows[0]?.count || 0);
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(requestedPage, pageCount);
  const categories = (await query<{ slug: string; title: string }>("SELECT slug, title FROM categories ORDER BY sort_order, title")).rows;
  return { items: rows.rows, total, page, pageCount, categories };
}

export async function getAdminProduct(id: string): Promise<Record<string, unknown> | null> {
  const result = await query<Record<string, unknown>>(
    `SELECT p.*, c.slug AS category_slug, c.title AS category_title,
      COALESCE(json_agg(DISTINCT jsonb_build_object('id', pi.id, 'url', pi.url, 'alt', pi.alt, 'sortOrder', pi.sort_order, 'isPrimary', pi.is_primary)) FILTER (WHERE pi.id IS NOT NULL), '[]') AS images,
      COALESCE(json_agg(DISTINCT jsonb_build_object('label', pc.label, 'value', pc.value, 'confidence', pc.confidence, 'needsReview', pc.needs_review)) FILTER (WHERE pc.id IS NOT NULL), '[]') AS characteristics,
      COALESCE((SELECT jsonb_agg(jsonb_build_object('key', settings.filter_key, 'label', settings.source_label, 'enabled', settings.is_enabled) ORDER BY settings.sort_order, settings.label) FROM catalog_filter_settings settings), '[]'::jsonb) AS filter_settings,
      COALESCE((SELECT jsonb_agg(jsonb_build_object('id', category_row.id, 'slug', category_row.slug, 'title', category_row.title, 'isPrimary', category_row.is_primary, 'sortOrder', category_row.sort_order) ORDER BY category_row.sort_order, category_row.title)
        FROM (
          SELECT c.id, c.slug, c.title, true AS is_primary, 0 AS sort_order WHERE c.id IS NOT NULL
          UNION ALL
          SELECT related.id, related.slug, related.title, relation.is_primary, relation.sort_order
          FROM product_categories relation JOIN categories related ON related.id=relation.category_id
          WHERE relation.product_id=p.id AND (p.main_category_id IS NULL OR relation.category_id <> p.main_category_id)
        ) category_row), '[]') AS categories
      FROM products p
      LEFT JOIN categories c ON c.id=p.main_category_id
      LEFT JOIN product_images pi ON pi.product_id=p.id
      LEFT JOIN product_characteristics pc ON pc.product_id=p.id
      WHERE p.id=$1 GROUP BY p.id,c.id,c.slug,c.title`,
    [id],
  );
  const product = result.rows[0];
  if (!product) return null;
  const characteristicDefinitions = await listAdminCharacteristicDefinitions();
  return {
    ...product,
    short_description: cleanProductSummary(String(product.short_description || "")),
    description_html: sanitizeProductHtml(String(product.description_html || "")),
    characteristic_definitions: characteristicDefinitions,
  };
}

export async function createAdminProduct(input: AdminProductInput, adminId: string) {
  return withTransaction(async (client) => {
    const category = await client.query<{ id: string }>(
      `INSERT INTO categories (slug,title) VALUES ($1,$2) ON CONFLICT (slug) DO UPDATE SET title=EXCLUDED.title,updated_at=now() RETURNING id`,
      [input.categorySlug, input.categoryTitle],
    );
    const product = await client.query<{ id: string }>(
      `INSERT INTO products (sku,name,short_name,slug,short_description,description_html,seo_title,seo_description,price,old_price,form,main_category_id,image_url,status,quantity,published_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,CASE WHEN $14='published' THEN now() ELSE NULL END) RETURNING id`,
      [input.sku || null, input.name, input.shortName, input.slug, input.shortDescription, input.descriptionHtml, input.seoTitle || null, input.seoDescription, input.price, input.oldPrice, input.form, category.rows[0].id, input.imageUrl, input.status, input.quantity],
    );
    const id = product.rows[0].id;
    await client.query("INSERT INTO product_categories (product_id,category_id,is_primary) VALUES ($1,$2,true) ON CONFLICT DO NOTHING", [id, category.rows[0].id]);
    const images = Array.from(new Set([input.imageUrl, ...input.gallery].filter(Boolean)));
    for (const [index, url] of images.entries()) {
      await client.query("INSERT INTO product_images (product_id,url,external_url,sort_order,is_primary) VALUES ($1,$2,$2,$3,$4) ON CONFLICT DO NOTHING", [id, url, index, index === 0]);
    }
    for (const [index, characteristic] of input.characteristics.entries()) {
      await client.query("INSERT INTO product_characteristics (product_id,label,value,sort_order) VALUES ($1,$2,$3,$4)", [id, characteristic.label, characteristic.value, index]);
    }
    await recordAdminAudit(adminId, "create", "product", id, input, client as unknown as { query: (text: string, values?: unknown[]) => Promise<unknown> });
    return id;
  });
}

export type AdminProductUpdate = AdminProductInput;

export async function changeAdminProductStatus(id: string, status: string, adminId: string) {
  return withTransaction(async (client) => {
    const current = await client.query<{ slug: string; status: string; quantity: number | null }>("SELECT slug,status,quantity FROM products WHERE id=$1 FOR UPDATE", [id]);
    if (!current.rows[0]) throw new AdminProductNotFoundError();
    if (!canTransitionAdminProductStatus(current.rows[0].status, status)) {
      throw new AdminProductStatusTransitionError(current.rows[0].status, status);
    }
    const updated = await client.query<{ slug: string; status: ProductStatus; published_at: Date | null; updated_at: Date }>(
      "UPDATE products SET status=$1,published_at=CASE WHEN $1='published' AND published_at IS NULL THEN now() WHEN $1<>'published' THEN NULL ELSE published_at END,updated_at=now() WHERE id=$2 RETURNING slug,status,published_at,updated_at",
      [status, id],
    );
    const next = updated.rows[0];
    const action = next.status === "published" ? "publish" : next.status === "hidden" ? "hide" : "unpublish";
    await recordAdminAudit(adminId, action, "product", id, { from: current.rows[0].status, to: next.status }, client as unknown as { query: (text: string, values?: unknown[]) => Promise<unknown> });
    return { slug: next.slug, status: next.status, publishedAt: next.published_at, updatedAt: next.updated_at };
  });
}

export async function updateAdminProduct(id: string, input: AdminProductUpdate, adminId: string) {
  return withTransaction(async (client) => {
    const current = await client.query<{ status: string }>("SELECT status FROM products WHERE id=$1 FOR UPDATE", [id]);
    if (!current.rows[0]) throw new AdminProductNotFoundError();
    if (!canTransitionAdminProductStatus(current.rows[0].status, input.status)) {
      throw new AdminProductStatusTransitionError(current.rows[0].status, input.status);
    }
    const category = await client.query<{ id: string }>(
      `INSERT INTO categories (slug,title) VALUES ($1,$2) ON CONFLICT (slug) DO UPDATE SET title=EXCLUDED.title,updated_at=now() RETURNING id`,
      [input.categorySlug, input.categoryTitle],
    );
    const updated = await client.query<{ slug: string }>(
      `UPDATE products SET sku=$1,name=$2,short_name=$3,slug=$4,short_description=$5,description_html=$6,seo_title=$7,seo_description=$8,price=$9,old_price=$10,form=$11,main_category_id=$12,image_url=$13,status=$14,quantity=$15,published_at=CASE WHEN $14='published' AND published_at IS NULL THEN now() WHEN $14<>'published' THEN NULL ELSE published_at END,updated_at=now() WHERE id=$16 RETURNING slug`,
      [input.sku || null, input.name, input.shortName, input.slug, input.shortDescription, input.descriptionHtml, input.seoTitle || null, input.seoDescription, input.price, input.oldPrice, input.form, category.rows[0].id, input.imageUrl, input.status, input.quantity, id],
    );
    if (!updated.rows[0]) throw new AdminProductNotFoundError();
    await client.query("UPDATE product_categories SET is_primary=false WHERE product_id=$1", [id]);
    await client.query("DELETE FROM product_categories WHERE product_id=$1 AND category_id=$2", [id, category.rows[0].id]);
    await client.query("INSERT INTO product_categories (product_id,category_id,is_primary,sort_order) VALUES ($1,$2,true,0)", [id, category.rows[0].id]);
    await recordAdminAudit(adminId, "update", "product", id, input, client as unknown as { query: (text: string, values?: unknown[]) => Promise<unknown> });
    return updated.rows[0].slug;
  });
}

export async function deleteAdminProduct(id: string, adminId: string) {
  const result = await withTransaction(async (client) => {
    const product = await client.query<{ slug: string }>(
      "SELECT slug FROM products WHERE id=$1 FOR UPDATE",
      [id],
    );
    if (!product.rows[0]) throw new AdminProductNotFoundError();
    const images = await client.query<{ url: string }>(
      "SELECT url FROM product_images WHERE product_id=$1",
      [id],
    );
    await recordAdminAudit(
      adminId,
      "delete",
      "product",
      id,
      { slug: product.rows[0].slug },
      client as unknown as { query: (text: string, values?: unknown[]) => Promise<unknown> },
    );
    await client.query("DELETE FROM products WHERE id=$1", [id]);
    return { slug: product.rows[0].slug, urls: images.rows.map((image) => image.url) };
  });
  const prefix = `${mediaPublicBase()}/`;
  await Promise.all(
    result.urls
      .filter((url) => url.startsWith(prefix))
      .map((url) => unlink(mediaFilePath(url.slice(prefix.length))).catch(() => undefined)),
  );
  return { slug: result.slug };
}
