import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "../../components/Breadcrumbs";

export const metadata: Metadata = { title: "Доставка", description: "Доставка магнитов по Москве и России.", alternates: { canonical: "/delivery" } };

export default function DeliveryPage() {
  return <main className="inner-main"><section className="section info-page"><div className="container"><Breadcrumbs items={[{ href: "/", label: "Главная" }, { label: "Доставка" }]} /><span className="eyebrow">Доставка</span><h1>Привезём магнитную продукцию по России</h1><p className="info-lead">После заявки менеджер уточнит остаток, срок и подходящий способ отправки. Складское наличие не подменяем предположением — подтверждаем его перед счётом.</p><div className="info-grid"><article><h2>Способы</h2><ul><li>Курьерская доставка по Москве.</li><li>СДЭК, ПЭК и другие транспортные компании.</li><li>Самовывоз по предварительной договорённости.</li></ul></article><article><h2>Стоимость</h2><p>Рассчитывается по адресу, весу и габаритам партии. Условия доставки фиксируем в подтверждении заказа.</p><Link className="button button-primary" href="/cart">Перейти к заявке</Link></article></div></div></section></main>;
}
