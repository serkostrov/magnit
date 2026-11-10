export const REVIEW_PHOTO_MAX_BYTES = 5 * 1024 * 1024;

export type ReviewPhotoType = { extension: "jpg" | "png" | "webp"; contentType: string };

export function reviewInitials(name: string) {
  const parts = name.trim().split(/\s+/u).filter(Boolean);
  if (!parts.length) return "?";
  const selected = parts.length > 1 ? [parts[0], parts.at(-1)!] : [parts[0]];
  return selected.map((part) => Array.from(part.replace(/^[^\p{L}\p{N}]+/u, ""))[0] || "").join("").toLocaleUpperCase("ru-RU").slice(0, 2) || "?";
}

export function detectReviewPhoto(bytes: Uint8Array): ReviewPhotoType | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { extension: "jpg", contentType: "image/jpeg" };
  }
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a) {
    return { extension: "png", contentType: "image/png" };
  }
  if (bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP") {
    return { extension: "webp", contentType: "image/webp" };
  }
  return null;
}

export function validateReviewFields(input: { authorName: string; rating: number; body: string; consent: boolean }) {
  const authorName = input.authorName.trim();
  const body = input.body.trim();
  if (authorName.length < 2 || authorName.length > 160) return { error: "Укажите имя и фамилию" } as const;
  if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5) return { error: "Выберите оценку от 1 до 5" } as const;
  if (body.length < 10) return { error: "Напишите отзыв длиной не менее 10 символов" } as const;
  if (body.length > 4_000) return { error: "Отзыв слишком длинный" } as const;
  if (!input.consent) return { error: "Нужно согласиться с публикацией отзыва" } as const;
  return { value: { authorName, rating: input.rating, body } } as const;
}
