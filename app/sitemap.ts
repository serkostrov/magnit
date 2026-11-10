import type { MetadataRoute } from "next";
import { getAllProducts, getCatalogCategories } from "../lib/catalog/service";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [products, categories] = await Promise.all([
    getAllProducts(),
    getCatalogCategories(),
  ]);
  const baseUrl = "https://saitmagnitov.ru";
  const staticLastModified = new Date("2026-08-05T00:00:00.000Z");

  return [
    {
      url: baseUrl,
      lastModified: staticLastModified,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${baseUrl}/catalog`,
      lastModified: staticLastModified,
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/otrasli`,
      lastModified: staticLastModified,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/opt`,
      lastModified: staticLastModified,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${baseUrl}/delivery`,
      lastModified: staticLastModified,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${baseUrl}/reviews`,
      lastModified: staticLastModified,
      changeFrequency: "monthly",
      priority: 0.6,
    },
    ...categories.map((category) => ({
      url: `${baseUrl}/catalog/category/${category.slug}`,
      lastModified: staticLastModified,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
    ...products.map((product) => ({
      url: `${baseUrl}/catalog/${product.slug}`,
      lastModified: new Date(
        product.updatedAt ?? product.publishedAt ?? product.createdAt,
      ),
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
  ];
}
