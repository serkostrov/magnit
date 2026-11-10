import type { Metadata } from "next";
import { OriginalIndustriesInteractions } from "../../components/OriginalIndustriesInteractions";
import { loadOriginalIndustries } from "../../lib/original-industries";
import { industryOptions } from "../../lib/catalog/filter-definitions";
import { getCatalogPage } from "../../lib/catalog/publication-service";

export const metadata: Metadata = {
  title: {
    absolute:
      "Магниты по отраслям: мебель, упаковка, реклама, сварка, промышленность — saitmagnitov.ru",
  },
  description:
    "Подбор неодимовых магнитов для мебельного производства, упаковки, рекламы, электроники, сварки, поисковой рыбалки и промышленной оснастки.",
  alternates: {
    canonical: "/otrasli",
  },
};

export default async function IndustriesPage() {
  const [original, industryCatalogs] = await Promise.all([
    loadOriginalIndustries(),
    Promise.all(industryOptions.map(async (industry) => ({
      slug: industry.slug,
      products: (await getCatalogPage({ characteristics: { industry: industry.slug }, pageSize: 3, sort: "popular" })).items,
    }))),
  ]);
  const productsByIndustry = Object.fromEntries(industryCatalogs.map((item) => [item.slug, item.products.map((product) => ({
    slug: product.slug,
    name: product.shortName || product.name,
    sku: product.sku,
    description: product.shortDescription,
    image: product.image,
  }))]));

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: original.css }} />
      <main
        className="original-industries"
        dangerouslySetInnerHTML={{ __html: original.html }}
      />
      <OriginalIndustriesInteractions productsByIndustry={productsByIndustry} />
    </>
  );
}
