export const CART_STORAGE_KEY = "saitmagnitov-cart-v1";
export const FAVORITES_STORAGE_KEY = "saitmagnitov-favorites-v1";
export const CART_UPDATED_EVENT = "saitmagnitov:cart-updated";

export type CartLine = {
  slug: string;
  quantity: number;
};

export function readCart(): CartLine[] {
  if (typeof window === "undefined") return [];

  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(CART_STORAGE_KEY) || "[]",
    ) as CartLine[];

    return parsed.filter(
      (line) =>
        typeof line.slug === "string" &&
        Number.isInteger(line.quantity) &&
        line.quantity > 0,
    );
  } catch {
    return [];
  }
}

export function writeCart(lines: CartLine[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(lines));
  window.dispatchEvent(new CustomEvent(CART_UPDATED_EVENT));
}

export function addToCart(slug: string, quantity = 1) {
  const cart = readCart();
  const existing = cart.find((line) => line.slug === slug);

  if (existing) {
    existing.quantity += quantity;
  } else {
    cart.push({ slug, quantity });
  }

  writeCart(cart);
}

export function readFavorites(): string[] {
  if (typeof window === "undefined") return [];

  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(FAVORITES_STORAGE_KEY) || "[]",
    ) as unknown[];
    return parsed.filter((value): value is string => typeof value === "string");
  } catch {
    return [];
  }
}

export function toggleFavorite(slug: string) {
  const favorites = readFavorites();
  const next = favorites.includes(slug)
    ? favorites.filter((item) => item !== slug)
    : [...favorites, slug];

  window.localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(next));
  return next.includes(slug);
}

export function formatPrice(value: number) {
  return new Intl.NumberFormat("ru-RU").format(value);
}
