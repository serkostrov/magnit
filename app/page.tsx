import type { Metadata } from "next";
import { HomeQuiz } from "../components/HomeQuiz";
import { OriginalHomeInteractions } from "../components/OriginalHomeInteractions";
import { loadOriginalHome } from "../lib/original-home";
import { formatPrice } from "../lib/cart";
import { getPublishedCollectionProducts } from "../lib/catalog/collection-service";
import { getHomeBlockOrder, getHomeBlockRanges } from "../lib/catalog/home-block-service";
import { getCatalogCategories } from "../lib/catalog/service";
import { shouldRemoveProductImageBackground } from "../lib/media/white-background";
import type { CatalogCategory, Product } from "../lib/catalog/types";

export const metadata: Metadata = {
  title: {
    absolute:
      "Неодимовые магниты оптом с доставкой по России — saitmagnitov.ru",
  },
  description:
    "6000 артикулов неодимовых магнитов в каталоге и под заказ. Опт от 30 000 ₽, розница без минимальной суммы, доставка по России.",
  alternates: {
    canonical: "/",
  },
};

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] || character);
}

function renderCollectionProducts(products: Product[]) {
  return `<div class="bs reveal">${products.map((product) => {
    const image = escapeHtml(product.image || product.gallery[0] || "/assets/bs-10x2.webp");
    const name = escapeHtml(product.shortName || product.name);
    const description = escapeHtml(product.shortDescription || product.seoDescription || "Товар из локального каталога");
    const sku = escapeHtml(product.sku || "Без артикула");
    const imageState = shouldRemoveProductImageBackground(product.image || product.gallery[0] || "")
      ? "is-processing"
      : "is-ready";
    return `<div class="pr" data-slug="${escapeHtml(product.slug)}"><div class="pic ph"><img class="product-cutout-image catalog-product-image ${imageState}" src="${image}" data-product-image-source="${image}" alt="${escapeHtml(product.name)}" loading="lazy"></div><div class="bd"><div class="code">${sku}</div><h4>${name}</h4><div class="sp">${description}</div><div class="pp">${formatPrice(product.price)} ₽<small> / шт · розница</small></div><div class="opt">Опт от 30 000 ₽ — цена ниже</div><button class="add">Запросить →</button></div></div>`;
  }).join("")}</div>`;
}

function renderHomeCategories(categories: CatalogCategory[]) {
  const hasFeatured = categories.some((category) => category.featured);
  return `<div class="cats reveal" id="cats">${categories.map((category, index) => {
    const isVisible = hasFeatured ? category.featured : index < 8;
    const tone = category.homeColor || "blue";
    const image = escapeHtml(category.image || "/assets/cat-diski.webp");
    const href = `/catalog/category/${encodeURIComponent(category.slug)}`;
    return `<div class="cat home-tone-${tone}${isVisible ? "" : " more"}" data-href="${href}"><div class="ico ph"><img src="${image}" alt="${escapeHtml(category.title)}" loading="lazy"></div><h4>${escapeHtml(category.title)}</h4>${category.description ? `<p>${escapeHtml(category.description)}</p>` : ""}<div class="cat-link">Смотреть товары →</div></div>`;
  }).join("")}</div>`;
}

function applyHomeCategories(html: string, categories: CatalogCategory[]) {
  if (!categories.length) return html;
  const start = html.indexOf('<div class="cats reveal" id="cats">');
  const end = html.indexOf('<form class="mini-lead', start);
  if (start === -1 || end === -1) return html;
  return `${html.slice(0, start)}${renderHomeCategories(categories)}\n  ${html.slice(end)}`;
}

function removeHomeCategoryToggle(html: string) {
  return html.replace(/\s*<div class="cats-toggle reveal">[\s\S]*?<\/div>/, "");
}

function removeCompanyDetailsLink(html: string) {
  return html.replace(
    /\s*<div[^>]*class="reveal"[^>]*><a href="#" class="btn btn-ghost">Подробнее о компании →<\/a><\/div>/,
    "",
  );
}

function removeOrderStatuses(html: string) {
  return html.replace(/<span class="stk">Доступен к заказу<\/span>/g, "");
}

function applyHomeProductImageRendering(html: string) {
  return html.replace(
    /(<div class="pic ph"><img)([^>]*)(>)/g,
    (markup, start: string, attributes: string, end: string) => {
      if (/\bdata-product-image-source=/.test(attributes)) return markup;
      const source = attributes.match(/\bsrc="([^"]+)"/)?.[1];
      if (!source) return markup;
      const imageState = shouldRemoveProductImageBackground(source)
        ? "is-processing"
        : "is-ready";
      return `${start} class="product-cutout-image catalog-product-image ${imageState}"${attributes} data-product-image-source="${source}"${end}`;
    },
  );
}

function applyPopularCollection(html: string, products: Product[]) {
  if (!products.length) return html;
  const start = html.indexOf('<div class="bs reveal">');
  const end = html.indexOf('<div style="text-align:center;margin-top:32px" class="reveal">', start);
  if (start === -1 || end === -1) return html;
  return `${html.slice(0, start)}${renderCollectionProducts(products)}\n  ${html.slice(end)}`;
}

function applyHomeBlockOrder(html: string, order: string[]) {
  const ranges = getHomeBlockRanges();
  const blocks = order.map((key) => {
    const range = ranges[key as keyof typeof ranges];
    if (!range) return null;
    const start = html.indexOf(range.start);
    const end = range.end ? html.indexOf(range.end, start) : html.length;
    return start >= 0 && end >= start ? { start, end, content: html.slice(start, end) } : null;
  });
  if (blocks.some((block) => !block)) return html;
  const resolved = blocks as Array<{ start: number; end: number; content: string }>;
  const firstStart = Math.min(...resolved.map((block) => block.start));
  const lastEnd = Math.max(...resolved.map((block) => block.end));
  return `${html.slice(0, firstStart)}${resolved.map((block) => block.content).join("\n")}${html.slice(lastEnd)}`;
}

export default async function HomePage() {
  const [original, popularProducts, homeBlockOrder, categories] = await Promise.all([
    loadOriginalHome(),
    getPublishedCollectionProducts("popular", 8),
    getHomeBlockOrder(),
    getCatalogCategories(),
  ]);
  const homeHtml = removeOrderStatuses(removeCompanyDetailsLink(removeHomeCategoryToggle(
    applyHomeProductImageRendering(
      applyHomeBlockOrder(
        applyHomeCategories(applyPopularCollection(original.html, popularProducts), categories),
        homeBlockOrder,
      ),
    )),
  ));
  const organizationJsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Сайт Магнитов",
    url: "https://saitmagnitov.ru",
    telephone: "+7-495-120-75-67",
    email: "info@smagn.ru",
    foundingDate: "2013",
  };

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: original.css }} />
      <div
        className="original-home"
        dangerouslySetInnerHTML={{ __html: homeHtml }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
      />
      <HomeQuiz />
      <OriginalHomeInteractions />
    </>
  );
}
