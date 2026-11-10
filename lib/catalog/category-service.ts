import { randomBytes } from "node:crypto";
import { unlink, writeFile } from "node:fs/promises";
import { isDatabaseConfigured, query, withTransaction } from "../db/client";
import { recordAdminAudit } from "../audit/service";
import { cleanText } from "../forms/validation";
import { ensureMediaFileDirectory, mediaFilePath, mediaPublicBase } from "../media/storage";
import {
  isValidAdminBulkProductCategoryInput,
  type AdminBulkProductCategoryAction,
  type AdminBulkProductCategoryInput,
} from "./bulk-category-input";

export {
  isValidAdminBulkProductCategoryInput,
  parseAdminBulkProductCategoryInput,
} from "./bulk-category-input";
export type {
  AdminBulkProductCategoryAction,
  AdminBulkProductCategoryInput,
} from "./bulk-category-input";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const categoryHomeColors = new Set(["blue", "mint", "sand", "lilac", "rose", "cyan"]);
const imageTypes: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
};
const maxImageBytes = Number(process.env.MEDIA_MAX_IMAGE_BYTES || 15 * 1024 * 1024);

export type AdminCategoryInput = {
  slug: string;
  title: string;
  description: string;
  imageUrl: string;
  parentId: string | null;
  sortOrder: number;
  isFeatured: boolean;
  homeColor: string;
};

export type AdminCategory = AdminCategoryInput & {
  id: string;
  productCount: number;
  publishedProductCount: number;
  createdAt?: string;
  updatedAt?: string;
};

export type AdminBulkProductCategoryResult = {
  action: AdminBulkProductCategoryAction;
  category: { id: string; slug: string; title: string };
  requestedCount: number;
  changedCount: number;
  unchangedCount: number;
  primarySkippedCount: number;
};

export class AdminCategoryNotFoundError extends Error {
  constructor() {
    super("CATEGORY_NOT_FOUND");
    this.name = "AdminCategoryNotFoundError";
  }
}

export class AdminCategoryInUseError extends Error {
  readonly productCount: number;

  constructor(productCount: number) {
    super(`Category is used by ${productCount} products`);
    this.name = "AdminCategoryInUseError";
    this.productCount = productCount;
  }
}

export class InvalidCategoryAssignmentError extends Error {
  constructor(message = "Invalid category assignment") {
    super(message);
    this.name = "InvalidCategoryAssignmentError";
  }
}

export class AdminProductNotFoundError extends Error {
  constructor() {
    super("PRODUCT_NOT_FOUND");
    this.name = "AdminProductNotFoundError";
  }
}

export function isAdminCategoryDatabaseConfigured() {
  return isDatabaseConfigured();
}

export function parseAdminCategoryInput(body: Record<string, unknown>): AdminCategoryInput {
  const parentId = typeof body.parentId === "string" && uuidPattern.test(body.parentId) ? body.parentId : null;
  return {
    slug: cleanText(body.slug, 120).toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-|-$/g, ""),
    title: cleanText(body.title, 180),
    description: cleanText(body.description, 1_000),
    imageUrl: cleanText(body.imageUrl, 500),
    parentId,
    sortOrder: Number.isInteger(Number(body.sortOrder)) ? Math.max(0, Number(body.sortOrder)) : 0,
    isFeatured: body.isFeatured === true,
    homeColor: categoryHomeColors.has(String(body.homeColor)) ? String(body.homeColor) : "blue",
  };
}

export function isValidAdminCategoryInput(input: AdminCategoryInput) {
  return Boolean(input.slug && /^[a-z0-9-]+$/.test(input.slug) && input.title && input.sortOrder >= 0 && (!input.parentId || uuidPattern.test(input.parentId)));
}

function rowToCategory(row: Record<string, unknown>): AdminCategory {
  return {
    id: String(row.id),
    slug: String(row.slug),
    title: String(row.title),
    description: String(row.description || ""),
    imageUrl: String(row.image_url || ""),
    parentId: row.parent_id ? String(row.parent_id) : null,
    sortOrder: Number(row.sort_order || 0),
    isFeatured: Boolean(row.is_featured),
    homeColor: String(row.home_color || "blue"),
    productCount: Number(row.product_count || 0),
    publishedProductCount: Number(row.published_product_count || 0),
    createdAt: row.created_at ? new Date(String(row.created_at)).toISOString() : undefined,
    updatedAt: row.updated_at ? new Date(String(row.updated_at)).toISOString() : undefined,
  };
}

export async function listAdminCategories(): Promise<AdminCategory[]> {
  const result = await query<Record<string, unknown>>(`
    SELECT c.*,
      COUNT(DISTINCT p.id)::int AS product_count,
      COUNT(DISTINCT p.id) FILTER (WHERE p.status='published')::int AS published_product_count
    FROM categories c
    LEFT JOIN product_categories pc ON pc.category_id = c.id
    LEFT JOIN products p ON p.id = pc.product_id OR p.main_category_id = c.id
    GROUP BY c.id
    ORDER BY c.sort_order, c.title`);
  return result.rows.map(rowToCategory);
}

export async function createAdminCategory(input: AdminCategoryInput, adminId: string) {
  return withTransaction(async (client) => {
    const result = await client.query<Record<string, unknown>>(
      `INSERT INTO categories (slug,title,description,image_url,parent_id,sort_order,is_featured,home_color)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING *`,
      [input.slug, input.title, input.description, input.imageUrl, input.parentId, input.sortOrder, input.isFeatured, input.homeColor],
    );
    const category = rowToCategory(result.rows[0]);
    await recordAdminAudit(adminId, "create", "category", category.id, input, client as unknown as { query: (text: string, values?: unknown[]) => Promise<unknown> });
    return category;
  });
}

export async function updateAdminCategory(id: string, input: AdminCategoryInput, adminId: string) {
  return withTransaction(async (client) => {
    const current = await client.query<{ id: string }>("SELECT id FROM categories WHERE id=$1 FOR UPDATE", [id]);
    if (!current.rows[0]) throw new AdminCategoryNotFoundError();
    if (input.parentId === id) throw new InvalidCategoryAssignmentError("Category cannot be its own parent");
    const result = await client.query<Record<string, unknown>>(
      `UPDATE categories SET slug=$1,title=$2,description=$3,image_url=$4,parent_id=$5,sort_order=$6,is_featured=$7,home_color=$8,updated_at=now()
       WHERE id=$9 RETURNING *`,
      [input.slug, input.title, input.description, input.imageUrl, input.parentId, input.sortOrder, input.isFeatured, input.homeColor, id],
    );
    const category = rowToCategory(result.rows[0]);
    await recordAdminAudit(adminId, "update", "category", id, input, client as unknown as { query: (text: string, values?: unknown[]) => Promise<unknown> });
    return category;
  });
}

export async function deleteAdminCategory(id: string, adminId: string) {
  return withTransaction(async (client) => {
    const current = await client.query<{ id: string }>("SELECT id FROM categories WHERE id=$1 FOR UPDATE", [id]);
    if (!current.rows[0]) throw new AdminCategoryNotFoundError();
    const usage = await client.query<{ count: string }>(
      `SELECT COUNT(DISTINCT p.id)::text AS count
       FROM products p
       LEFT JOIN product_categories pc ON pc.product_id=p.id AND pc.category_id=$1
       WHERE p.main_category_id=$1 OR pc.category_id IS NOT NULL`,
      [id],
    );
    const productCount = Number(usage.rows[0]?.count || 0);
    if (productCount > 0) throw new AdminCategoryInUseError(productCount);
    await client.query("DELETE FROM categories WHERE id=$1", [id]);
    await recordAdminAudit(adminId, "delete", "category", id, {}, client as unknown as { query: (text: string, values?: unknown[]) => Promise<unknown> });
    return { id };
  });
}

export async function reorderAdminCategories(ids: string[], adminId: string) {
  if (!ids.length || new Set(ids).size !== ids.length || ids.some((id) => !uuidPattern.test(id))) {
    throw new InvalidCategoryAssignmentError("Invalid category order");
  }
  return withTransaction(async (client) => {
    const existing = await client.query<{ id: string }>(
      "SELECT id FROM categories WHERE id=ANY($1::uuid[]) FOR UPDATE",
      [ids],
    );
    if (existing.rows.length !== ids.length) throw new AdminCategoryNotFoundError();
    for (const [sortOrder, id] of ids.entries()) {
      await client.query(
        "UPDATE categories SET sort_order=$1,updated_at=now() WHERE id=$2",
        [sortOrder, id],
      );
    }
    await recordAdminAudit(
      adminId,
      "reorder",
      "category",
      ids[0],
      { ids },
      client as unknown as { query: (text: string, values?: unknown[]) => Promise<unknown> },
    );
    return ids;
  });
}

export async function setAdminCategoryImage(id: string, file: File, adminId: string) {
  const extension = imageTypes[file.type.toLowerCase()];
  if (!extension) throw new Error("UNSUPPORTED_IMAGE_TYPE");
  if (!Number.isFinite(file.size) || file.size <= 0 || file.size > maxImageBytes) {
    throw new Error("IMAGE_TOO_LARGE");
  }
  const key = `categories/${id}/${Date.now()}-${randomBytes(6).toString("hex")}.${extension}`;
  const target = mediaFilePath(key);
  await ensureMediaFileDirectory(key);
  const bytes = Buffer.from(await file.arrayBuffer());
  if (!bytes.length || bytes.length > maxImageBytes) throw new Error("IMAGE_TOO_LARGE");
  await writeFile(target, bytes);
  try {
    const result = await withTransaction(async (client) => {
      const current = await client.query<{ image_url: string }>(
        "SELECT image_url FROM categories WHERE id=$1 FOR UPDATE",
        [id],
      );
      if (!current.rows[0]) throw new AdminCategoryNotFoundError();
      const url = `${mediaPublicBase()}/${key}`;
      await client.query(
        "UPDATE categories SET image_url=$1,updated_at=now() WHERE id=$2",
        [url, id],
      );
      await recordAdminAudit(
        adminId,
        "update_image",
        "category",
        id,
        { url, name: file.name },
        client as unknown as { query: (text: string, values?: unknown[]) => Promise<unknown> },
      );
      return { url, previousUrl: current.rows[0].image_url };
    });
    const prefix = `${mediaPublicBase()}/`;
    if (result.previousUrl?.startsWith(prefix) && result.previousUrl !== result.url) {
      await unlink(mediaFilePath(result.previousUrl.slice(prefix.length))).catch(() => undefined);
    }
    return { url: result.url };
  } catch (error) {
    await unlink(target).catch(() => undefined);
    throw error;
  }
}

export async function assignAdminProductCategories(id: string, primaryCategoryId: string, additionalCategoryIds: string[], adminId: string) {
  const additional = [...new Set(additionalCategoryIds)].filter((categoryId) => categoryId !== primaryCategoryId);
  const categoryIds = [primaryCategoryId, ...additional];
  if (!uuidPattern.test(primaryCategoryId) || additional.some((categoryId) => !uuidPattern.test(categoryId))) throw new InvalidCategoryAssignmentError("Category IDs must be UUIDs");
  return withTransaction(async (client) => {
    const product = await client.query<{ slug: string }>("SELECT slug FROM products WHERE id=$1 FOR UPDATE", [id]);
    if (!product.rows[0]) throw new AdminCategoryNotFoundError();
    const categories = await client.query<{ id: string }>("SELECT id FROM categories WHERE id=ANY($1::uuid[])", [categoryIds]);
    if (categories.rows.length !== categoryIds.length) throw new InvalidCategoryAssignmentError("One or more categories do not exist");
    await client.query("UPDATE products SET main_category_id=$1,updated_at=now() WHERE id=$2", [primaryCategoryId, id]);
    await client.query("DELETE FROM product_categories WHERE product_id=$1", [id]);
    for (const [index, categoryId] of categoryIds.entries()) {
      await client.query(
        "INSERT INTO product_categories (product_id,category_id,is_primary,sort_order) VALUES ($1,$2,$3,$4)",
        [id, categoryId, index === 0, index],
      );
    }
    await recordAdminAudit(adminId, "assign_categories", "product", id, { primaryCategoryId, additionalCategoryIds: additional }, client as unknown as { query: (text: string, values?: unknown[]) => Promise<unknown> });
    return { slug: product.rows[0].slug, primaryCategoryId, additionalCategoryIds: additional };
  });
}

export async function bulkAssignAdminProductCategory(
  input: AdminBulkProductCategoryInput,
  adminId: string,
): Promise<AdminBulkProductCategoryResult> {
  if (!isValidAdminBulkProductCategoryInput(input) || (input.action !== "add" && input.action !== "remove")) {
    throw new InvalidCategoryAssignmentError("Invalid bulk category assignment");
  }
  const action: AdminBulkProductCategoryAction = input.action;

  return withTransaction(async (client) => {
    const products = await client.query<{ id: string; main_category_id: string | null }>(
      "SELECT id,main_category_id FROM products WHERE id=ANY($1::uuid[]) ORDER BY id FOR UPDATE",
      [input.productIds],
    );
    if (products.rows.length !== input.productIds.length) throw new AdminProductNotFoundError();

    const categoryResult = await client.query<{ id: string; slug: string; title: string }>(
      "SELECT id,slug,title FROM categories WHERE slug=$1 FOR UPDATE",
      [input.categorySlug],
    );
    const category = categoryResult.rows[0];
    if (!category) throw new AdminCategoryNotFoundError();

    const primarySkippedCount = action === "remove"
      ? products.rows.filter((product) => product.main_category_id === category.id).length
      : 0;
    const changed = action === "add"
      ? await client.query<{ product_id: string }>(
        `INSERT INTO product_categories (product_id,category_id,is_primary,sort_order)
         SELECT product.id,$2::uuid,false,
           COALESCE((SELECT MAX(existing.sort_order) + 1 FROM product_categories existing WHERE existing.product_id=product.id),1)
         FROM products product
         WHERE product.id=ANY($1::uuid[])
           AND product.main_category_id IS DISTINCT FROM $2::uuid
         ON CONFLICT (product_id,category_id) DO NOTHING
         RETURNING product_id`,
        [input.productIds, category.id],
      )
      : await client.query<{ product_id: string }>(
        `DELETE FROM product_categories relation
         USING products product
         WHERE relation.product_id=product.id
           AND product.id=ANY($1::uuid[])
           AND relation.category_id=$2::uuid
           AND relation.is_primary=false
           AND product.main_category_id IS DISTINCT FROM $2::uuid
         RETURNING relation.product_id`,
        [input.productIds, category.id],
      );

    const changedProductIds = changed.rows.map((row) => row.product_id);
    if (changedProductIds.length > 0) {
      await client.query(
        "UPDATE products SET updated_at=now() WHERE id=ANY($1::uuid[])",
        [changedProductIds],
      );
    }

    const unchangedCount = input.productIds.length - changedProductIds.length - primarySkippedCount;
    await recordAdminAudit(
      adminId,
      action === "add" ? "bulk_add_category" : "bulk_remove_category",
      "category",
      category.id,
      {
        categorySlug: category.slug,
        productIds: input.productIds,
        changedProductIds,
        primarySkippedCount,
      },
      client as unknown as { query: (text: string, values?: unknown[]) => Promise<unknown> },
    );

    return {
      action,
      category,
      requestedCount: input.productIds.length,
      changedCount: changedProductIds.length,
      unchangedCount,
      primarySkippedCount,
    };
  });
}
