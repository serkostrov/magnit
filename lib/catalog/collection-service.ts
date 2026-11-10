import { isDatabaseConfigured, query, withTransaction } from "../db/client";
import { recordAdminAudit } from "../audit/service";
import { cleanText } from "../forms/validation";
import { rowToProduct } from "./repository";
import type { Product } from "./types";

export type AdminCollectionInput = {
  slug: string;
  title: string;
  description: string;
  sortOrder: number;
  isFeatured: boolean;
};

export type AdminCollection = AdminCollectionInput & {
  id: string;
  productCount: number;
  updatedAt?: string;
};

export type AdminCollectionProduct = {
  id: string;
  name: string;
  slug: string;
  sku: string;
  sortOrder: number;
};

export class AdminCollectionNotFoundError extends Error {
  constructor() {
    super("COLLECTION_NOT_FOUND");
    this.name = "AdminCollectionNotFoundError";
  }
}

export class InvalidCollectionProductsError extends Error {
  constructor(message = "Invalid collection products") {
    super(message);
    this.name = "InvalidCollectionProductsError";
  }
}

export function isAdminCollectionDatabaseConfigured() {
  return isDatabaseConfigured();
}

export function parseAdminCollectionInput(body: Record<string, unknown>): AdminCollectionInput {
  return {
    slug: cleanText(body.slug, 120).toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-|-$/g, ""),
    title: cleanText(body.title, 180),
    description: cleanText(body.description, 1_000),
    sortOrder: Number.isInteger(Number(body.sortOrder)) ? Math.max(0, Number(body.sortOrder)) : 0,
    isFeatured: body.isFeatured === true,
  };
}

export function isValidAdminCollectionInput(input: AdminCollectionInput) {
  return Boolean(input.slug && /^[a-z0-9-]+$/.test(input.slug) && input.title && input.sortOrder >= 0);
}

function rowToCollection(row: Record<string, unknown>): AdminCollection {
  return {
    id: String(row.id),
    slug: String(row.slug),
    title: String(row.title),
    description: String(row.description || ""),
    sortOrder: Number(row.sort_order || 0),
    isFeatured: Boolean(row.is_featured),
    productCount: Number(row.product_count || 0),
    updatedAt: row.updated_at ? new Date(String(row.updated_at)).toISOString() : undefined,
  };
}

export async function listAdminCollections() {
  const result = await query<Record<string, unknown>>(`
    SELECT c.*, COUNT(pc.product_id)::int AS product_count
    FROM collections c
    LEFT JOIN product_collections pc ON pc.collection_slug=c.slug
    GROUP BY c.id
    ORDER BY c.sort_order, c.title`);
  return result.rows.map(rowToCollection);
}

export async function createAdminCollection(input: AdminCollectionInput, adminId: string) {
  return withTransaction(async (client) => {
    const result = await client.query<Record<string, unknown>>(
      `INSERT INTO collections (slug,title,description,sort_order,is_featured) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [input.slug, input.title, input.description, input.sortOrder, input.isFeatured],
    );
    const collection = rowToCollection(result.rows[0]);
    await recordAdminAudit(adminId, "create", "collection", collection.id, input, client as unknown as { query: (text: string, values?: unknown[]) => Promise<unknown> });
    return collection;
  });
}

export async function updateAdminCollection(id: string, input: AdminCollectionInput, adminId: string) {
  return withTransaction(async (client) => {
    const current = await client.query<{ slug: string }>("SELECT slug FROM collections WHERE id=$1 FOR UPDATE", [id]);
    if (!current.rows[0]) throw new AdminCollectionNotFoundError();
    const result = await client.query<Record<string, unknown>>(
      `UPDATE collections SET slug=$1,title=$2,description=$3,sort_order=$4,is_featured=$5,updated_at=now() WHERE id=$6 RETURNING *`,
      [input.slug, input.title, input.description, input.sortOrder, input.isFeatured, id],
    );
    if (current.rows[0].slug !== input.slug) await client.query("UPDATE product_collections SET collection_slug=$1 WHERE collection_slug=$2", [input.slug, current.rows[0].slug]);
    const collection = rowToCollection(result.rows[0]);
    await recordAdminAudit(adminId, "update", "collection", id, { ...input, previousSlug: current.rows[0].slug }, client as unknown as { query: (text: string, values?: unknown[]) => Promise<unknown> });
    return collection;
  });
}

export async function deleteAdminCollection(id: string, adminId: string) {
  return withTransaction(async (client) => {
    const current = await client.query<{ slug: string }>("SELECT slug FROM collections WHERE id=$1 FOR UPDATE", [id]);
    if (!current.rows[0]) throw new AdminCollectionNotFoundError();
    await client.query("DELETE FROM product_collections WHERE collection_slug=$1", [current.rows[0].slug]);
    await client.query("DELETE FROM collections WHERE id=$1", [id]);
    await recordAdminAudit(adminId, "delete", "collection", id, { slug: current.rows[0].slug }, client as unknown as { query: (text: string, values?: unknown[]) => Promise<unknown> });
    return { id };
  });
}

export async function listAdminCollectionProducts(id: string): Promise<AdminCollectionProduct[]> {
  const result = await query<Record<string, unknown>>(`
    SELECT p.id,p.name,p.slug,p.sku,pc.sort_order
    FROM collections c JOIN product_collections pc ON pc.collection_slug=c.slug JOIN products p ON p.id=pc.product_id
    WHERE c.id=$1 ORDER BY pc.sort_order,p.name`, [id]);
  return result.rows.map((row) => ({ id: String(row.id), name: String(row.name), slug: String(row.slug), sku: String(row.sku || ""), sortOrder: Number(row.sort_order || 0) }));
}

export async function replaceAdminCollectionProducts(id: string, productIds: string[], adminId: string) {
  const uniqueProductIds = [...new Set(productIds)];
  return withTransaction(async (client) => {
    const collection = await client.query<{ slug: string }>("SELECT slug FROM collections WHERE id=$1 FOR UPDATE", [id]);
    if (!collection.rows[0]) throw new AdminCollectionNotFoundError();
    if (uniqueProductIds.length) {
      const products = await client.query<{ id: string }>("SELECT id FROM products WHERE id=ANY($1::uuid[])", [uniqueProductIds]);
      if (products.rows.length !== uniqueProductIds.length) throw new InvalidCollectionProductsError();
    }
    await client.query("DELETE FROM product_collections WHERE collection_slug=$1", [collection.rows[0].slug]);
    for (const [sortOrder, productId] of uniqueProductIds.entries()) {
      await client.query("INSERT INTO product_collections (product_id,collection_slug,sort_order) VALUES ($1,$2,$3)", [productId, collection.rows[0].slug, sortOrder]);
    }
    await recordAdminAudit(adminId, "assign_products", "collection", id, { productIds: uniqueProductIds }, client as unknown as { query: (text: string, values?: unknown[]) => Promise<unknown> });
    return { slug: collection.rows[0].slug, productIds: uniqueProductIds };
  });
}

export async function getPublishedCollectionProducts(slug: string, limit = 8): Promise<Product[]> {
  if (!isDatabaseConfigured()) return [];
  const result = await query<Record<string, unknown>>(`
    SELECT p.*, c.slug AS category_slug, c.title AS category_title,
      COALESCE(array_agg(DISTINCT pi.url) FILTER (WHERE pi.url IS NOT NULL), '{}') AS images,
      COALESCE(json_agg(DISTINCT jsonb_build_object('label', pc.label, 'value', pc.value, 'confidence', pc.confidence, 'needsReview', pc.needs_review)) FILTER (WHERE pc.id IS NOT NULL AND pc.needs_review=false), '[]') AS characteristics,
      relation.sort_order AS collection_sort_order
    FROM product_collections relation
    JOIN products p ON p.id=relation.product_id AND p.status='published'
    LEFT JOIN categories c ON c.id=p.main_category_id
    LEFT JOIN product_images pi ON pi.product_id=p.id
    LEFT JOIN product_characteristics pc ON pc.product_id=p.id
    WHERE relation.collection_slug=$1
    GROUP BY p.id,c.slug,c.title,relation.sort_order
    ORDER BY relation.sort_order,p.updated_at DESC
    LIMIT $2`, [slug, Math.max(1, Math.min(50, limit))]);
  return result.rows.map((row) => rowToProduct(row, (row.images as string[]) || [], (row.characteristics as Product["characteristics"]) || []));
}
