import type { Metadata } from "next";
import { Breadcrumbs } from "../../components/Breadcrumbs";
import { CartClient } from "../../components/CartClient";
import { getAllProducts } from "../../lib/catalog/service";

export const metadata: Metadata = {
  title: "Корзина",
  description:
    "Корзина интернет-магазина «Сайт Магнитов». Оформите заявку, чтобы менеджер подтвердил цену, наличие и доставку.",
  robots: {
    index: false,
    follow: true,
  },
};

export const dynamic = "force-dynamic";

export default async function CartPage() {
  const products = await getAllProducts();

  return (
    <main className="inner-main">
      <section className="cart-hero">
        <div className="container">
          <Breadcrumbs items={[{ href: "/", label: "Главная" }, { label: "Корзина" }]} />
          <span className="eyebrow">Оформление заказа</span>
          <h1>Корзина</h1>
          <p>
            Соберите позиции — менеджер проверит актуальную цену и наличие перед
            выставлением счёта.
          </p>
        </div>
      </section>
      <section className="section cart-section">
        <div className="container">
          <CartClient products={products} />
        </div>
      </section>
    </main>
  );
}
