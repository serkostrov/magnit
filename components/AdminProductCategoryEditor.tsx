"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export type AdminProductCategory = {
  id: string;
  slug: string;
  title: string;
  isPrimary: boolean;
  sortOrder: number;
};

type CategoryOption = { id: string; slug: string; title: string };

export function AdminProductCategoryEditor({
  initialCategories,
}: {
  initialCategories: AdminProductCategory[];
}) {
  const router = useRouter();
  const [options, setOptions] = useState<CategoryOption[]>([]);
  const [primaryCategoryId, setPrimaryCategoryId] = useState(
    initialCategories.find((category) => category.isPrimary)?.id || initialCategories[0]?.id || "",
  );
  const [additionalCategoryIds, setAdditionalCategoryIds] = useState(
    initialCategories.filter((category) => !category.isPrimary).map((category) => category.id),
  );
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/admin/categories")
      .then(async (response) => {
        if (response.status === 401) {
          router.replace("/admin/login");
          return;
        }
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "Не удалось загрузить категории");
        setOptions(
          (payload.items || []).map((item: Record<string, unknown>) => ({
            id: String(item.id),
            slug: String(item.slug),
            title: String(item.title),
          })),
        );
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Не удалось загрузить категории"));
  }, [router]);

  function toggleAdditional(id: string) {
    setAdditionalCategoryIds((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    );
  }

  return (
    <section className="admin-editor-section admin-category-editor">
      <input type="hidden" name="primaryCategoryId" value={primaryCategoryId} />
      <input
        type="hidden"
        name="additionalCategoryIds"
        value={JSON.stringify(additionalCategoryIds.filter((id) => id !== primaryCategoryId))}
      />
      <div className="admin-section-head">
        <h2>Категории товара</h2>
      </div>

      <label className="admin-editor-label">
        Основная категория
        <select
          value={primaryCategoryId}
          onChange={(event) => {
            setPrimaryCategoryId(event.target.value);
            setAdditionalCategoryIds((current) => current.filter((id) => id !== event.target.value));
          }}
          disabled={!options.length}
        >
          <option value="">Выберите категорию</option>
          {options.map((category) => (
            <option key={category.id} value={category.id}>{category.title} · {category.slug}</option>
          ))}
        </select>
      </label>

      <fieldset className="admin-category-options">
        <legend>Дополнительные категории</legend>
        <div className="admin-category-option-grid">
          {options
            .filter((category) => category.id !== primaryCategoryId)
            .map((category) => (
              <label key={category.id}>
                <input
                  type="checkbox"
                  checked={additionalCategoryIds.includes(category.id)}
                  onChange={() => toggleAdditional(category.id)}
                />
                <span>{category.title}<small>{category.slug}</small></span>
              </label>
            ))}
        </div>
        {!options.length && <p className="admin-empty admin-empty--compact">Категории появятся после подключения PostgreSQL.</p>}
      </fieldset>
      {error && <p className="form-error" role="alert">{error}</p>}
    </section>
  );
}
