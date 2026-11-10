"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type AuditEntry = {
  id: string;
  actor: string;
  admin_user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string;
  changes: unknown;
  created_at: string;
};

const actionNames: Record<string, string> = {
  create: "Создание",
  update: "Изменение",
  delete: "Удаление",
  merge: "Объединение",
  import: "Импорт",
  publish: "Публикация",
  unpublish: "Снятие с публикации",
  hide: "Скрытие",
  assign_products: "Состав подборки",
  assign_categories: "Категории товара",
  reorder: "Изменение порядка",
  upload_image: "Загрузка изображения",
  delete_image: "Удаление изображения",
};

const entityNames: Record<string, string> = {
  product: "Товар",
  category: "Категория",
  collection: "Подборка",
  image: "Изображение",
  characteristic: "Характеристика",
  characteristic_definition: "Справочник характеристик",
  order: "Заказ",
  lead: "Заявка с формы",
};

const changeFieldNames: Record<string, string> = {
  name: "Название",
  title: "Название",
  slug: "Slug",
  status: "Статус",
  price: "Цена",
  oldPrice: "Старая цена",
  sku: "Артикул",
  sortOrder: "Порядок",
  isFeatured: "Показ на главной",
  productIds: "Товары",
  primaryCategoryId: "Основная категория",
  additionalCategoryIds: "Дополнительные категории",
};

function date(value: string) {
  return new Date(value).toLocaleString("ru-RU");
}

function compactValue(value: unknown) {
  if (typeof value === "boolean") return value ? "Да" : "Нет";
  if (value == null || value === "") return "—";
  if (Array.isArray(value)) return `${value.length} шт.`;
  if (typeof value === "object") return "Обновлено";
  const text = String(value);
  return text.length > 55 ? `${text.slice(0, 52)}…` : text;
}

function changesSummary(action: string, changes: unknown) {
  if (action === "import") return "Карточка добавлена или обновлена импортом";
  if (!changes || typeof changes !== "object" || Array.isArray(changes)) {
    return "Без дополнительных деталей";
  }
  const entries = Object.entries(changes as Record<string, unknown>);
  if (!entries.length) return "Без дополнительных деталей";
  return entries
    .slice(0, 3)
    .map(([key, value]) => `${changeFieldNames[key] || key}: ${compactValue(value)}`)
    .join(" · ");
}

export default function AdminAuditPage() {
  const router = useRouter();
  const [items, setItems] = useState<AuditEntry[]>([]);
  const [search, setSearch] = useState("");
  const [action, setAction] = useState("");
  const [entityType, setEntityType] = useState("");
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams({ page: String(page) });
      if (search.trim()) params.set("search", search.trim());
      if (action) params.set("action", action);
      if (entityType) params.set("entityType", entityType);
      fetch(`/api/admin/audit?${params}`)
        .then(async (response) => {
          if (response.status === 401) {
            router.replace("/admin/login");
            return;
          }
          const payload = await response.json();
          if (!response.ok) throw new Error(payload.error || "Не удалось загрузить историю действий");
          setItems(payload.items || []);
          setTotal(payload.total || 0);
          setPage(payload.page || 1);
          setPageCount(payload.pageCount || 1);
          setError("");
        })
        .catch((reason) =>
          setError(reason instanceof Error ? reason.message : "Не удалось загрузить историю действий"),
        );
    }, 250);
    return () => window.clearTimeout(timer);
  }, [action, entityType, page, router, search]);

  return (
    <section className="admin-page">
      <div className="admin-page-head">
        <div>
          <span className="eyebrow">Система</span>
          <h1>История действий</h1>
          <p>Кто, когда и с каким объектом работал. Технический JSON скрыт из рабочего интерфейса.</p>
        </div>
      </div>

      <div className="admin-toolbar admin-toolbar--audit">
        <input
          type="search"
          value={search}
          onChange={(event) => { setSearch(event.target.value); setPage(1); }}
          placeholder="Пользователь, объект или идентификатор"
          aria-label="Поиск по истории действий"
        />
        <select
          aria-label="Фильтр по действию"
          value={action}
          onChange={(event) => { setAction(event.target.value); setPage(1); }}
        >
          <option value="">Все действия</option>
          {Object.entries(actionNames).map(([value, label]) => (
            <option value={value} key={value}>{label}</option>
          ))}
        </select>
        <select
          aria-label="Фильтр по типу объекта"
          value={entityType}
          onChange={(event) => { setEntityType(event.target.value); setPage(1); }}
        >
          <option value="">Все объекты</option>
          {Object.entries(entityNames).map(([value, label]) => (
            <option value={value} key={value}>{label}</option>
          ))}
        </select>
      </div>

      <div className="admin-list-meta" aria-live="polite">
        <span>Записей: <strong>{total}</strong></span>
        {pageCount > 1 && <span>Страница {page} из {pageCount}</span>}
      </div>

      {error && <p className="form-error" role="alert">{error}</p>}

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Время</th>
              <th>Пользователь</th>
              <th>Действие</th>
              <th>Объект</th>
              <th>Что изменилось</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td>{date(item.created_at)}</td>
                <td>{item.actor}</td>
                <td>
                  <span className="admin-status status-apply">
                    {actionNames[item.action] || item.action}
                  </span>
                </td>
                <td>
                  <strong>{entityNames[item.entity_type] || item.entity_type}</strong>
                  <small>#{item.entity_id.slice(0, 8)}</small>
                </td>
                <td className="admin-audit-summary">{changesSummary(item.action, item.changes)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {items.length === 0 && !error && <p className="admin-empty">Записей по выбранным условиям нет.</p>}
      </div>

      {pageCount > 1 && (
        <nav className="pagination" aria-label="Пагинация истории действий">
          <button
            type="button"
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            disabled={page <= 1}
            aria-label="Предыдущая страница"
          >
            ←
          </button>
          <span aria-current="page">{page} из {pageCount}</span>
          <button
            type="button"
            onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
            disabled={page >= pageCount}
            aria-label="Следующая страница"
          >
            →
          </button>
        </nav>
      )}
    </section>
  );
}
