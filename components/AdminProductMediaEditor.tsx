"use client";

import { ArrowDown, ArrowUp, ImagePlus, Trash2 } from "lucide-react";
import { type ChangeEvent, useState } from "react";

export type AdminImage = {
  id: string;
  url: string;
  alt?: string;
  sort_order?: number;
  sortOrder?: number;
  is_primary?: boolean;
  isPrimary?: boolean;
};

export type AdminCharacteristic = {
  label: string;
  value: string;
  confidence?: number | null;
  needsReview?: boolean;
};

export type AdminCharacteristicDefinition = {
  key: string;
  label: string;
  enabled: boolean;
  sortOrder: number;
  options: string[];
};

function csrfToken() {
  return document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("site_magnit_csrf="))
    ?.split("=")
    .slice(1)
    .join("=") || "";
}

export function AdminProductMediaEditor({
  productId,
  initialImages,
  initialCharacteristics,
  initialCharacteristicDefinitions,
}: {
  productId: string;
  initialImages: AdminImage[];
  initialCharacteristics: AdminCharacteristic[];
  initialCharacteristicDefinitions: AdminCharacteristicDefinition[];
}) {
  const [images, setImages] = useState<AdminImage[]>(initialImages);
  const [characteristics, setCharacteristics] = useState<AdminCharacteristic[]>(initialCharacteristics);
  const [error, setError] = useState("");
  const [savingImages, setSavingImages] = useState(false);

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const files = Array.from(input.files || []);
    if (!files.length) return;
    setSavingImages(true);
    setError("");
    try {
      for (const file of files) {
        const form = new FormData();
        form.append("file", file);
        const response = await fetch(`/api/admin/products/${productId}/images`, {
          method: "POST",
          headers: { "x-csrf-token": csrfToken() },
          body: form,
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Не удалось загрузить изображение");
        setImages((current) => [...current, result]);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось загрузить изображение");
    } finally {
      input.value = "";
      setSavingImages(false);
    }
  }

  async function saveImageOrder(nextImages: AdminImage[], primaryImageId: string) {
    setSavingImages(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/products/${productId}/images`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          "x-csrf-token": csrfToken(),
        },
        body: JSON.stringify({
          imageIds: nextImages.map((image) => image.id),
          primaryImageId,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Не удалось сохранить галерею");
      setImages(
        nextImages.map((image, index) => ({
          ...image,
          sort_order: index,
          is_primary: image.id === primaryImageId,
        })),
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось сохранить галерею");
    } finally {
      setSavingImages(false);
    }
  }

  function moveImage(index: number, direction: -1 | 1) {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= images.length) return;
    const next = [...images];
    [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
    void saveImageOrder(
      next,
      images.find((image) => image.is_primary || image.isPrimary)?.id || next[0]?.id || "",
    );
  }

  async function deleteImage(imageId: string) {
    if (!window.confirm("Удалить это изображение из галереи?")) return;
    setSavingImages(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/products/${productId}/images/${imageId}`, {
        method: "DELETE",
        headers: { "x-csrf-token": csrfToken() },
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Не удалось удалить изображение");
      setImages(
        images
          .filter((image) => image.id !== imageId)
          .map((image) => ({ ...image, is_primary: image.id === result.primaryImageId })),
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось удалить изображение");
    } finally {
      setSavingImages(false);
    }
  }

  function updateCharacteristic(index: number, patch: Partial<AdminCharacteristic>) {
    setCharacteristics((current) =>
      current.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item),
    );
  }

  function updateCharacteristicLabel(index: number, label: string) {
    const definition = initialCharacteristicDefinitions.find(
      (item) => item.label.toLowerCase() === label.toLowerCase(),
    );
    updateCharacteristic(index, {
      label,
      value: definition?.options[0] || "",
      confidence: 1,
      needsReview: false,
    });
  }

  return (
    <div className="admin-media-editor">
      <input
        type="hidden"
        name="characteristicsJson"
        value={JSON.stringify(
          characteristics
            .map((item) => ({
              label: item.label.trim(),
              value: item.value.trim(),
              confidence: 1,
              needsReview: false,
            }))
            .filter((item) => item.label && item.value),
        )}
      />
      <section className="admin-editor-section">
        <div className="admin-section-head">
          <h2>Изображения</h2>
          <label className="button button-secondary admin-upload-button">
            <ImagePlus size={17} aria-hidden="true" />
            {savingImages ? "Загрузка…" : "Загрузить"}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
              multiple
              hidden
              onChange={upload}
              disabled={savingImages}
            />
          </label>
        </div>

        {images.length ? (
          <ul className="admin-media-grid">
            {images.map((image, index) => {
              const isPrimary = Boolean(image.is_primary || image.isPrimary);
              return (
                <li className={isPrimary ? "is-primary" : ""} key={image.id}>
                  <img src={image.url} alt={image.alt || ""} />
                  <div className="admin-media-copy">
                    <strong>{isPrimary ? "Главное" : `Фото ${index + 1}`}</strong>
                    <small title={image.url}>{image.url}</small>
                  </div>
                  <div className="admin-media-actions">
                    {!isPrimary && (
                      <button
                        className="admin-mini-button"
                        type="button"
                        onClick={() => void saveImageOrder(images, image.id)}
                        disabled={savingImages}
                      >
                        Главное
                      </button>
                    )}
                    <button className="admin-icon-button" type="button" aria-label="Поднять изображение" onClick={() => moveImage(index, -1)} disabled={savingImages || index === 0}><ArrowUp size={16} aria-hidden="true" /></button>
                    <button className="admin-icon-button" type="button" aria-label="Опустить изображение" onClick={() => moveImage(index, 1)} disabled={savingImages || index === images.length - 1}><ArrowDown size={16} aria-hidden="true" /></button>
                    <button className="admin-icon-button is-danger" type="button" aria-label="Удалить изображение" onClick={() => void deleteImage(image.id)} disabled={savingImages}><Trash2 size={16} aria-hidden="true" /></button>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="admin-empty admin-empty--compact">Изображений пока нет.</p>
        )}
      </section>

      <section className="admin-editor-section">
        <div className="admin-section-head">
          <h2>Характеристики</h2>
          <button
            type="button"
            className="button button-secondary"
            onClick={() => setCharacteristics((current) => [
              ...current,
              { label: "", value: "", confidence: 1, needsReview: false },
            ])}
          >
            Добавить
          </button>
        </div>

        <div className="admin-characteristics">
          {characteristics.map((item, index) => {
            const definition = initialCharacteristicDefinitions.find(
              (candidate) => candidate.label.toLowerCase() === item.label.trim().toLowerCase(),
            );
            return (
              <div className="admin-characteristic-row" key={`${index}-${item.label}`}>
                <select
                  aria-label={`Название характеристики ${index + 1}`}
                  value={item.label}
                  onChange={(event) => updateCharacteristicLabel(index, event.target.value)}
                >
                  <option value="">Выберите характеристику</option>
                  {item.label && !definition && <option value={item.label}>{item.label}</option>}
                  {initialCharacteristicDefinitions.map((option) => (
                    <option value={option.label} key={option.key}>{option.label}</option>
                  ))}
                </select>
                {definition?.options.length ? (
                  <select
                    aria-label={`Значение характеристики ${index + 1}`}
                    value={item.value}
                    onChange={(event) => updateCharacteristic(index, { value: event.target.value })}
                  >
                    <option value="">Выберите значение</option>
                    {item.value && !definition.options.includes(item.value) && (
                      <option value={item.value}>{item.value}</option>
                    )}
                    {definition.options.map((value) => (
                      <option value={value} key={value}>{value}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    aria-label={`Значение характеристики ${index + 1}`}
                    value={item.value}
                    onChange={(event) => updateCharacteristic(index, { value: event.target.value })}
                    placeholder="Значение"
                  />
                )}
                <button
                  className="admin-icon-button is-danger"
                  type="button"
                  aria-label={`Удалить характеристику ${index + 1}`}
                  onClick={() => setCharacteristics((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                >
                  <Trash2 size={16} aria-hidden="true" />
                </button>
              </div>
            );
          })}
          {!characteristics.length && <p className="admin-empty admin-empty--compact">Характеристики не заполнены.</p>}
        </div>
      </section>

      {error && <p className="form-error" role="alert">{error}</p>}
    </div>
  );
}
