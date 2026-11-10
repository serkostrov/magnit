"use client";

import Link from "next/link";
import { useState } from "react";
import { addToCart, formatPrice } from "../lib/cart";
import type { Product } from "../lib/catalog/types";

export function ProductBuyBox({ product }: { product: Product }) {
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);

  function add() {
    addToCart(product.slug, quantity);
    setAdded(true);
  }

  return (
    <div className="product-buy">
      <div className="product-price-row">
        <strong>{formatPrice(product.price)} ₽</strong>
        <span>за 1 шт.</span>
      </div>
      <p className="price-note">
        Оптовую цену рассчитаем по вашему списку и объёму заказа.
      </p>
      <div className="buy-controls">
        <div className="quantity-control" aria-label="Количество">
          <button
            type="button"
            onClick={() => setQuantity((value) => Math.max(1, value - 1))}
            aria-label="Уменьшить количество"
          >
            −
          </button>
          <span>{quantity}</span>
          <button
            type="button"
            onClick={() => setQuantity((value) => value + 1)}
            aria-label="Увеличить количество"
          >
            +
          </button>
        </div>
        <button className="button button-primary buy-button" type="button" onClick={add}>
          {added ? "Добавлено" : "Добавить в корзину"}
        </button>
      </div>
      {added && (
        <div className="buy-success">
          Добавили {quantity} шт. <Link href="/cart">Перейти в корзину →</Link>
        </div>
      )}
      <div className="product-service-list">
        <span>
          <b>Подбор с запасом</b>
          Проверим силу под вашу задачу
        </span>
        <span>
          <b>Документы для бизнеса</b>
          Счёт, УПД и ЭДО
        </span>
        <span>
          <b>Доставка по России</b>
          СДЭК, ПЭК и Деловые линии
        </span>
      </div>
    </div>
  );
}
