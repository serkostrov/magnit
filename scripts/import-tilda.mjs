import { mkdir, readFile, writeFile, access } from "node:fs/promises";
import { basename, dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const { Pool } = pg;
const root = dirname(fileURLToPath(import.meta.url));
const defaultSource = process.env.TILDA_CSV || "/Users/alexlol/Downloads/Telegram Desktop/store-8215887-202608021218.csv";
const sourceArgument = process.argv.slice(2).find((argument) => !argument.startsWith("--"));
const source = resolve(sourceArgument || defaultSource);
const dryRun = process.argv.includes("--dry-run") || !process.env.DATABASE_URL;
const reportPath = process.env.IMPORT_REPORT || join(root, "..", "storage", "imports", `${basename(source, ".csv")}-${dryRun ? "dry-run" : "apply"}.json`);
const mediaDirectory = resolve(process.env.MEDIA_STORAGE_DIR || join(root, "..", "storage", "media"));
const mediaPublicBase = (process.env.MEDIA_PUBLIC_URL || "/media").replace(/\/$/, "");
const maxImageBytes = Number(process.env.MEDIA_MAX_IMAGE_BYTES || 12 * 1024 * 1024);
const allowedImageTypes = new Set(["image/avif", "image/gif", "image/jpeg", "image/png", "image/webp"]);

function parseCsv(text) {
  const rows = [];
  let row = [], field = "", quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') { field += '"'; index += 1; }
      else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ";") { row.push(field); field = ""; }
    else if (char === "\n") { row.push(field.replace(/\r$/, "")); rows.push(row); row = []; field = ""; }
    else field += char;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  const headers = rows.shift().map((item) => item.replace(/^\uFEFF/, "").trim());
  return rows.filter((item) => item.some(Boolean)).map((values) => Object.fromEntries(headers.map((header, i) => [header, values[i] || ""])));
}

const translit = new Map(Object.entries({ а:"a", б:"b", в:"v", г:"g", д:"d", е:"e", ё:"e", ж:"zh", з:"z", и:"i", й:"y", к:"k", л:"l", м:"m", н:"n", о:"o", п:"p", р:"r", с:"s", т:"t", у:"u", ф:"f", х:"h", ц:"c", ч:"ch", ш:"sh", щ:"sch", ъ:"", ы:"y", ь:"", э:"e", ю:"yu", я:"ya" }));
function slugify(value, suffix) {
  const slug = [...value.toLowerCase()].map((char) => translit.get(char) || char).join("").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 90);
  const safeSuffix = String(suffix).toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 32) || "product";
  return `${slug || "magnit"}-${safeSuffix}`;
}

const allowedHtmlTags = new Set(["a", "b", "br", "div", "em", "h2", "h3", "h4", "i", "li", "ol", "p", "strong", "u", "ul"]);

function escapeAttribute(value) {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function sanitizeHtml(value) {
  const warnings = [];
  let source = value;
  if (/<(?:script|style|iframe|object|embed|noscript|template)\b/i.test(source)) warnings.push("removed-dangerous-block");
  if (/\son[a-z]+\s*=|javascript:/i.test(source)) warnings.push("removed-dangerous-attribute");
  if (/href\s*=\s*(["'])#form\1/i.test(source)) warnings.push("replaced-legacy-form-link");
  source = source
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<(?:script|style|iframe|object|embed|noscript|template)\b[\s\S]*?<\/(?:script|style|iframe|object|embed|noscript|template)>/gi, "")
    .replace(/href=(['"])#form\1/gi, 'href="/#quiz"')
    .replace(/<\/?([a-z0-9-]+)([^>]*)>/gi, (full, tagName, attributes) => {
      const tag = String(tagName).toLowerCase();
      if (!allowedHtmlTags.has(tag)) return "";
      if (full.startsWith("</")) return `</${tag}>`;
      if (tag !== "a") return `<${tag}>`;
      const hrefMatch = String(attributes).match(/\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
      const href = hrefMatch?.[1] || hrefMatch?.[2] || hrefMatch?.[3] || "";
      const safeHref = /^(?:https?:|mailto:|tel:|\/|#)/i.test(href) && !/^javascript:/i.test(href) ? href : "";
      return safeHref ? `<a href="${escapeAttribute(safeHref)}">` : "<a>";
    });
  return { html: source, warnings };
}

function cleanHtml(value) {
  return sanitizeHtml(value).html
    .replace(/<a\b[^>]*>\s*предложить свою цену\s*<\/a>/gi, "")
    .replace(/предложить свою цену/gi, "")
    .replace(/<p>\s*<\/p>/gi, "");
}

function textFromHtml(value) {
  return cleanHtml(value).replace(/<br\s*\/?>(?=\S)/gi, "\n").replace(/<[^>]+>/g, " ").replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/\s+/g, " ").trim();
}

function parseCharacteristics(html) {
  const result = [];
  const regex = /<li[^>]*>([\s\S]*?)<\/li>/gi;
  let match;
  while ((match = regex.exec(html))) {
    const text = textFromHtml(match[1]).replace(/[;.]$/, "");
    const separator = text.indexOf(":");
    if (separator > 0 && separator < text.length - 1) {
      const label = text.slice(0, separator).trim();
      const value = text.slice(separator + 1).trim();
      const needsReview = label.length > 120 || value.length > 240 || /[?]|не указ|нет данных|unknown|n\/a|copy:/i.test(text);
      result.push({ label, value, confidence: needsReview ? 0.45 : 0.82, needsReview });
    }
  }
  return result.slice(0, 30);
}

function categoryParts(value) {
  return value.split(/[;,]/).map((item) => item.trim()).filter(Boolean);
}

function categorySlug(value) {
  const normalized = value.toLowerCase();
  if (/диск|цилиндр/.test(normalized)) return "diski";
  if (/прямоуголь/.test(normalized)) return "pryamougolnye";
  if (/кольц|шайб/.test(normalized)) return "kolca";
  if (/зенков/.test(normalized)) return "zenkovka";
  if (/креп|держател/.test(normalized)) return "krepleniya";
  if (/поиск/.test(normalized)) return "poiskovye";
  return slugify(value, "category").replace(/-category$/, "");
}

function collectionTitle(slug) {
  return { novinki: "Новинки", popular: "Популярное", adhesive: "Магниты с клеевым слоем" }[slug] || slug;
}

function imageUrls(value) {
  return value.split(/[;,\s]+/).map((item) => item.trim()).filter((item) => /^https?:\/\//i.test(item));
}

async function persistImage(url, externalId, index) {
  const parsed = new URL(url);
  const extension = [".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif"].includes(extname(parsed.pathname).toLowerCase()) ? extname(parsed.pathname).toLowerCase() : ".jpg";
  const safeId = String(externalId).toLowerCase().replace(/[^a-z0-9_-]+/gi, "-").replace(/^-+|-+$/g, "").slice(0, 100) || "product";
  const key = `${safeId}-${index + 1}${extension}`;
  const target = join(mediaDirectory, key);
  try { await access(target); return { url: `${mediaPublicBase}/${key}`, externalUrl: url, downloaded: true }; } catch {}
  const response = await fetch(url, { redirect: "follow" });
  if (!response.ok) throw new Error(`image ${response.status}`);
  const contentType = (response.headers.get("content-type") || "").split(";", 1)[0].trim().toLowerCase();
  if (!allowedImageTypes.has(contentType)) throw new Error(`unsupported image type ${contentType || "unknown"}`);
  const contentLength = Number(response.headers.get("content-length") || 0);
  if (contentLength > maxImageBytes) throw new Error(`image exceeds ${maxImageBytes} bytes`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (!bytes.length) throw new Error("empty image");
  if (bytes.length > maxImageBytes) throw new Error(`image exceeds ${maxImageBytes} bytes`);
  await mkdir(mediaDirectory, { recursive: true });
  await writeFile(target, bytes);
  return { url: `${mediaPublicBase}/${key}`, externalUrl: url, downloaded: true };
}

function normalizeRow(row, index) {
  const sourceExternalId = String(row["Tilda UID"] || row["External ID"] || "").trim();
  const uid = sourceExternalId || `row-${index + 1}`;
  const title = row.Title.trim() || `Товар ${index + 1}`;
  const sanitized = sanitizeHtml(row.Text || row.Description || "");
  const text = cleanHtml(sanitized.html);
  const categories = categoryParts(row.Category || "Без категории");
  const productCategories = categories.filter((item) => !/популяр|новин|клеев/i.test(item));
  const primary = productCategories[0] || categories[0] || "Без категории";
  const collections = categories.filter((item) => /популяр|новин|клеев/i.test(item)).map((item) => /новин/i.test(item) ? "novinki" : /популяр/i.test(item) ? "popular" : "adhesive");
  const images = imageUrls(row.Photo);
  const price = Number(String(row.Price || "0").replace(",", ".").replace(/[^\d.]/g, "")) || 0;
  const oldPrice = Number(String(row["Price Old"] || "").replace(",", ".").replace(/[^\d.]/g, "")) || null;
  const characteristics = parseCharacteristics(text);
  const needsReview = !row.SKU || !row.Photo || !text || !characteristics.length || characteristics.some((characteristic) => characteristic.needsReview) || /copy:/i.test(title);
  return { externalId: uid, sourceExternalId, rowNumber: index + 2, sku: row.SKU.trim(), name: title, slug: slugify(title, uid), shortName: title, descriptionHtml: text, shortDescription: textFromHtml(text).slice(0, 240), seoDescription: textFromHtml(text).slice(0, 320), price, oldPrice, primaryCategory: { slug: categorySlug(primary), title: primary }, additionalCategories: productCategories.slice(1).map((item) => ({ slug: categorySlug(item), title: item })), collections, images, characteristics, needsReview, sanitizationWarnings: sanitized.warnings, raw: { quantity: row.Quantity || "", weight: row.Weight || "", length: row.Length || "", width: row.Width || "", height: row.Height || "" } };
}

const rows = parseCsv(await readFile(source, "utf8"));
const records = rows.map(normalizeRow);
function recordReference(record) {
  return { externalId: record.externalId, rowNumber: record.rowNumber };
}
function duplicateGroups(field, includeEmpty = false) {
  const groups = records.reduce((map, record) => {
    const value = record[field];
    if (includeEmpty || value) map[value] = [...(map[value] || []), record];
    return map;
  }, {});
  return Object.entries(groups).filter(([, group]) => group.length > 1).map(([value, group]) => ({ value, records: group.map(recordReference) }));
}
const missingSku = records.filter((record) => !record.sku).map(recordReference);
const missingText = records.filter((record) => !record.descriptionHtml).map(recordReference);
const missingImage = records.filter((record) => !record.images.length).map(recordReference);
const missingExternalId = records.filter((record) => !record.sourceExternalId).map(recordReference);
const duplicateSkuGroups = duplicateGroups("sku");
const duplicateExternalIdGroups = duplicateGroups("externalId");
const duplicateSlugGroups = duplicateGroups("slug");
const duplicates = { sku: duplicateSkuGroups.map(({ value: sku, records: items }) => ({ sku, ids: items.map((item) => item.externalId), records: items })), externalId: duplicateExternalIdGroups.map(({ value: externalId, records: items }) => ({ externalId, records: items })), slug: duplicateSlugGroups.map(({ value: slug, records: items }) => ({ slug, records: items })) };
const conflicts = { duplicateSkus: duplicates.sku, duplicateExternalIds: duplicates.externalId, duplicateSlugs: duplicates.slug, missingExternalId };
const missing = { sku: missingSku, text: missingText, image: missingImage, externalId: missingExternalId };
const quality = { missing, missingSku, missingText, missingImage, duplicates, conflicts };
function countValues(values) {
  return values.reduce((counts, value) => { counts[value] = (counts[value] || 0) + 1; return counts; }, {});
}
const conflictCount = duplicateSkuGroups.length + duplicateExternalIdGroups.length + duplicateSlugGroups.length + missingExternalId.length;
const stats = { total: records.length, withSku: records.filter((record) => record.sku).length, withoutSku: records.filter((record) => !record.sku).length, withText: records.filter((record) => record.descriptionHtml).length, withoutText: records.filter((record) => !record.descriptionHtml).length, withPhoto: records.filter((record) => record.images.length).length, withoutPhoto: records.filter((record) => !record.images.length).length, totalImages: records.reduce((total, record) => total + record.images.length, 0), uniqueImageUrls: new Set(records.flatMap((record) => record.images)).size, needsReview: records.filter((record) => record.needsReview).length, sanitizedRecords: records.filter((record) => record.sanitizationWarnings.length).length, conflictCount, conflicts, sourceIdentifiers: records.map((record) => ({ externalId: record.externalId, rowNumber: record.rowNumber })), primaryCategoryCounts: countValues(records.map((record) => record.primaryCategory.slug)), additionalCategoryCounts: countValues(records.flatMap((record) => record.additionalCategories.map((category) => category.slug))), collectionCounts: countValues(records.flatMap((record) => record.collections)) };
const report = { source, mode: dryRun ? "dry-run" : "apply", generatedAt: new Date().toISOString(), storage: { directory: mediaDirectory, publicBase: mediaPublicBase, independentFromTildaCdn: true }, stats, quality, missingSku, missingText, missingImage, duplicates, conflicts, errors: [], warnings: records.filter((record) => record.sanitizationWarnings.length).map((record) => ({ externalId: record.externalId, rowNumber: record.rowNumber, issues: record.sanitizationWarnings })), sample: records.slice(0, 3).map((record) => { const withoutRaw = { ...record }; delete withoutRaw.raw; return withoutRaw; }) };

if (!dryRun) {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  let runId;
  try {
    const run = await pool.query("INSERT INTO import_runs (source_name, mode, status, stats) VALUES ($1, 'apply', 'running', $2) RETURNING id", [source, JSON.stringify(stats)]);
    runId = run.rows[0].id;
    for (const record of records) {
      const storedImages = [];
      try {
        for (const [imageIndex, externalUrl] of record.images.entries()) {
          try { storedImages.push(await persistImage(externalUrl, record.externalId, imageIndex)); }
          catch (error) {
            const importError = error instanceof Error ? error : new Error(String(error));
            importError.image = externalUrl;
            throw importError;
          }
        }
        const client = await pool.connect();
        try {
          await client.query("BEGIN");
          const category = await client.query(`INSERT INTO categories (slug, title) VALUES ($1, $2) ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title, updated_at = now() RETURNING id`, [record.primaryCategory.slug, record.primaryCategory.title]);
          const product = await client.query(`INSERT INTO products (external_id, sku, name, short_name, slug, short_description, description_html, seo_description, price, old_price, main_category_id, status, quantity, needs_review, published_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'published',NULL,$12,now()) ON CONFLICT (external_id) DO UPDATE SET sku=EXCLUDED.sku,name=EXCLUDED.name,short_name=EXCLUDED.short_name,short_description=EXCLUDED.short_description,description_html=EXCLUDED.description_html,seo_description=EXCLUDED.seo_description,price=EXCLUDED.price,old_price=EXCLUDED.old_price,main_category_id=EXCLUDED.main_category_id,needs_review=EXCLUDED.needs_review,updated_at=now() RETURNING id`, [record.externalId, record.sku || null, record.name, record.shortName, record.slug, record.shortDescription, record.descriptionHtml, record.seoDescription, record.price, record.oldPrice, category.rows[0].id, record.needsReview]);
          const productId = product.rows[0].id;
          await client.query("DELETE FROM product_categories WHERE product_id = $1", [productId]);
          const categoryRecords = [record.primaryCategory, ...record.additionalCategories];
          for (const [categoryIndex, categoryRecord] of categoryRecords.entries()) {
            const relatedCategory = categoryIndex === 0
              ? category
              : await client.query(`INSERT INTO categories (slug, title) VALUES ($1, $2) ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title, updated_at = now() RETURNING id`, [categoryRecord.slug, categoryRecord.title]);
            await client.query("INSERT INTO product_categories (product_id, category_id, is_primary, sort_order) VALUES ($1, $2, $3, $4)", [productId, relatedCategory.rows[0].id, categoryIndex === 0, categoryIndex]);
          }
          for (const collection of record.collections) await client.query("INSERT INTO collections (slug,title,is_featured) VALUES ($1,$2,true) ON CONFLICT (slug) DO UPDATE SET title=EXCLUDED.title,updated_at=now()", [collection, collectionTitle(collection)]);
          await client.query("DELETE FROM product_collections WHERE product_id = $1", [productId]);
          for (const [collectionIndex, collection] of record.collections.entries()) await client.query("INSERT INTO product_collections (product_id, collection_slug, sort_order) VALUES ($1, $2, $3) ON CONFLICT (product_id, collection_slug) DO UPDATE SET sort_order = EXCLUDED.sort_order", [productId, collection, collectionIndex]);
          await client.query("DELETE FROM product_images WHERE product_id = $1", [productId]);
          for (const [sortOrder, image] of storedImages.entries()) await client.query("INSERT INTO product_images (product_id, url, external_url, sort_order, is_primary) VALUES ($1,$2,$3,$4,$5)", [productId, image.url, image.externalUrl, sortOrder, sortOrder === 0]);
          await client.query("UPDATE products SET image_url=$1,updated_at=now() WHERE id=$2", [storedImages[0]?.url || "", productId]);
          await client.query("DELETE FROM product_characteristics WHERE product_id = $1", [productId]);
          for (const [sortOrder, characteristic] of record.characteristics.entries()) await client.query("INSERT INTO product_characteristics (product_id, label, value, confidence, needs_review, sort_order) VALUES ($1,$2,$3,$4,$5,$6)", [productId, characteristic.label, characteristic.value, characteristic.confidence, characteristic.needsReview, sortOrder]);
          await client.query("INSERT INTO audit_log (admin_user_id, action, entity_type, entity_id, changes) VALUES (NULL, 'import', 'product', $1, $2)", [productId, JSON.stringify({ source, externalId: record.externalId, rowNumber: record.rowNumber, sku: record.sku || null, imageCount: storedImages.length, categorySlugs: categoryRecords.map((categoryRecord) => categoryRecord.slug), collectionSlugs: record.collections, needsReview: record.needsReview })]);
          await client.query("COMMIT");
        } catch (error) {
          try { await client.query("ROLLBACK"); } catch {}
          throw error;
        } finally {
          client.release();
        }
      } catch (error) {
        report.errors.push({ externalId: record.externalId, rowNumber: record.rowNumber, ...(error && typeof error === "object" && "image" in error ? { image: error.image } : {}), message: error instanceof Error ? error.message : String(error) });
      }
    }
    await pool.query("UPDATE import_runs SET status = $1, stats = $2, errors = $3, finished_at = now() WHERE id = $4", [report.errors.length ? "failed" : "completed", JSON.stringify(stats), JSON.stringify(report.errors), runId]);
  } finally { await pool.end(); }
}

await mkdir(dirname(reportPath), { recursive: true });
await writeFile(reportPath, JSON.stringify(report, null, 2));
console.log(JSON.stringify({ reportPath, ...stats, errors: report.errors.length }, null, 2));
