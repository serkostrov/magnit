import type {
  CatalogSyncPort,
  CatalogSyncResult,
  MoySkladProductSnapshot,
} from "./contracts";
import { mapMoySkladProduct } from "./mapper";

export type MoySkladSyncBatch = {
  products: MoySkladProductSnapshot[];
  nextCursor?: string;
};

export interface MoySkladSourcePort {
  getChangedProducts(cursor?: string): Promise<MoySkladSyncBatch>;
}

/**
 * Каркас односторонней синхронизации без сетевого клиента и без записи в БД.
 * Реальные adapters для API МойСклад и PostgreSQL подключаются на следующем
 * этапе через объявленные порты.
 */
export async function syncMoySkladCatalog(
  source: MoySkladSourcePort,
  target: CatalogSyncPort,
  cursor?: string,
): Promise<CatalogSyncResult> {
  const batch = await source.getChangedProducts(cursor);
  const records = batch.products.map(mapMoySkladProduct);
  const result = await target.upsertProducts(records);

  return {
    ...result,
    cursor: batch.nextCursor ?? result.cursor,
  };
}
