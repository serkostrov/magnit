import { isDatabaseConfigured, query, withTransaction } from "../db/client";
import { recordAdminAudit } from "../audit/service";

export const homeBlockDefinitions = [
  { key: "hero", label: "Первый экран" },
  { key: "metrics", label: "Метрики" },
  { key: "categories", label: "Категории" },
  { key: "bestsellers", label: "Бестселлеры" },
  { key: "wizard", label: "Подбор за 3 минуты" },
  { key: "industry", label: "По отраслям" },
  { key: "applications", label: "Применения" },
  { key: "opt", label: "Оптовая форма" },
  { key: "process", label: "Как работаем" },
  { key: "delivery", label: "Доставка" },
  { key: "compare", label: "Почему мы" },
  { key: "reviews", label: "Отзывы" },
  { key: "faq", label: "Частые вопросы" },
  { key: "final-cta", label: "Финальный CTA" },
] as const;

export type HomeBlockKey = (typeof homeBlockDefinitions)[number]["key"];
export const defaultHomeBlockOrder = homeBlockDefinitions.map((block) => block.key);

const homeBlockMarkers: Record<HomeBlockKey, { start: string; end?: string }> = {
  hero: { start: "<!-- HERO -->", end: "<!-- METRICS -->" },
  metrics: { start: "<!-- METRICS -->", end: "<!-- CATALOG CATEGORIES -->" },
  categories: { start: "<!-- CATALOG CATEGORIES -->", end: "<!-- BESTSELLERS -->" },
  bestsellers: { start: "<!-- BESTSELLERS -->", end: "<!-- WIZARD -->" },
  wizard: { start: "<!-- WIZARD -->", end: "<!-- ТЗ №10: блок «По отраслям» вынесен на отдельную SEO-страницу otrasli.html (созвон 14.07) -->" },
  industry: { start: "<!-- ТЗ №10: блок «По отраслям» вынесен на отдельную SEO-страницу otrasli.html (созвон 14.07) -->", end: "<!-- APPLICATIONS CLOUD -->" },
  applications: { start: "<!-- APPLICATIONS CLOUD -->", end: "<!-- OPT FORM -->" },
  opt: { start: "<!-- OPT FORM -->", end: "<!-- PROCESS -->" },
  process: { start: "<!-- PROCESS -->", end: "<!-- DELIVERY -->" },
  delivery: { start: "<!-- DELIVERY -->", end: "<!-- COMPARE -->" },
  compare: { start: "<!-- COMPARE -->", end: "<!-- REVIEWS -->" },
  reviews: { start: "<!-- REVIEWS -->", end: "<!-- FAQ -->" },
  faq: { start: "<!-- FAQ -->", end: "<!-- FINAL CTA -->" },
  "final-cta": { start: "<!-- FINAL CTA -->" },
};

export function isValidHomeBlockOrder(order: string[]): order is HomeBlockKey[] {
  return order.length === homeBlockDefinitions.length && new Set(order).size === homeBlockDefinitions.length && order.every((key) => defaultHomeBlockOrder.includes(key as HomeBlockKey));
}

export function getHomeBlockRanges() {
  return homeBlockMarkers;
}

export async function getHomeBlockOrder(): Promise<HomeBlockKey[]> {
  if (!isDatabaseConfigured()) return [...defaultHomeBlockOrder];
  try {
    const result = await query<{ block_key: HomeBlockKey }>("SELECT block_key FROM home_blocks ORDER BY sort_order");
    const order = result.rows.map((row) => row.block_key);
    return isValidHomeBlockOrder(order) ? order : [...defaultHomeBlockOrder];
  } catch {
    return [...defaultHomeBlockOrder];
  }
}

export async function listAdminHomeBlocks() {
  const order = await getHomeBlockOrder();
  return order.map((key, position) => ({ ...homeBlockDefinitions.find((block) => block.key === key)!, key, position }));
}

export async function updateHomeBlockOrder(order: string[], adminId: string) {
  if (!isValidHomeBlockOrder(order)) throw new Error("INVALID_HOME_BLOCK_ORDER");
  return withTransaction(async (client) => {
    for (const [sortOrder, blockKey] of order.entries()) {
      await client.query("UPDATE home_blocks SET sort_order=$1,updated_at=now() WHERE block_key=$2", [sortOrder + homeBlockDefinitions.length, blockKey]);
    }
    for (const [sortOrder, blockKey] of order.entries()) {
      await client.query("UPDATE home_blocks SET sort_order=$1,updated_at=now() WHERE block_key=$2", [sortOrder, blockKey]);
    }
    await recordAdminAudit(adminId, "reorder", "home_blocks", "home", { order }, client as unknown as { query: (text: string, values?: unknown[]) => Promise<unknown> });
    return listAdminHomeBlocksWithClient(client);
  });
}

async function listAdminHomeBlocksWithClient(client: { query: <T = { block_key: HomeBlockKey }>(text: string, values?: unknown[]) => Promise<{ rows: T[] }> }) {
  const result = await client.query<{ block_key: HomeBlockKey }>("SELECT block_key FROM home_blocks ORDER BY sort_order");
  return result.rows.map((row, position) => ({ ...homeBlockDefinitions.find((block) => block.key === row.block_key)!, key: row.block_key, position }));
}
