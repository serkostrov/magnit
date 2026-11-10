"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  CartLine,
  formatPrice,
  readCart,
  writeCart,
} from "../lib/cart";
import type { Product } from "../lib/catalog/types";
import { formatRussianPhone } from "../lib/phone";

export function CartClient({ products }: { products: Product[] }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [buyerType, setBuyerType] = useState<"legal" | "individual">("legal");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setLines(readCart());
      setLoaded(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const cartProducts = useMemo(
    () =>
      lines
        .map((line) => ({
          line,
          product: products.find((product) => product.slug === line.slug),
        }))
        .filter(
          (
            item,
          ): item is { line: CartLine; product: Product } => Boolean(item.product),
        ),
    [lines, products],
  );

  const total = cartProducts.reduce(
    (sum, item) => sum + item.product.price * item.line.quantity,
    0,
  );

  function commit(next: CartLine[]) {
    setLines(next);
    writeCart(next);
  }

  function updateQuantity(slug: string, quantity: number) {
    if (quantity < 1) {
      commit(lines.filter((line) => line.slug !== slug));
      return;
    }

    commit(
      lines.map((line) =>
        line.slug === slug ? { ...line, quantity } : line,
      ),
    );
  }

  async function submitOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    const form = event.currentTarget;
    const formData = new FormData(form);
    setSubmitting(true);
    setSubmitError("");
    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          firstName: formData.get("name"),
          phone: formData.get("phone"),
          buyerType: formData.get("buyerType"),
          company: formData.get("company"),
          inn: formData.get("inn"),
          email: formData.get("email"),
          delivery: formData.get("delivery"),
          address: formData.get("address"),
          comment: formData.get("comment"),
          consent: formData.get("consent") === "on",
          lines: cartProducts.map(({ line, product }) => ({
            slug: product.slug,
            quantity: line.quantity,
          })),
        }),
      });
      const result = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(result.error || "Не удалось отправить заявку");
      setSubmitted(true);
      form.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Попробуйте ещё раз");
    } finally {
      setSubmitting(false);
    }
  }

  if (!loaded) {
    return <div className="cart-loading">Загружаем корзину…</div>;
  }

  if (cartProducts.length === 0) {
    return (
      <div className="empty-cart">
        <div className="empty-cart-icon">▱</div>
        <h2>В корзине пока пусто</h2>
        <p>
          Выберите готовые позиции в каталоге или отправьте список артикулов
          менеджеру для оптового расчёта.
        </p>
        <Link className="button button-primary" href="/catalog">
          Перейти в каталог
        </Link>
      </div>
    );
  }

  return (
    <div className="cart-layout">
      <div className="cart-order-row">
        <section className="cart-items">
          <div className="cart-section-heading">
            <h2>Товары</h2>
            <button type="button" onClick={() => commit([])}>
              Очистить корзину
            </button>
          </div>
          {cartProducts.map(({ line, product }) => (
            <article className="cart-item" key={product.slug}>
              <Link
                className="cart-item-image"
                href={`/catalog/${product.slug}`}
              >
                <img src={product.image} alt={product.name} />
              </Link>
              <div className="cart-item-info">
                <span>{product.sku}</span>
                <Link href={`/catalog/${product.slug}`}>
                  <h3>{product.shortName}</h3>
                </Link>
              </div>
              <div className="quantity-control">
                <button
                  type="button"
                  onClick={() =>
                    updateQuantity(product.slug, line.quantity - 1)
                  }
                  aria-label="Уменьшить количество"
                >
                  −
                </button>
                <span>{line.quantity}</span>
                <button
                  type="button"
                  onClick={() =>
                    updateQuantity(product.slug, line.quantity + 1)
                  }
                  aria-label="Увеличить количество"
                >
                  +
                </button>
              </div>
              <strong className="cart-item-price">
                {formatPrice(product.price * line.quantity)} ₽
              </strong>
              <button
                className="remove-item"
                type="button"
                onClick={() => updateQuantity(product.slug, 0)}
                aria-label={`Удалить ${product.shortName}`}
              >
                ×
              </button>
            </article>
          ))}
          <Link className="continue-shopping" href="/catalog">
            ← Продолжить покупки
          </Link>
        </section>

        <aside className="cart-summary">
          <h2>Ваш заказ</h2>
          <div>
            <span>Позиций</span>
            <b>{cartProducts.length}</b>
          </div>
          <div>
            <span>Товаров</span>
            <b>
              {lines.reduce((sum, line) => sum + line.quantity, 0)} шт.
            </b>
          </div>
          <div className="cart-total">
            <span>Предварительно</span>
            <strong>{formatPrice(total)} ₽</strong>
          </div>
          <p>
            Точную цену, наличие и стоимость доставки подтвердит менеджер после
            оформления заявки.
          </p>
          <a className="button button-primary" href="#checkout">
            Оформить заявку
          </a>
          <small>Онлайн-оплата на этом этапе не требуется.</small>
        </aside>
      </div>

      <section className="checkout-section" id="checkout">
        <div className="checkout-copy">
          <span className="eyebrow">Оформление заказа</span>
          <h2>Куда отправить счёт и уточнения</h2>
          <p>
            Менеджер проверит наличие, рассчитает оптовую цену при сумме от
            30 000 ₽ и согласует удобную доставку.
          </p>
          <ul>
            <li>Без онлайн-оплаты и привязки карты</li>
            <li>Счёт и документы для юридических лиц</li>
            <li>Самовывоз или отправка транспортной компанией</li>
          </ul>
        </div>

        {submitted ? (
          <div className="checkout-success">
            <span>✓</span>
            <h2>Заказ отправлен</h2>
            <p>
              Спасибо! Менеджер свяжется с вами, чтобы подтвердить наличие,
              итоговую стоимость и условия получения.
            </p>
            <Link className="button button-secondary" href="/catalog">
              Вернуться в каталог
            </Link>
          </div>
        ) : (
          <form className="checkout-form" onSubmit={submitOrder}>
            <fieldset className="buyer-type-fieldset">
              <legend>Тип покупателя *</legend>
              <div className="buyer-type-options">
                <label className="buyer-type-option">
                  <input
                    type="radio"
                    name="buyerType"
                    value="legal"
                    checked={buyerType === "legal"}
                    onChange={() => setBuyerType("legal")}
                  />
                  <span>Юрлицо</span>
                </label>
                <label className="buyer-type-option">
                  <input
                    type="radio"
                    name="buyerType"
                    value="individual"
                    checked={buyerType === "individual"}
                    onChange={() => setBuyerType("individual")}
                  />
                  <span>Физлицо</span>
                </label>
              </div>
            </fieldset>
            <div className="form-row">
              <label>
                <span>Контактное лицо *</span>
                <input name="name" autoComplete="name" required />
              </label>
              <label>
                <span>Телефон *</span>
                <input
                  name="phone"
                  type="tel"
                  autoComplete="tel"
                  inputMode="tel"
                  maxLength={18}
                  placeholder="+7 (999) 000-00-00"
                  pattern="\+7 \([0-9]{3}\) [0-9]{3}-[0-9]{2}-[0-9]{2}"
                  onChange={(event) => {
                    event.currentTarget.value = formatRussianPhone(event.currentTarget.value);
                  }}
                  required
                />
              </label>
            </div>
            {buyerType === "legal" && (
              <div className="form-row">
                <label>
                  <span>Компания *</span>
                  <input name="company" autoComplete="organization" required />
                </label>
                <label>
                  <span>ИНН *</span>
                  <input
                    name="inn"
                    inputMode="numeric"
                    pattern="[0-9]{10}|[0-9]{12}"
                    placeholder="10 или 12 цифр"
                    required
                  />
                </label>
              </div>
            )}
            <div className="form-row">
              <label>
                <span>E-mail *</span>
                <input name="email" type="email" autoComplete="email" required />
              </label>
              <label>
                <span>Получение заказа *</span>
                <select name="delivery" required defaultValue="">
                  <option value="" disabled>
                    Выберите способ
                  </option>
                  <option value="pickup">Самовывоз</option>
                  <option value="moscow">Курьер по Москве</option>
                  <option value="transport">Транспортная компания по РФ</option>
                  <option value="manager">Обсудить с менеджером</option>
                </select>
              </label>
            </div>
            <label>
              <span>Адрес или город доставки</span>
              <input name="address" autoComplete="street-address" />
            </label>
            <label>
              <span>Комментарий к заказу</span>
              <textarea
                name="comment"
                rows={4}
                placeholder="Например, желаемая ТК, срок или задача, под которую нужен магнит"
              />
            </label>
            <label className="consent-row">
              <input type="checkbox" name="consent" required />
              <span>
                Принимаю условия <Link href="/privacy">политики конфиденциальности</Link> *
              </span>
            </label>
            <label className="consent-row">
              <input type="checkbox" />
              <span>Хочу получать новости о новых товарах и специальных ценах</span>
            </label>
            {submitError && <p className="form-error" role="alert">{submitError}</p>}
            <button className="button button-primary" type="submit" disabled={submitting}>
              {submitting ? "Отправляем…" : "Отправить заявку"}
            </button>
          </form>
        )}
      </section>
    </div>
  );
}
