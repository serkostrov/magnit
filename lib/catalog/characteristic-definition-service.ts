import { createHash } from "node:crypto";
import { recordAdminAudit } from "../audit/service";
import { isDatabaseConfigured, query, withTransaction } from "../db/client";
import { cleanText } from "../forms/validation";
import { normalizeFilterKey } from "./filter-definitions";

export type AdminCharacteristicDefinitionInput = {
  label: string;
  enabled: boolean;
  sortOrder: number;
  options: string[];
};

export type AdminCharacteristicDefinition = AdminCharacteristicDefinitionInput & {
  key: string;
  productCount: number;
};

export class AdminCharacteristicDefinitionNotFoundError extends Error {
  constructor() {
    super("CHARACTERISTIC_DEFINITION_NOT_FOUND");
    this.name = "AdminCharacteristicDefinitionNotFoundError";
  }
}

export class AdminCharacteristicDefinitionInUseError extends Error {
  readonly productCount: number;

  constructor(productCount: number) {
    super(`Characteristic definition is used by ${productCount} products`);
    this.name = "AdminCharacteristicDefinitionInUseError";
    this.productCount = productCount;
  }
}

export function isAdminCharacteristicDefinitionDatabaseConfigured() {
  return isDatabaseConfigured();
}

export function parseAdminCharacteristicDefinitionInput(
  body: Record<string, unknown>,
): AdminCharacteristicDefinitionInput {
  const rawOptions = Array.isArray(body.options) ? body.options : [];
  const options = Array.from(
    new Map(
      rawOptions
        .map((value) => cleanText(value, 240))
        .filter(Boolean)
        .map((value) => [value.toLowerCase(), value]),
    ).values(),
  );
  return {
    label: cleanText(body.label, 120),
    enabled: body.enabled === true,
    sortOrder: Number.isInteger(Number(body.sortOrder))
      ? Math.max(0, Number(body.sortOrder))
      : 100,
    options,
  };
}

export function isValidAdminCharacteristicDefinitionInput(
  input: AdminCharacteristicDefinitionInput,
) {
  return Boolean(input.label && input.sortOrder >= 0);
}

function definitionKey(label: string) {
  const normalized = label.trim().toLowerCase().replace(/ё/g, "е");
  if (normalized === "применение") return "application";
  if (normalized === "отрасль") return "industry";
  return `property-${createHash("md5").update(normalized).digest("hex").slice(0, 16)}`;
}

function optionRows(options: string[]) {
  const used = new Set<string>();
  return options.map((value, index) => {
    const base = normalizeFilterKey(value);
    let slug = base;
    let suffix = 2;
    while (used.has(slug)) {
      slug = `${base}-${suffix}`;
      suffix += 1;
    }
    used.add(slug);
    return { slug, value, sortOrder: index };
  });
}

export async function listAdminCharacteristicDefinitions(): Promise<
  AdminCharacteristicDefinition[]
> {
  const [settings, options, usage] = await Promise.all([
    query<{
      filter_key: string;
      source_label: string;
      is_enabled: boolean;
      sort_order: number;
    }>(`
      SELECT filter_key, source_label, is_enabled, sort_order
      FROM catalog_filter_settings
      ORDER BY sort_order, source_label`),
    query<{ filter_key: string; value: string }>(`
      SELECT filter_key, value
      FROM catalog_filter_options
      ORDER BY filter_key, sort_order, value`),
    query<{ source_label: string; product_count: number }>(`
      SELECT settings.source_label, COUNT(DISTINCT characteristic.product_id)::int AS product_count
      FROM catalog_filter_settings settings
      LEFT JOIN product_characteristics characteristic
        ON lower(trim(characteristic.label)) = lower(trim(settings.source_label))
      GROUP BY settings.filter_key, settings.source_label`),
  ]);
  return settings.rows.map((setting) => ({
    key: setting.filter_key,
    label: setting.source_label,
    enabled: setting.is_enabled,
    sortOrder: Number(setting.sort_order || 0),
    options: options.rows
      .filter((option) => option.filter_key === setting.filter_key)
      .map((option) => option.value),
    productCount: Number(
      usage.rows.find(
        (item) => item.source_label.toLowerCase() === setting.source_label.toLowerCase(),
      )?.product_count || 0,
    ),
  }));
}

export async function createAdminCharacteristicDefinition(
  input: AdminCharacteristicDefinitionInput,
  adminId: string,
) {
  const key = definitionKey(input.label);
  return withTransaction(async (client) => {
    await client.query(
      `INSERT INTO catalog_filter_settings
        (filter_key,label,source_label,is_enabled,sort_order,updated_at)
       VALUES ($1,$2,$2,$3,$4,now())`,
      [key, input.label, input.enabled, input.sortOrder],
    );
    for (const option of optionRows(input.options)) {
      await client.query(
        `INSERT INTO catalog_filter_options (filter_key,slug,value,sort_order)
         VALUES ($1,$2,$3,$4)`,
        [key, option.slug, option.value, option.sortOrder],
      );
    }
    await recordAdminAudit(
      adminId,
      "create",
      "characteristic_definition",
      key,
      input,
      client,
    );
    return { key };
  });
}

export async function updateAdminCharacteristicDefinition(
  key: string,
  input: AdminCharacteristicDefinitionInput,
  adminId: string,
) {
  return withTransaction(async (client) => {
    const current = await client.query<{ source_label: string }>(
      "SELECT source_label FROM catalog_filter_settings WHERE filter_key=$1 FOR UPDATE",
      [key],
    );
    if (!current.rows[0]) throw new AdminCharacteristicDefinitionNotFoundError();
    const duplicate = await client.query<{
      filter_key: string;
      source_label: string;
      is_enabled: boolean;
      sort_order: number;
    }>(
      `SELECT filter_key,source_label,is_enabled,sort_order FROM catalog_filter_settings
       WHERE filter_key<>$1 AND lower(trim(source_label))=lower(trim($2))
       LIMIT 1 FOR UPDATE`,
      [key, input.label],
    );

    const previousLabel = current.rows[0].source_label;
    const mergeTarget = duplicate.rows[0];
    if (mergeTarget) {
      await client.query(
        `UPDATE product_characteristics
         SET label=$1
         WHERE lower(trim(label))=lower(trim($2))`,
        [mergeTarget.source_label, previousLabel],
      );
      await client.query(`
        DELETE FROM product_characteristics duplicate
        USING product_characteristics original
        WHERE duplicate.id > original.id
          AND duplicate.product_id = original.product_id
          AND lower(trim(duplicate.label)) = lower(trim(original.label))
          AND duplicate.value = original.value
          AND lower(trim(duplicate.label)) = lower(trim($1))`,
      [mergeTarget.source_label]);
      const targetOptions = await client.query<{ value: string }>(
        "SELECT value FROM catalog_filter_options WHERE filter_key=$1 ORDER BY sort_order,value",
        [mergeTarget.filter_key],
      );
      const mergedOptions = Array.from(
        new Map(
          [...targetOptions.rows.map((item) => item.value), ...input.options]
            .map((value) => [value.toLowerCase(), value]),
        ).values(),
      );
      await client.query(
        `UPDATE catalog_filter_settings
         SET is_enabled=$1,sort_order=$2,updated_at=now()
         WHERE filter_key=$3`,
        [
          mergeTarget.is_enabled || input.enabled,
          Math.min(mergeTarget.sort_order, input.sortOrder),
          mergeTarget.filter_key,
        ],
      );
      await client.query("DELETE FROM catalog_filter_options WHERE filter_key=$1", [
        mergeTarget.filter_key,
      ]);
      for (const option of optionRows(mergedOptions)) {
        await client.query(
          `INSERT INTO catalog_filter_options (filter_key,slug,value,sort_order)
           VALUES ($1,$2,$3,$4)`,
          [mergeTarget.filter_key, option.slug, option.value, option.sortOrder],
        );
      }
      await client.query("DELETE FROM catalog_filter_settings WHERE filter_key=$1", [key]);
      await recordAdminAudit(
        adminId,
        "merge",
        "characteristic_definition",
        key,
        { previousLabel, targetKey: mergeTarget.filter_key, targetLabel: mergeTarget.source_label },
        client,
      );
      return { key: mergeTarget.filter_key, merged: true };
    }

    await client.query(
      `UPDATE product_characteristics
       SET label=$1
       WHERE lower(trim(label))=lower(trim($2))`,
      [input.label, previousLabel],
    );
    await client.query(
      `UPDATE catalog_filter_settings
       SET label=$1,source_label=$1,is_enabled=$2,sort_order=$3,updated_at=now()
       WHERE filter_key=$4`,
      [input.label, input.enabled, input.sortOrder, key],
    );
    await client.query("DELETE FROM catalog_filter_options WHERE filter_key=$1", [key]);
    for (const option of optionRows(input.options)) {
      await client.query(
        `INSERT INTO catalog_filter_options (filter_key,slug,value,sort_order)
         VALUES ($1,$2,$3,$4)`,
        [key, option.slug, option.value, option.sortOrder],
      );
    }
    await recordAdminAudit(
      adminId,
      "update",
      "characteristic_definition",
      key,
      { previousLabel, ...input },
      client,
    );
    return { key };
  });
}

export async function deleteAdminCharacteristicDefinition(
  key: string,
  adminId: string,
) {
  return withTransaction(async (client) => {
    const current = await client.query<{ source_label: string }>(
      "SELECT source_label FROM catalog_filter_settings WHERE filter_key=$1 FOR UPDATE",
      [key],
    );
    if (!current.rows[0]) throw new AdminCharacteristicDefinitionNotFoundError();
    const usage = await client.query<{ count: number }>(
      `SELECT COUNT(DISTINCT product_id)::int AS count
       FROM product_characteristics
       WHERE lower(trim(label))=lower(trim($1))`,
      [current.rows[0].source_label],
    );
    const productCount = Number(usage.rows[0]?.count || 0);
    if (productCount > 0) {
      throw new AdminCharacteristicDefinitionInUseError(productCount);
    }
    await client.query("DELETE FROM catalog_filter_settings WHERE filter_key=$1", [key]);
    await recordAdminAudit(
      adminId,
      "delete",
      "characteristic_definition",
      key,
      {},
      client,
    );
    return { key };
  });
}
