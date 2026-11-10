"use client";

import { Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { AdminDialog } from "../../../components/AdminDialog";

type CharacteristicDefinition = {
  key: string;
  label: string;
  enabled: boolean;
  sortOrder: number;
  options: string[];
  productCount: number;
};

type CharacteristicForm = {
  label: string;
  enabled: boolean;
  sortOrder: number;
  options: string;
};

const emptyForm: CharacteristicForm = {
  label: "",
  enabled: false,
  sortOrder: 100,
  options: "",
};

function csrfToken() {
  return (
    document.cookie
      .split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith("site_magnit_csrf="))
      ?.split("=")
      .slice(1)
      .join("=") || ""
  );
}

export default function AdminCharacteristicsPage() {
  const router = useRouter();
  const [items, setItems] = useState<CharacteristicDefinition[]>([]);
  const [form, setForm] = useState<CharacteristicForm>(emptyForm);
  const [editingKey, setEditingKey] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    const response = await fetch("/api/admin/characteristics");
    if (response.status === 401) {
      router.replace("/admin/login");
      return;
    }
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || "Не удалось загрузить характеристики");
    }
    setItems(payload.items || []);
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load().catch((reason) =>
        setError(
          reason instanceof Error ? reason.message : "Не удалось загрузить характеристики",
        ),
      );
    }, 0);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  function openCreate() {
    setEditingKey("");
    setForm({ ...emptyForm, sortOrder: items.length ? Math.max(...items.map((item) => item.sortOrder)) + 10 : 10 });
    setError("");
    setDialogOpen(true);
  }

  function openEdit(item: CharacteristicDefinition) {
    setEditingKey(item.key);
    setForm({
      label: item.label,
      enabled: item.enabled,
      sortOrder: item.sortOrder,
      options: item.options.join("\n"),
    });
    setError("");
    setDialogOpen(true);
  }

  function closeDialog() {
    if (saving) return;
    setDialogOpen(false);
    setEditingKey("");
    setError("");
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const response = await fetch(
        editingKey
          ? `/api/admin/characteristics/${encodeURIComponent(editingKey)}`
          : "/api/admin/characteristics",
        {
          method: editingKey ? "PATCH" : "POST",
          headers: {
            "content-type": "application/json",
            "x-csrf-token": csrfToken(),
          },
          body: JSON.stringify({
            label: form.label,
            enabled: form.enabled,
            sortOrder: form.sortOrder,
            options: form.options
              .split("\n")
              .map((value) => value.trim())
              .filter(Boolean),
          }),
        },
      );
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Не удалось сохранить характеристику");
      }
      await load();
      setDialogOpen(false);
      setEditingKey("");
      setForm(emptyForm);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Не удалось сохранить характеристику",
      );
    } finally {
      setSaving(false);
    }
  }

  async function remove(item: CharacteristicDefinition) {
    if (!window.confirm(`Удалить характеристику «${item.label}»?`)) return;
    setError("");
    const response = await fetch(
      `/api/admin/characteristics/${encodeURIComponent(item.key)}`,
      {
        method: "DELETE",
        headers: { "x-csrf-token": csrfToken() },
      },
    );
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error || "Не удалось удалить характеристику");
      return;
    }
    await load();
  }

  return (
    <section className="admin-page">
      <div className="admin-page-head">
        <h1>Характеристики</h1>
        <button className="button button-primary" type="button" onClick={openCreate}>
          Новая характеристика
        </button>
      </div>

      {error && !dialogOpen && <p className="form-error" role="alert">{error}</p>}

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Характеристика</th>
              <th>В фильтрах</th>
              <th>Значения</th>
              <th>Товаров</th>
              <th>Порядок</th>
              <th><span className="sr-only">Действия</span></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.key}>
                <td><strong>{item.label}</strong></td>
                <td>{item.enabled ? "Да" : "Нет"}</td>
                <td>{item.options.length || "Свободное значение"}</td>
                <td>
                  {item.productCount > 0 ? (
                    <Link
                      href={`/admin/products?characteristic=${encodeURIComponent(item.key)}&characteristicLabel=${encodeURIComponent(item.label)}`}
                      aria-label={`Открыть товары с характеристикой «${item.label}»: ${item.productCount}`}
                      title="Открыть товары"
                    >
                      {item.productCount}
                    </Link>
                  ) : (
                    0
                  )}
                </td>
                <td>{item.sortOrder}</td>
                <td>
                  <div className="admin-row-icons">
                    <button
                      className="admin-icon-button"
                      type="button"
                      onClick={() => openEdit(item)}
                      aria-label={`Изменить ${item.label}`}
                      title="Изменить"
                    >
                      <Pencil size={17} />
                    </button>
                    <button
                      className="admin-icon-button is-danger"
                      type="button"
                      onClick={() => void remove(item)}
                      aria-label={`Удалить ${item.label}`}
                      title="Удалить"
                    >
                      <Trash2 size={17} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <AdminDialog
        open={dialogOpen}
        title={editingKey ? "Изменить характеристику" : "Новая характеристика"}
        onClose={closeDialog}
      >
        <form className="admin-dialog-form" onSubmit={(event) => void save(event)}>
          <div className="admin-form-grid">
            <label className="span-2">
              Название
              <input
                value={form.label}
                onChange={(event) => setForm({ ...form, label: event.target.value })}
                required
              />
            </label>
            <label>
              Порядок
              <input
                type="number"
                min="0"
                value={form.sortOrder}
                onChange={(event) => setForm({ ...form, sortOrder: Number(event.target.value) })}
              />
            </label>
            <label className="admin-checkbox">
              <input
                type="checkbox"
                checked={form.enabled}
                onChange={(event) => setForm({ ...form, enabled: event.target.checked })}
              />
              Показывать в фильтрах
            </label>
            <label className="span-2">
              Значения, по одному в строке
              <textarea
                rows={8}
                value={form.options}
                onChange={(event) => setForm({ ...form, options: event.target.value })}
              />
            </label>
          </div>
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="admin-dialog-actions">
            <button className="button button-secondary" type="button" onClick={closeDialog} disabled={saving}>
              Отмена
            </button>
            <button className="button button-primary" type="submit" disabled={saving}>
              {saving ? "Сохраняем…" : "Сохранить"}
            </button>
          </div>
        </form>
      </AdminDialog>
    </section>
  );
}
