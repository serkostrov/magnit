export type MoySkladSyncConfig = {
  enabled: boolean;
  apiUrl: string;
  apiToken: string | null;
  accountId: string | null;
  intervalMinutes: number;
};

export function readMoySkladSyncConfig(
  env: NodeJS.ProcessEnv = process.env,
): MoySkladSyncConfig {
  const interval = Number(env.MOYSKLAD_SYNC_INTERVAL_MINUTES ?? "15");

  return {
    enabled: env.MOYSKLAD_SYNC_ENABLED === "true",
    apiUrl:
      env.MOYSKLAD_API_URL?.replace(/\/+$/, "") ??
      "https://api.moysklad.ru/api/remap/1.2",
    apiToken: env.MOYSKLAD_API_TOKEN || null,
    accountId: env.MOYSKLAD_ACCOUNT_ID || null,
    intervalMinutes:
      Number.isFinite(interval) && interval > 0 ? Math.floor(interval) : 15,
  };
}

export function assertMoySkladSyncReady(config: MoySkladSyncConfig) {
  if (!config.enabled) {
    throw new Error("Синхронизация МойСклад отключена.");
  }

  if (!config.apiToken) {
    throw new Error(
      "Для синхронизации нужен серверный MOYSKLAD_API_TOKEN.",
    );
  }
}
