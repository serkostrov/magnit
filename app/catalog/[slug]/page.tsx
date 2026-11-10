import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "../../../components/Breadcrumbs";
import { ProductBuyBox } from "../../../components/ProductBuyBox";
import { ProductCard } from "../../../components/ProductCard";
import { ProductGallery } from "../../../components/ProductGallery";
import { formatPrice } from "../../../lib/cart";
import {
  getAllProducts,
} from "../../../lib/catalog/service";
import {
  getProductBySlug,
} from "../../../lib/catalog/publication-service";
import { groupProductCharacteristics } from "../../../lib/catalog/product-characteristics";

export async function generateStaticParams() {
  const products = await getAllProducts();
  return products.map((product) => ({ slug: product.slug }));
}

// Новые опубликованные товары должны открываться без обязательной пересборки.
export const dynamic = "force-dynamic";
export const dynamicParams = true;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);

  if (!product) return {};

  return {
    title:
      product.seoTitle ??
      `${product.name} — купить по цене ${formatPrice(product.price)} ₽`,
    description: product.seoDescription,
    alternates: {
      canonical: `/catalog/${product.slug}`,
    },
    openGraph: {
      title: product.name,
      description: product.seoDescription,
      type: "website",
    },
  };
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();

  const allProducts = await getAllProducts();
  const related = allProducts
    .filter(
      (item) => item.category === product.category && item.slug !== product.slug,
    )
    .slice(0, 3);
  const visibleCharacteristics = product.characteristics.filter(
    (characteristic) =>
      characteristic.label.trim().toLowerCase() !== "статус" &&
      !/доступен к заказу/i.test(characteristic.value),
  );
  const characteristicGroups = groupProductCharacteristics(visibleCharacteristics);

  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    ...(product.sku ? { sku: product.sku } : {}),
    image: product.gallery.map(
      (image) => new URL(image, "https://saitmagnitov.ru").href,
    ),
    description: product.seoDescription,
    brand: {
      "@type": "Brand",
      name: "Сайт Магнитов",
    },
    offers: {
      "@type": "Offer",
      url: `https://saitmagnitov.ru/catalog/${product.slug}`,
      priceCurrency: "RUB",
      price: product.price,
      itemCondition: "https://schema.org/NewCondition",
    },
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Главная",
        item: "https://saitmagnitov.ru/",
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Каталог",
        item: "https://saitmagnitov.ru/catalog",
      },
      {
        "@type": "ListItem",
        position: 3,
        name: product.categoryLabel,
        item: `https://saitmagnitov.ru/catalog/category/${encodeURIComponent(product.category)}`,
      },
      {
        "@type": "ListItem",
        position: 4,
        name: product.name,
        item: `https://saitmagnitov.ru/catalog/${product.slug}`,
      },
    ],
  };

  return (
    <main className="inner-main">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />

      <section className="section product-page-section">
        <div className="container">
          <Breadcrumbs
            items={[
              { href: "/", label: "Главная" },
              { href: "/catalog", label: "Каталог" },
              {
                href: `/catalog/category/${product.category}`,
                label: product.categoryLabel,
              },
              { label: product.shortName },
            ]}
          />

          <div className="product-main-grid">
            <ProductGallery
              images={product.gallery}
              name={product.name}
              badge={product.badge}
            />

            <div className="product-info">
              {product.sku && <div className="product-title-meta"><span>{product.sku}</span></div>}
              <h1>{product.name}</h1>
              <p className="product-lead">{product.shortDescription}</p>

              <dl className="product-key-specs">
                {characteristicGroups.map((group) => (
                  <div key={group.key}>
                    <dt>{group.label}</dt>
                    <dd>
                      {group.values.map((characteristic, index) => (
                        <span key={`${characteristic.value}-${characteristic.filterSlug ?? index}`}>
                          {index > 0 ? ", " : ""}
                          {characteristic.filterEnabled && characteristic.filterKey && characteristic.filterSlug ? (
                            <Link href={`/catalog?${encodeURIComponent(characteristic.filterKey)}=${encodeURIComponent(characteristic.filterSlug)}`}>
                              {characteristic.value}
                            </Link>
                          ) : characteristic.value}
                        </span>
                      ))}
                    </dd>
                  </div>
                ))}
              </dl>

              <ProductBuyBox product={product} />
            </div>
          </div>
        </div>
      </section>

      <section className="section product-details-section">
        <div className="container">
          <div className="product-details-grid product-details-grid--description">
            <article>
              <span className="eyebrow">Описание</span>
              <h2>{product.shortName}: особенности и применение</h2>
              {product.descriptionHtml ? (
                <div
                  className="product-description-content"
                  dangerouslySetInnerHTML={{ __html: product.descriptionHtml }}
                />
              ) : (
                <p>{product.shortDescription}</p>
              )}
              {product.useCases.length > 0 && (
                <>
                  <h3>Подходит для задач</h3>
                  <ul className="use-case-list">
                    {product.useCases.map((useCase) => (
                      <li key={useCase}>{useCase}</li>
                    ))}
                  </ul>
                </>
              )}
            </article>
          </div>
        </div>
      </section>

      <section className="section product-advice-section">
        <div className="container product-advice">
          <div>
            <span>Важно для расчёта</span>
            <h2>Паспортная сила — не всегда сила в реальном узле</h2>
          </div>
          <p>
            Краска, клей, тонкая ответная пластина и боковая нагрузка снижают
            удержание. Сообщите условия установки — подберём магнит с правильным
            запасом.
          </p>
          <a className="button button-white" href="tel:+74951207567">
            Получить консультацию
          </a>
        </div>
      </section>

      {related.length > 0 && (
        <section className="section">
          <div className="container">
            <div className="section-heading">
              <div>
                <span className="eyebrow">Похожие товары</span>
                <h2>Другие позиции в этой категории</h2>
              </div>
            </div>
            <div className="related-products">
              {related.map((item) => (
                <ProductCard product={item} key={item.slug} />
              ))}
            </div>
          </div>
        </section>
      )}
    </main>
  );
}
