import Link from "next/link";

const sections = [
  {
    href: "/admin/products",
    title: "Товары",
    description: "Поиск, цены, публикация, SEO и изображения",
  },
  {
    href: "/admin/categories",
    title: "Категории",
    description: "Структура каталога, меню и фильтров",
  },
  {
    href: "/admin/collections",
    title: "Подборки",
    description: "Маркетинговые группы и ручной порядок товаров",
  },
  {
    href: "/admin/orders",
    title: "Заказы",
    description: "Заказы из корзины и их рабочие статусы",
  },
  {
    href: "/admin/leads",
    title: "Заявки с форм",
    description: "Подбор магнита, опт и обратная связь",
  },
  {
    href: "/admin/imports",
    title: "Импорт Tilda",
    description: "Dry-run, импорт и журнал запусков",
  },
];

export default function AdminPage() {
  return (
    <section className="admin-page">
      <div className="admin-page-head">
        <div>
          <span className="eyebrow">Рабочее место</span>
          <h1>Панель управления</h1>
          <p>Каталог, заказы и заявки сайта в одном интерфейсе.</p>
        </div>
      </div>
      <div className="admin-cards">
        {sections.map((section) => (
          <Link href={section.href} key={section.href}>
            <strong>{section.title}</strong>
            <span>{section.description} →</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
