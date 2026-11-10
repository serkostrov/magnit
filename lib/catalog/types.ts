export type ProductCategory =
  | "diski"
  | "pryamougolnye"
  | "kolca"
  | "zenkovka"
  | "krepleniya"
  | "poiskovye";

export type ProductStatus = "draft" | "published" | "hidden";

export type ProductForm =
  | "Диск"
  | "Прямоугольник"
  | "Кольцо"
  | "Крепление"
  | "Поисковый";

export type ProductCharacteristic = {
  label: string;
  value: string;
  confidence?: number;
  needsReview?: boolean;
  filterKey?: string;
  filterSlug?: string;
  filterEnabled?: boolean;
};

export type Product = {
  id: string;
  externalId?: string;
  slug: string;
  sku: string;
  name: string;
  shortName: string;
  category: ProductCategory;
  categoryLabel: string;
  form: ProductForm;
  price: number;
  image: string;
  gallery: string[];
  badge?: "Новинка" | "Хит";
  available: boolean;
  shortDescription: string;
  seoDescription: string;
  descriptionHtml?: string;
  description: string[];
  characteristics: ProductCharacteristic[];
  useCases: string[];
  createdAt: string;
  popularity: number;
  status?: ProductStatus;
  oldPrice?: number | null;
  seoTitle?: string;
  mainCategory?: string;
  additionalCategories?: string[];
  collections?: string[];
  quantity?: number | null;
  characteristicConfidence?: number;
  needsReview?: boolean;
  publishedAt?: string | null;
  updatedAt?: string;
};

export type CatalogCategory = {
  slug: string;
  title: string;
  description: string;
  image: string;
  featured: boolean;
  homeColor?: "blue" | "mint" | "sand" | "lilac" | "rose" | "cyan";
  badge?: string;
};

export type CatalogPage = {
  items: Product[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
};
