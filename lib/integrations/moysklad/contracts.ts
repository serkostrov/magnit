import type { Product } from "../../catalog/types";

/**
 * Минимальный контракт будущей односторонней синхронизации.
 *
 * МойСклад остаётся единственным источником товарных данных. Sync-процесс
 * получает изменившиеся позиции, преобразует их в Product и выполняет upsert
 * в будущую БД сайта. Изменения на витрине не отправляются обратно в МойСклад.
 */
export type MoySkladProductSnapshot = {
  id: string;
  updated: string;
  name: string;
  article?: string;
  description?: string;
  archived?: boolean;
  salePrices?: Array<{ value: number }>;
  images?: {
    meta?: { href?: string };
    rows?: Array<{ filename?: string; meta?: { downloadHref?: string } }>;
  };
  attributes?: Array<{ name?: string; value?: unknown }>;
  pathName?: string;
};

export type CatalogUpsertRecord = Product & {
  externalId: string;
  source: "moysklad";
  sourceUpdatedAt: string;
};

export type CatalogSyncResult = {
  created: number;
  updated: number;
  archived: number;
  skipped: number;
  cursor?: string;
};

export interface CatalogSyncPort {
  upsertProducts(records: CatalogUpsertRecord[]): Promise<CatalogSyncResult>;
}
