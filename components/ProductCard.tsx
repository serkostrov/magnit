"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { addToCart, formatPrice, readFavorites, toggleFavorite } from "../lib/cart";
import type { Product } from "../lib/catalog/types";
import { ProductImage } from "./CatalogProductImage";

export function ProductCard({ product }: { product: Product }) {
  const [added, setAdded] = useState(false);
  const [favorite, setFavorite] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(
      () => setFavorite(readFavorites().includes(product.slug)),
      0,
    );
    return () => window.clearTimeout(timer);
  }, [product.slug]);

  function handleAdd() {
    addToCart(product.slug);
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1600);
  }

  function handleFavorite() {
    setFavorite(toggleFavorite(product.slug));
    window.dispatchEvent(new Event("storage"));
  }

  return (
    <article className="product-card">
      <div className="product-card-image">
        <Link href={`/catalog/${product.slug}`} tabIndex={-1}>
          <ProductImage src={product.image} alt={product.name} />
        </Link>
        {product.badge && (
          <span
            className={`product-badge ${product.badge === "Новинка" ? "is-new" : ""}`}
          >
            {product.badge}
          </span>
        )}
        <button
          className={`favorite-button ${favorite ? "is-active" : ""}`}
          type="button"
          aria-label={favorite ? "Удалить из избранного" : "Добавить в избранное"}
          onClick={handleFavorite}
        >
          {favorite ? "♥" : "♡"}
        </button>
      </div>
      <div className="product-card-body">
        {product.sku && <div className="product-card-meta"><span>{product.sku}</span></div>}
        <Link href={`/catalog/${product.slug}`}>
          <h3>{product.shortName}</h3>
        </Link>
        <p>{product.shortDescription}</p>
        <div className="product-card-price">
          <strong>{formatPrice(product.price)} ₽</strong>
          <small>/ шт.</small>
        </div>
        <button
          className={`button product-add ${added ? "is-added" : ""}`}
          type="button"
          onClick={handleAdd}
        >
          {added ? "Добавлено" : "В корзину"}
        </button>
      </div>
    </article>
  );
}
