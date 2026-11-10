import type { ProductCategory, ProductForm } from "../../catalog/types";
import type {
  CatalogUpsertRecord,
  MoySkladProductSnapshot,
} from "./contracts";

const categoryMap: Record<string, ProductCategory> = {
  "Диски и шайбы": "diski",
  Прямоугольники: "pryamougolnye",
  Кольца: "kolca",
  "С зенковкой": "zenkovka",
  "Магнитные крепления": "krepleniya",
  "Поисковые магниты": "poiskovye",
};

function makeSlug(value: string) {
  return value
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^a-zа-я0-9]+/gi, "-")
    .replace(/^-|-$/g, "");
}

function inferForm(name: string): ProductForm {
  const normalized = name.toLowerCase();
  if (normalized.includes("прямоугол")) return "Прямоугольник";
  if (normalized.includes("кольц") || normalized.includes("зенков")) return "Кольцо";
  if (normalized.includes("креплен")) return "Крепление";
  if (normalized.includes("поисков")) return "Поисковый";
  return "Диск";
}

export function mapMoySkladProduct(
  source: MoySkladProductSnapshot,
): CatalogUpsertRecord {
  const category =
    categoryMap[source.pathName ?? ""] ??
    ("diski" satisfies ProductCategory);
  const price = Math.round((source.salePrices?.[0]?.value ?? 0) / 100);
  const image =
    source.images?.rows?.[0]?.meta?.downloadHref ??
    "/assets/cat-diski.webp";
  const description =
    source.description?.trim() ||
    "Описание будет загружено из МойСклад и дополнено для SEO.";

  return {
    id: `moysklad-${source.id}`,
    externalId: source.id,
    source: "moysklad",
    sourceUpdatedAt: source.updated,
    slug: makeSlug(source.article || source.name),
    sku: source.article || source.id.slice(0, 8),
    name: source.name,
    shortName: source.name,
    category,
    categoryLabel: source.pathName || "Каталог",
    form: inferForm(source.name),
    price,
    image,
    gallery: [image],
    available: !source.archived,
    shortDescription: description,
    seoDescription: `${source.name}: характеристики, цена и условия заказа в интернет-магазине «Сайт Магнитов».`,
    description: [description],
    characteristics: [],
    useCases: [],
    createdAt: source.updated.slice(0, 10),
    popularity: 0,
  };
}
