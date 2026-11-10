import { revalidatePath } from "next/cache";

export type CatalogRevalidationFailure = {
  path: string;
  message: string;
};

export class CatalogRevalidationError extends Error {
  readonly failures: CatalogRevalidationFailure[];

  constructor(failures: CatalogRevalidationFailure[]) {
    super(`Catalog revalidation failed for ${failures.map((failure) => failure.path).join(", ")}`);
    this.name = "CatalogRevalidationError";
    this.failures = failures;
  }
}

export function revalidateCatalog(slug?: string) {
  const paths = [
    "/catalog",
    "/catalog/category/[slug]",
    "/",
    "/sitemap.xml",
    ...(slug ? [`/catalog/${slug}`] : []),
  ];
  const failures: CatalogRevalidationFailure[] = [];

  for (const path of paths) {
    try {
      revalidatePath(path);
    } catch (error) {
      failures.push({
        path,
        message: error instanceof Error ? error.message : "Unknown revalidation error",
      });
    }
  }

  if (failures.length > 0) {
    console.error("[catalog] post-commit revalidation failed", failures);
    throw new CatalogRevalidationError(failures);
  }
}
