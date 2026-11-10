import { randomBytes } from "node:crypto";
import { unlink, writeFile } from "node:fs/promises";
import { ensureMediaFileDirectory, mediaFilePath, mediaPublicBase } from "../media/storage";
import { withTransaction } from "../db/client";
import { recordAdminAudit } from "../audit/service";

const contentTypes: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif", "image/avif": "avif" };
const maxImageBytes = Number(process.env.MEDIA_MAX_IMAGE_BYTES || 15 * 1024 * 1024);

export class AdminProductImageNotFoundError extends Error {
  constructor() { super("IMAGE_NOT_FOUND"); this.name = "AdminProductImageNotFoundError"; }
}

export class InvalidProductImageOrderError extends Error {
  constructor() { super("INVALID_IMAGE_ORDER"); this.name = "InvalidProductImageOrderError"; }
}

function localImageKey(productId: string, extension: string) {
  return `products/${productId}/${Date.now()}-${randomBytes(6).toString("hex")}.${extension}`;
}

export async function addProductImage(productId: string, file: File, adminId: string) {
  const extension = contentTypes[file.type.toLowerCase()];
  if (!extension) throw new Error("UNSUPPORTED_IMAGE_TYPE");
  if (!Number.isFinite(file.size) || file.size <= 0 || file.size > maxImageBytes) throw new Error("IMAGE_TOO_LARGE");
  const key = localImageKey(productId, extension);
  const target = mediaFilePath(key);
  await ensureMediaFileDirectory(key);
  const bytes = Buffer.from(await file.arrayBuffer());
  if (!bytes.length || bytes.length > maxImageBytes) throw new Error("IMAGE_TOO_LARGE");
  await writeFile(target, bytes);
  try {
    return await withTransaction(async (client) => {
      const product = await client.query<{ slug: string }>("SELECT slug FROM products WHERE id=$1 FOR UPDATE", [productId]);
      if (!product.rows[0]) throw new AdminProductImageNotFoundError();
      const count = await client.query<{ count: string }>("SELECT COUNT(*)::text AS count FROM product_images WHERE product_id=$1", [productId]);
      const isPrimary = Number(count.rows[0]?.count || 0) === 0;
      if (isPrimary) await client.query("UPDATE product_images SET is_primary=false WHERE product_id=$1", [productId]);
      const image = await client.query<{ id: string; url: string; alt: string; sort_order: number; is_primary: boolean }>(
        "INSERT INTO product_images (product_id,url,alt,external_url,sort_order,is_primary) VALUES ($1,$2,$3,NULL,$4,$5) RETURNING id,url,alt,sort_order,is_primary",
        [productId, `${mediaPublicBase()}/${key}`, file.name.slice(0, 240), Number(count.rows[0]?.count || 0), isPrimary],
      );
      if (isPrimary) await client.query("UPDATE products SET image_url=$1,updated_at=now() WHERE id=$2", [image.rows[0].url, productId]);
      await recordAdminAudit(adminId, "create", "product_image", image.rows[0].id, { productId, url: image.rows[0].url, name: file.name }, client);
      return { slug: product.rows[0].slug, image: image.rows[0] };
    });
  } catch (error) {
    await unlink(target).catch(() => undefined);
    throw error;
  }
}

export async function deleteProductImage(productId: string, imageId: string, adminId: string) {
  const result = await withTransaction(async (client) => {
    const image = await client.query<{ id: string; url: string; is_primary: boolean; slug: string }>(
      "SELECT pi.id,pi.url,pi.is_primary,p.slug FROM product_images pi JOIN products p ON p.id=pi.product_id WHERE pi.id=$1 AND pi.product_id=$2 FOR UPDATE",
      [imageId, productId],
    );
    if (!image.rows[0]) throw new AdminProductImageNotFoundError();
    await client.query("DELETE FROM product_images WHERE id=$1", [imageId]);
    const next = await client.query<{ id: string; url: string; is_primary: boolean }>("SELECT id,url,is_primary FROM product_images WHERE product_id=$1 ORDER BY sort_order,id", [productId]);
    const nextPrimary = next.rows.find((item) => item.is_primary) || next.rows[0];
    await client.query("UPDATE product_images SET is_primary=false WHERE product_id=$1", [productId]);
    if (nextPrimary) await client.query("UPDATE product_images SET is_primary=true WHERE id=$1 AND product_id=$2", [nextPrimary.id, productId]);
    await client.query("UPDATE products SET image_url=$1,updated_at=now() WHERE id=$2", [nextPrimary?.url || "", productId]);
    await recordAdminAudit(adminId, "delete", "product_image", imageId, { productId, url: image.rows[0].url }, client);
    return { slug: image.rows[0].slug, deletedUrl: image.rows[0].url, primaryImageId: nextPrimary?.id || null };
  });
  const prefix = `${mediaPublicBase()}/`;
  if (result.deletedUrl.startsWith(prefix)) await unlink(mediaFilePath(result.deletedUrl.slice(prefix.length))).catch(() => undefined);
  return result;
}

export async function reorderProductImages(productId: string, imageIds: string[], primaryImageId: string, adminId: string) {
  return withTransaction(async (client) => {
    const product = await client.query<{ slug: string }>("SELECT slug FROM products WHERE id=$1 FOR UPDATE", [productId]);
    if (!product.rows[0]) throw new AdminProductImageNotFoundError();
    const existing = await client.query<{ id: string; url: string }>("SELECT id,url FROM product_images WHERE product_id=$1 ORDER BY sort_order,id", [productId]);
    const existingIds = existing.rows.map((item) => item.id);
    if (existingIds.length === 0 && imageIds.length === 0 && !primaryImageId) {
      await recordAdminAudit(adminId, "update", "product_images", productId, { imageIds: [], primaryImageId: null }, client);
      return { slug: product.rows[0].slug };
    }
    if (imageIds.length !== existingIds.length || new Set(imageIds).size !== imageIds.length || imageIds.some((id) => !existingIds.includes(id)) || !existingIds.includes(primaryImageId)) throw new InvalidProductImageOrderError();
    for (const [sortOrder, imageId] of imageIds.entries()) {
      await client.query(
        "UPDATE product_images SET sort_order=$1,is_primary=($2=$3) WHERE id=$2 AND product_id=$4",
        [sortOrder, imageId, primaryImageId, productId],
      );
    }
    const primary = existing.rows.find((item) => item.id === primaryImageId);
    await client.query("UPDATE products SET image_url=$1,updated_at=now() WHERE id=$2", [primary?.url || "", productId]);
    await recordAdminAudit(adminId, "update", "product_images", productId, { imageIds, primaryImageId }, client);
    return { slug: product.rows[0].slug };
  });
}

export async function updateProductCharacteristics(
  productId: string,
  characteristics: Array<{ label: string; value: string; confidence?: number | null; needsReview?: boolean }>,
  adminId: string,
) {
  const normalized = characteristics.map((item) => ({ label: String(item.label || "").trim().slice(0, 120), value: String(item.value || "").trim().slice(0, 240), confidence: item.confidence == null ? null : Number(item.confidence), needsReview: Boolean(item.needsReview) })).filter((item) => item.label && item.value);
  if (normalized.some((item) => item.confidence != null && (!Number.isFinite(item.confidence) || item.confidence < 0 || item.confidence > 1))) throw new Error("INVALID_CHARACTERISTIC_CONFIDENCE");
  return withTransaction(async (client) => {
    const product = await client.query<{ slug: string }>("SELECT slug FROM products WHERE id=$1 FOR UPDATE", [productId]);
    if (!product.rows[0]) throw new AdminProductImageNotFoundError();
    const definitions = await client.query<{ source_label: string }>(
      "SELECT source_label FROM catalog_filter_settings",
    );
    const allowedLabels = new Set(
      definitions.rows.map((item) => item.source_label.trim().toLowerCase()),
    );
    if (normalized.some((item) => !allowedLabels.has(item.label.toLowerCase()))) {
      throw new Error("UNKNOWN_CHARACTERISTIC_DEFINITION");
    }
    await client.query("DELETE FROM product_characteristics WHERE product_id=$1", [productId]);
    for (const [sortOrder, item] of normalized.entries()) await client.query("INSERT INTO product_characteristics (product_id,label,value,confidence,needs_review,sort_order) VALUES ($1,$2,$3,$4,$5,$6)", [productId, item.label, item.value, item.confidence, item.needsReview, sortOrder]);
    await recordAdminAudit(
      adminId,
      "update",
      "product_characteristics",
      productId,
      { characteristics: normalized },
      client,
    );
    return { slug: product.rows[0].slug, characteristics: normalized };
  });
}
