"use client";

import { ArrowDown, ArrowUp, ImageIcon, Pencil, Trash2, Upload } from "lucide-react";
import { Fragment, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminDialog } from "../../../components/AdminDialog";

type HomeColor = "blue" | "mint" | "sand" | "lilac" | "rose" | "cyan";

type Category = {
  id: string;
  slug: string;
  title: string;
  description: string;
  imageUrl: string;
  parentId: string | null;
  sortOrder: number;
  isFeatured: boolean;
  homeColor: HomeColor;
  productCount: number;
  publishedProductCount: number;
};

type CategoryForm = Omit<Category, "id" | "productCount" | "publishedProductCount">;

const emptyForm: CategoryForm = {
  slug: "",
  title: "",
  description: "",
  imageUrl: "",
  parentId: null,
  sortOrder: 0,
  isFeatured: false,
  homeColor: "blue",
};

const colorOptions: Array<{ value: HomeColor; label: string }> = [
  { value: "blue", label: "Голубой" },
  { value: "mint", label: "Мятный" },
  { value: "sand", label: "Песочный" },
  { value: "lilac", label: "Сиреневый" },
  { value: "rose", label: "Розовый" },
  { value: "cyan", label: "Бирюзовый" },
];

function csrfToken() {
  return document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("site_magnit_csrf="))
    ?.split("=")
    .slice(1)
    .join("=") || "";
}

export default function AdminCategoriesPage() {
  const router = useRouter();
  const [items, setItems] = useState<Category[]>([]);
  const [form, setForm] = useState<CategoryForm>(emptyForm);
  const [editingId, setEditingId] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [rowError, setRowError] = useState<{ id: string; message: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [reordering, setReordering] = useState(false);

  async function load() {
    const response = await fetch("/api/admin/categories");
    if (response.status === 401) {
      router.replace("/admin/login");
      return;
    }
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Не удалось загрузить категории");
    const nextItems = payload.items || [];
    setItems(nextItems);
    return nextItems as Category[];
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load().catch((reason) =>
        setError(reason instanceof Error ? reason.message : "Не удалось загрузить категории"),
      );
    }, 0);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  function openCreate() {
    setEditingId("");
    setForm({ ...emptyForm, sortOrder: items.length });
    setImageFile(null);
    setError("");
    setNotice("");
    setRowError(null);
    setDialogOpen(true);
  }

  function openEdit(item: Category) {
    setEditingId(item.id);
    setForm({
      slug: item.slug,
      title: item.title,
      description: item.description,
      imageUrl: item.imageUrl,
      parentId: item.parentId,
      sortOrder: item.sortOrder,
      isFeatured: item.isFeatured,
      homeColor: item.homeColor || "blue",
    });
    setImageFile(null);
    setError("");
    setNotice("");
    setRowError(null);
    setDialogOpen(true);
  }

  function closeDialog() {
    if (saving) return;
    setDialogOpen(false);
    setImageFile(null);
    setError("");
  }

  async function uploadImage(categoryId: string, file: File) {
    const body = new FormData();
    body.set("file", file);
    const response = await fetch(`/api/admin/categories/${categoryId}/image`, {
      method: "POST",
      headers: { "x-csrf-token": csrfToken() },
      body,
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Не удалось загрузить изображение");
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const response = await fetch(
        editingId ? `/api/admin/categories/${editingId}` : "/api/admin/categories",
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "content-type": "application/json", "x-csrf-token": csrfToken() },
          body: JSON.stringify(form),
        },
      );
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Не удалось сохранить категорию");
      const categoryId = editingId || String(payload.item?.id || "");
      if (imageFile && categoryId) await uploadImage(categoryId, imageFile);
      const nextItems = await load();
      const savedItem = nextItems?.find((item) => item.id === categoryId);
      if (form.isFeatured && savedItem && savedItem.publishedProductCount === 0) {
        setNotice(
          `Категория «${savedItem.title}» сохранена. На главной она появится после добавления опубликованного товара.`,
        );
      }
      setDialogOpen(false);
      setEditingId("");
      setImageFile(null);
      setForm(emptyForm);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось сохранить категорию");
    } finally {
      setSaving(false);
    }
  }

  async function remove(item: Category) {
    if (!window.confirm(`Удалить категорию «${item.title}»?`)) return;
    setError("");
    setNotice("");
    setRowError(null);
    const response = await fetch(`/api/admin/categories/${item.id}`, {
      method: "DELETE",
      headers: { "x-csrf-token": csrfToken() },
    });
    const payload = await response.json();
    if (!response.ok) {
      setRowError({ id: item.id, message: payload.error || "Не удалось удалить категорию" });
      return;
    }
    await load();
  }

  async function move(index: number, direction: -1 | 1) {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= items.length || reordering) return;
    const previous = items;
    const next = [...items];
    [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
    setItems(next.map((item, sortOrder) => ({ ...item, sortOrder })));
    setReordering(true);
    setError("");
    try {
      const response = await fetch("/api/admin/categories/reorder", {
        method: "PATCH",
        headers: { "content-type": "application/json", "x-csrf-token": csrfToken() },
        body: JSON.stringify({ ids: next.map((item) => item.id) }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Не удалось изменить порядок");
    } catch (reason) {
      setItems(previous);
      setError(reason instanceof Error ? reason.message : "Не удалось изменить порядок");
    } finally {
      setReordering(false);
    }
  }

  return (
    <section className="admin-page">
      <div className="admin-page-head">
        <h1>Категории</h1>
        <button className="button button-primary" type="button" onClick={openCreate}>Новая категория</button>
      </div>

      {error && !dialogOpen && <p className="form-error" role="alert">{error}</p>}
      {notice && <p className="form-success" role="status">{notice}</p>}

      <div className="admin-table-wrap">
        <table className="admin-table admin-category-table">
          <thead><tr><th>Категория</th><th>На главной</th><th>Товаров</th><th>Порядок</th><th><span className="sr-only">Действия</span></th></tr></thead>
          <tbody>
            {items.map((item, index) => (
              <Fragment key={item.id}>
              <tr>
                <td>
                  <div className="admin-category-cell">
                    {item.imageUrl ? <img src={item.imageUrl} alt="" /> : <span className="admin-category-placeholder"><ImageIcon size={18} /></span>}
                    <div><strong>{item.title}</strong><small>{item.slug}</small></div>
                  </div>
                </td>
                <td>
                  {item.isFeatured
                    ? item.publishedProductCount > 0
                      ? "Да"
                      : "После публикации товара"
                    : "Нет"}
                </td>
                <td>
                  {item.publishedProductCount} на сайте
                  {item.productCount !== item.publishedProductCount && (
                    <small className="admin-table-subvalue">{item.productCount} всего</small>
                  )}
                </td>
                <td>
                  <div className="admin-order-actions">
                    <button className="admin-icon-button" type="button" onClick={() => void move(index, -1)} disabled={index === 0 || reordering} aria-label={`Поднять ${item.title}`} title="Поднять"><ArrowUp size={17} /></button>
                    <span>{index + 1}</span>
                    <button className="admin-icon-button" type="button" onClick={() => void move(index, 1)} disabled={index === items.length - 1 || reordering} aria-label={`Опустить ${item.title}`} title="Опустить"><ArrowDown size={17} /></button>
                  </div>
                </td>
                <td>
                  <div className="admin-row-icons">
                    <button className="admin-icon-button" type="button" onClick={() => openEdit(item)} aria-label={`Изменить ${item.title}`} title="Изменить"><Pencil size={17} /></button>
                    <button className="admin-icon-button is-danger" type="button" onClick={() => void remove(item)} aria-label={`Удалить ${item.title}`} title="Удалить"><Trash2 size={17} /></button>
                  </div>
                </td>
              </tr>
              {rowError?.id === item.id && (
                <tr className="admin-table-error-row">
                  <td colSpan={5}><p className="form-error" role="alert">{rowError.message}</p></td>
                </tr>
              )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      <AdminDialog open={dialogOpen} title={editingId ? "Изменить категорию" : "Новая категория"} onClose={closeDialog}>
        <form className="admin-dialog-form" onSubmit={(event) => void save(event)}>
          <div className="admin-form-grid">
            <label>Название<input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required /></label>
            <label>Slug<input value={form.slug} onChange={(event) => setForm({ ...form, slug: event.target.value })} required pattern="[a-z0-9-]+" /></label>
            <label>Родительская категория<select value={form.parentId || ""} onChange={(event) => setForm({ ...form, parentId: event.target.value || null })}><option value="">Без родителя</option>{items.filter((item) => item.id !== editingId).map((item) => <option value={item.id} key={item.id}>{item.title}</option>)}</select></label>
            <label>Цвет на главной<select value={form.homeColor} onChange={(event) => setForm({ ...form, homeColor: event.target.value as HomeColor })}>{colorOptions.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}</select></label>
            <label className="span-2">Описание<textarea rows={4} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label>
            <label className="admin-category-upload span-2">
              <span>Изображение</span>
              {form.imageUrl && !imageFile && <img src={form.imageUrl} alt="" />}
              <span className="button button-secondary"><Upload size={17} />{imageFile ? imageFile.name : "Выбрать файл"}</span>
              <input type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif" onChange={(event) => setImageFile(event.target.files?.[0] || null)} />
            </label>
            <label className="admin-checkbox span-2"><input type="checkbox" checked={form.isFeatured} onChange={(event) => setForm({ ...form, isFeatured: event.target.checked })} />Показывать на главной</label>
          </div>
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="admin-dialog-actions">
            <button className="button button-secondary" type="button" onClick={closeDialog} disabled={saving}>Отмена</button>
            <button className="button button-primary" type="submit" disabled={saving}>{saving ? "Сохраняем…" : "Сохранить"}</button>
          </div>
        </form>
      </AdminDialog>
    </section>
  );
}
