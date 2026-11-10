import type { ReactNode } from "react";
import { connection } from "next/server";
import { getCatalogCategories } from "../lib/catalog/service";
import { SiteChromeFrame } from "./SiteChromeFrame";

export async function SiteChrome({ children }: { children: ReactNode }) {
  await connection();
  const categories = await getCatalogCategories();
  return (
    <SiteChromeFrame
      categories={categories.map((category) => ({
        slug: category.slug,
        title: category.title,
      }))}
    >
      {children}
    </SiteChromeFrame>
  );
}
