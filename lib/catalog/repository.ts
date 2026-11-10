import { isDatabaseConfigured, query } from "../db/client";
import { products as demoProducts } from "./products";
import { cleanProductSummary, sanitizeProductHtml } from "./html";
import type {
  CatalogCategory,
  CatalogPage,
  Product,
  ProductCategory,
  ProductForm,
  ProductStatus,
} from "./types";
import { builtInCatalogFilters, type CatalogFilterDefinition } from "./filter-definitions";

export type CatalogFilters = {
  search?: string;
  category?: string;
  characteristics?: Record<string, string>;
  priceFrom?: number;
  priceTo?: number;
  sort?: "popular" | "new" | "price-asc" | "price-desc";
  page?: number;
  pageSize?: number;
  includeHidden?: boolean;
};

export interface CatalogRepository {
  getAll(): Promise<Product[]>;
  getBySlug(slug: string): Promise<Product | null>;
  getBestsellers(limit?: number): Promise<Product[]>;
  getNewProducts(limit?: number): Promise<Product[]>;
  getPage(filters?: CatalogFilters): Promise<CatalogPage>;
  getCategories(): Promise<CatalogCategory[]>;
  getFilterDefinitions(includeDisabled?: boolean): Promise<CatalogFilterDefinition[]>;
}

const demoCategories: CatalogCategory[] = [
  { slug: "diski", title: "Диски и цилиндры", description: "Универсальные магниты для крепления и упаковки.", image: "/assets/cat-diski.webp", featured: true, homeColor: "blue" },
  { slug: "pryamougolnye", title: "Прямоугольные", description: "Тонкие и усиленные прямоугольные магниты.", image: "/assets/cat-pryam.webp", featured: true, homeColor: "mint" },
  { slug: "kolca", title: "Кольца и шайбы", description: "Магниты с отверстием для монтажа.", image: "/assets/cat-kolca.webp", featured: true, homeColor: "sand" },
  { slug: "zenkovka", title: "С зенковкой", description: "Крепления под потайной винт.", image: "/assets/cat-zenk.webp", featured: true, homeColor: "lilac" },
  { slug: "krepleniya", title: "Крепления и держатели", description: "Готовые магнитные крепления в корпусе.", image: "/assets/cat-krep.webp", featured: true, homeColor: "rose" },
  { slug: "poiskovye", title: "Поисковые", description: "Магниты для поиска и подъёма металлических предметов.", image: "/assets/cat-poisk.webp", featured: true, homeColor: "cyan" },
];

function sortProducts(items: Product[], sort: CatalogFilters["sort"] = "popular") {
  return [...items].sort((left, right) => {
    if (sort === "price-asc") return left.price - right.price;
    if (sort === "price-desc") return right.price - left.price;
    if (sort === "new") return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
    return right.popularity - left.popularity;
  });
}

function demoPage(filters: CatalogFilters = {}): CatalogPage {
  const pageSize = filters.pageSize ?? 24;
  const requestedPage = Number.isSafeInteger(filters.page) ? Number(filters.page) : 1;
  const page = Math.max(1, requestedPage);
  const normalizedSearch = filters.search?.trim().toLowerCase() ?? "";
  const minimum = Number.isFinite(filters.priceFrom) ? Number(filters.priceFrom) : 0;
  const maximum = Number.isFinite(filters.priceTo) ? Number(filters.priceTo) : Number.POSITIVE_INFINITY;
  const filtered = sortProducts(demoProducts.filter((product) => {
    const searchMatches = !normalizedSearch || `${product.name} ${product.sku} ${product.shortDescription}`.toLowerCase().includes(normalizedSearch);
    const characteristicMatches = Object.entries(filters.characteristics || {}).every(([key, slug]) => {
      const definition = builtInCatalogFilters.find((item) => item.key === key);
      const option = definition?.options.find((item) => item.slug === slug);
      if (!definition || !option) return true;
      return product.characteristics.some((item) => item.label.toLowerCase() === definition.sourceLabel.toLowerCase() && item.value === option.value);
    });
    return searchMatches && (!filters.category || product.category === filters.category) && characteristicMatches && product.price >= minimum && product.price <= maximum;
  }), filters.sort);
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, pageCount);
  return { items: filtered.slice((safePage - 1) * pageSize, safePage * pageSize), total: filtered.length, page: safePage, pageSize, pageCount };
}

export function rowToProduct(row: Record<string, unknown>, images: string[] = [], characteristics: Product["characteristics"] = []): Product {
  const category = String(row.category_slug || "diski") as ProductCategory;
  const image = String(row.image_url || images[0] || "/assets/bs-10x2.webp");
  const descriptionHtml = sanitizeProductHtml(String(row.description_html || ""));
  const shortDescription = cleanProductSummary(String(row.short_description || ""));
  return {
    id: String(row.id),
    externalId: row.external_id ? String(row.external_id) : undefined,
    slug: String(row.slug),
    sku: String(row.sku || ""),
    name: String(row.name),
    shortName: String(row.short_name || row.name),
    category,
    categoryLabel: String(row.category_title || row.category_slug || "Магниты"),
    form: String(row.form || "Диск") as ProductForm,
    price: Number(row.price || 0),
    oldPrice: row.old_price == null ? null : Number(row.old_price),
    image,
    gallery: images.length > 0 ? images : [image],
    badge: row.badge ? String(row.badge) as Product["badge"] : undefined,
    available: true,
    status: String(row.status || "published") as ProductStatus,
    quantity: row.quantity == null ? null : Number(row.quantity),
    shortDescription,
    seoTitle: row.seo_title ? String(row.seo_title) : undefined,
    seoDescription: cleanProductSummary(String(row.seo_description || shortDescription)),
    descriptionHtml,
    description: descriptionHtml ? [descriptionHtml] : [],
    characteristics,
    useCases: Array.isArray(row.use_cases) ? row.use_cases.map(String) : [],
    createdAt: new Date(String(row.created_at || Date.now())).toISOString(),
    updatedAt: row.updated_at ? new Date(String(row.updated_at)).toISOString() : undefined,
    publishedAt: row.published_at ? new Date(String(row.published_at)).toISOString() : null,
    popularity: Number(row.popularity || 0),
    mainCategory: row.category_slug ? String(row.category_slug) : undefined,
    additionalCategories: Array.isArray(row.additional_categories) ? row.additional_categories.map(String) : [],
    collections: Array.isArray(row.collections) ? row.collections.map(String) : [],
    needsReview: Boolean(row.needs_review),
  };
}

async function dbProductBySlug(slug: string) {
  const result = await query<Record<string, unknown>>(`
    SELECT p.*, c.slug AS category_slug, c.title AS category_title,
      COALESCE(array_agg(DISTINCT pi.url) FILTER (WHERE pi.url IS NOT NULL), '{}') AS images,
      COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'label', pc.label,
          'value', pc.value,
          'confidence', pc.confidence,
          'needsReview', pc.needs_review,
          'filterKey', settings.filter_key,
          'filterSlug', COALESCE(options.slug, pc.value),
          'filterEnabled', COALESCE(settings.is_enabled, false)
        ) ORDER BY pc.sort_order, pc.id)
        FROM product_characteristics pc
        LEFT JOIN catalog_filter_settings settings ON lower(trim(settings.source_label)) = lower(trim(pc.label))
        LEFT JOIN catalog_filter_options options ON options.filter_key = settings.filter_key AND options.value = pc.value
        WHERE pc.product_id = p.id AND pc.needs_review = false
      ), '[]'::jsonb) AS characteristics,
      COALESCE((SELECT array_agg(related.slug ORDER BY relation.sort_order) FROM product_categories relation JOIN categories related ON related.id = relation.category_id WHERE relation.product_id = p.id AND relation.is_primary = false), '{}') AS additional_categories
    FROM products p
    LEFT JOIN categories c ON c.id = p.main_category_id
    LEFT JOIN product_images pi ON pi.product_id = p.id
    WHERE p.slug = $1 AND p.status = 'published'
    GROUP BY p.id, c.slug, c.title
    LIMIT 1`, [slug]);
  if (!result.rows[0]) return null;
  const row = result.rows[0];
  return rowToProduct(row, (row.images as string[]) || [], (row.characteristics as Product["characteristics"]) || []);
}

async function dbPage(filters: CatalogFilters = {}): Promise<CatalogPage> {
  const pageSize = filters.pageSize ?? 24;
  const requestedPage = Number.isSafeInteger(filters.page) ? Number(filters.page) : 1;
  const page = Math.max(1, requestedPage);
  const clauses = [filters.includeHidden ? "TRUE" : "p.status = 'published'"];
  const params: unknown[] = [];
  if (filters.search?.trim()) {
    params.push(`%${filters.search.trim()}%`);
    clauses.push(`(p.name ILIKE $${params.length} OR p.sku ILIKE $${params.length} OR p.short_description ILIKE $${params.length})`);
  }
  if (filters.category) {
    params.push(filters.category);
    clauses.push(`(c.slug = $${params.length} OR EXISTS (SELECT 1 FROM product_categories category_relation JOIN categories related_category ON related_category.id = category_relation.category_id WHERE category_relation.product_id = p.id AND related_category.slug = $${params.length}))`);
  }
  for (const [filterKey, filterSlug] of Object.entries(filters.characteristics || {})) {
    if (!filterKey || !filterSlug) continue;
    params.push(filterKey, filterSlug);
    clauses.push(`EXISTS (
      SELECT 1
      FROM product_characteristics filtered_characteristic
      JOIN catalog_filter_settings filter_setting
        ON lower(trim(filter_setting.source_label)) = lower(trim(filtered_characteristic.label))
      LEFT JOIN catalog_filter_options filter_option
        ON filter_option.filter_key = filter_setting.filter_key
       AND filter_option.value = filtered_characteristic.value
      WHERE filtered_characteristic.product_id = p.id
        AND filter_setting.filter_key = $${params.length - 1}
        AND (filter_option.slug = $${params.length} OR (filter_option.slug IS NULL AND filtered_characteristic.value = $${params.length}))
    )`);
  }
  if (filters.priceFrom != null && Number.isFinite(filters.priceFrom)) { params.push(filters.priceFrom); clauses.push(`p.price >= $${params.length}`); }
  if (filters.priceTo != null && Number.isFinite(filters.priceTo)) { params.push(filters.priceTo); clauses.push(`p.price <= $${params.length}`); }
  const where = clauses.join(" AND ");
  const count = await query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM products p LEFT JOIN categories c ON c.id = p.main_category_id WHERE ${where}`, params);
  const order = filters.sort === "price-asc" ? "p.price ASC" : filters.sort === "price-desc" ? "p.price DESC" : filters.sort === "new" ? "p.created_at DESC" : "p.popularity DESC, p.created_at DESC";
  const total = Number(count.rows[0]?.count || 0);
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, pageCount);
  const offset = (safePage - 1) * pageSize;
  const rows = await query<Record<string, unknown>>(`
    SELECT p.*, c.slug AS category_slug, c.title AS category_title,
      COALESCE(array_agg(DISTINCT pi.url) FILTER (WHERE pi.url IS NOT NULL), '{}') AS images
    FROM products p LEFT JOIN categories c ON c.id = p.main_category_id
    LEFT JOIN product_images pi ON pi.product_id = p.id
    WHERE ${where}
    GROUP BY p.id, c.slug, c.title
    ORDER BY ${order} LIMIT $${params.length + 1} OFFSET $${params.length + 2}`, [...params, pageSize, offset]);
  const items = rows.rows.map((row) => rowToProduct(row, (row.images as string[]) || []));
  return { items, total, page: safePage, pageSize, pageCount };
}

async function safe<T>(database: () => Promise<T>, fallback: () => T): Promise<T> {
  if (!isDatabaseConfigured()) return fallback();
  return database();
}

export const catalogRepository: CatalogRepository = {
  async getAll() { return (await this.getPage({ pageSize: 10_000 })).items; },
  async getBySlug(slug) { return safe(() => dbProductBySlug(slug), () => demoProducts.find((product) => product.slug === slug) ?? null); },
  async getBestsellers(limit = 8) { return (await this.getPage({ pageSize: 10_000, sort: "popular" })).items.slice(0, limit); },
  async getNewProducts(limit = 4) { return (await this.getPage({ pageSize: 10_000, sort: "new" })).items.slice(0, limit); },
  async getPage(filters = {}) { return safe(() => dbPage(filters), () => demoPage(filters)); },
  async getCategories() { return safe(async () => {
    const result = await query<Record<string, unknown>>(`
      SELECT slug, title, description, image_url, is_featured, home_color
      FROM categories c
      WHERE EXISTS (SELECT 1 FROM products p WHERE p.main_category_id = c.id AND p.status = 'published')
         OR EXISTS (SELECT 1 FROM product_categories pc JOIN products p ON p.id = pc.product_id WHERE pc.category_id = c.id AND p.status = 'published')
      ORDER BY sort_order, title`);
    return result.rows.map((row): CatalogCategory => ({
      slug: String(row.slug),
      title: String(row.title),
      description: String(row.description || ""),
      image: String(row.image_url || "/assets/cat-diski.webp"),
      featured: Boolean(row.is_featured),
      homeColor: String(row.home_color || "blue") as CatalogCategory["homeColor"],
    }));
  }, () => demoCategories); },
  async getFilterDefinitions(includeDisabled = false) { return safe(async () => {
    const settings = await query<{ filter_key: string; label: string; source_label: string; is_enabled: boolean }>(`
      SELECT filter_key, label, source_label, is_enabled
      FROM catalog_filter_settings
      ${includeDisabled ? "" : "WHERE is_enabled = true"}
      ORDER BY sort_order, label`);
    const options = await query<{ filter_key: string; slug: string; value: string }>(`
      SELECT filter_key, slug, value FROM catalog_filter_options ORDER BY sort_order, value`);
    const discovered = await query<{ filter_key: string; value: string }>(`
      SELECT settings.filter_key, characteristic.value
      FROM catalog_filter_settings settings
      JOIN product_characteristics characteristic ON lower(trim(characteristic.label)) = lower(trim(settings.source_label))
      JOIN products product ON product.id = characteristic.product_id
      WHERE product.status = 'published'
      GROUP BY settings.filter_key, characteristic.value
      ORDER BY characteristic.value`);
    return settings.rows.map((setting) => ({
      key: setting.filter_key,
      label: setting.label,
      sourceLabel: setting.source_label,
      enabled: setting.is_enabled,
      options: [
        ...options.rows.filter((option) => option.filter_key === setting.filter_key).map((option) => ({ slug: option.slug, value: option.value })),
        ...discovered.rows
          .filter((option) => option.filter_key === setting.filter_key && !options.rows.some((stored) => stored.filter_key === setting.filter_key && stored.value === option.value))
          .map((option) => ({ slug: option.value, value: option.value })),
      ],
    }));
  }, () => builtInCatalogFilters.filter((filter) => includeDisabled || filter.enabled)); },
};

export const getAllProducts = () => catalogRepository.getAll();
export const getProductBySlug = (slug: string) => catalogRepository.getBySlug(slug);
export const getBestsellers = (limit = 8) => catalogRepository.getBestsellers(limit);
export const getNewProducts = (limit = 4) => catalogRepository.getNewProducts(limit);
export const getCatalogPage = (filters: CatalogFilters = {}) => catalogRepository.getPage(filters);
export const getCatalogCategories = () => catalogRepository.getCategories();
export const getCatalogFilterDefinitions = (includeDisabled = false) => catalogRepository.getFilterDefinitions(includeDisabled);
