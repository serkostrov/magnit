"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminDialog } from "../../../components/AdminDialog";

type Lead = {
  id: string;
  kind: string;
  payload?: Record<string, unknown>;
  phone?: string;
  email?: string;
  consent_version?: string;
  consent_at?: string;
  consent_ip?: string;
  consent_user_agent?: string;
  created_at?: string;
};

const kindNames: Record<string, string> = {
  quiz: "Подбор магнита",
  wholesale: "Оптовая заявка",
  contact: "Обратная связь",
  other: "Другая форма",
};

const fieldNames: Record<string, string> = {
  name: "Имя",
  firstName: "Имя",
  phone: "Телефон",
  email: "Email",
  contact: "Контакт",
  company: "Компания",
  inn: "ИНН",
  city: "Город",
  comment: "Комментарий",
  message: "Сообщение",
  task: "Задача",
  product: "Товар",
  quantity: "Количество",
  delivery: "Доставка",
  magnetType: "Тип магнита",
  shape: "Форма",
  size: "Размер",
  budget: "Бюджет",
  source: "Источник",
  request: "Запрос",
  solution: "Решение",
  newsletter: "Подписка на новости",
  parameters: "Параметры",
};

function display(value: unknown): string {
  if (typeof value === "boolean") return value ? "Да" : "Нет";
  if (value == null || value === "") return "—";
  if (Array.isArray(value)) return value.map(display).join(", ");
  if (typeof value === "object") {
    return Object.values(value as Record<string, unknown>).map(display).join(", ");
  }
  return String(value);
}

function fieldLabel(key: string) {
  if (fieldNames[key]) return fieldNames[key];
  const normalized = key.replace(/[_-]+/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2");
  return normalized.charAt(0).toLocaleUpperCase("ru-RU") + normalized.slice(1);
}

function leadPreview(lead: Lead) {
  const payload = lead.payload || {};
  const preferred =
    payload.message ||
    payload.comment ||
    payload.task ||
    payload.request ||
    payload.solution ||
    payload.company;
  if (preferred) return display(preferred);
  const first = Object.entries(payload).find(([key, value]) =>
    ![
      "phone",
      "email",
      "contact",
      "name",
      "consent",
      "source",
      "newsletter",
      "parameters",
    ].includes(key) && value != null && value !== "",
  );
  return first ? `${fieldLabel(first[0])}: ${display(first[1])}` : "Без дополнительного комментария";
}

export default function AdminLeadsPage() {
  const router = useRouter();
  const [items, setItems] = useState<Lead[]>([]);
  const [kind, setKind] = useState("");
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const query = kind ? `?kind=${encodeURIComponent(kind)}` : "";
      fetch(`/api/admin/leads${query}`)
        .then(async (response) => {
          if (response.status === 401) {
            router.replace("/admin/login");
            return;
          }
          const payload = await response.json();
          if (!response.ok) throw new Error(payload.error || "Не удалось загрузить заявки");
          setItems(payload.items || []);
          setError("");
        })
        .catch((reason: unknown) =>
          setError(reason instanceof Error ? reason.message : "Не удалось загрузить заявки"),
        );
    }, 0);
    return () => window.clearTimeout(timer);
  }, [kind, router]);

  return (
    <section className="admin-page">
      <div className="admin-page-head">
        <div>
          <span className="eyebrow">Клиенты</span>
          <h1>Заявки с форм</h1>
          <p>Это не заказы из корзины: здесь собраны подбор, оптовая и контактная формы сайта.</p>
        </div>
      </div>

      <div className="admin-toolbar admin-toolbar--compact">
        <select
          aria-label="Фильтр по типу заявки"
          value={kind}
          onChange={(event) => setKind(event.target.value)}
        >
          <option value="">Все типы заявок</option>
          {Object.entries(kindNames).map(([value, label]) => (
            <option value={value} key={value}>{label}</option>
          ))}
        </select>
      </div>

      {error && <p className="form-error" role="alert">{error}</p>}

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Дата</th>
              <th>Тип</th>
              <th>Контакты</th>
              <th>Кратко</th>
              <th>Согласие</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {items.map((lead) => (
              <tr key={lead.id}>
                <td>
                  <strong>#{lead.id.slice(0, 8)}</strong>
                  <small>{lead.created_at ? new Date(lead.created_at).toLocaleString("ru-RU") : "—"}</small>
                </td>
                <td>{kindNames[lead.kind] || lead.kind}</td>
                <td>
                  {display(lead.phone || lead.payload?.contact)}
                  <small>{display(lead.email || lead.payload?.name)}</small>
                </td>
                <td className="admin-cell-summary">{leadPreview(lead)}</td>
                <td>
                  <span className={`admin-status ${lead.consent_at ? "status-completed" : "status-hidden"}`}>
                    {lead.consent_at ? "Получено" : "Нет данных"}
                  </span>
                </td>
                <td>
                  <button className="button button-secondary" type="button" onClick={() => setSelectedLead(lead)}>
                    Открыть
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!items.length && !error && <p className="admin-empty">Заявок с форм пока нет.</p>}
      </div>

      <AdminDialog
        open={Boolean(selectedLead)}
        title={selectedLead ? `${kindNames[selectedLead.kind] || selectedLead.kind} #${selectedLead.id.slice(0, 8)}` : "Заявка"}
        description={selectedLead?.created_at ? new Date(selectedLead.created_at).toLocaleString("ru-RU") : undefined}
        onClose={() => setSelectedLead(null)}
      >
        {selectedLead && (
          <div className="admin-lead-detail">
            <section>
              <h3>Контакты</h3>
              <dl className="admin-detail-grid">
                <div><dt>Телефон</dt><dd>{display(selectedLead.phone || selectedLead.payload?.contact)}</dd></div>
                <div><dt>Email</dt><dd>{display(selectedLead.email)}</dd></div>
                <div><dt>Имя</dt><dd>{display(selectedLead.payload?.name)}</dd></div>
              </dl>
            </section>

            <section>
              <h3>Данные заявки</h3>
              <dl className="admin-detail-grid">
                {Object.entries(selectedLead.payload || {}).map(([key, value]) => (
                  <div key={key}>
                    <dt>{fieldLabel(key)}</dt>
                    <dd>{display(value)}</dd>
                  </div>
                ))}
              </dl>
              {!Object.keys(selectedLead.payload || {}).length && (
                <p className="admin-empty">Дополнительные поля не переданы.</p>
              )}
            </section>

            <section>
              <h3>Согласие на обработку данных</h3>
              <dl className="admin-detail-grid">
                <div><dt>Версия</dt><dd>{selectedLead.consent_version || "—"}</dd></div>
                <div>
                  <dt>Принято</dt>
                  <dd>{selectedLead.consent_at ? new Date(selectedLead.consent_at).toLocaleString("ru-RU") : "—"}</dd>
                </div>
              </dl>
            </section>
          </div>
        )}
      </AdminDialog>
    </section>
  );
}
