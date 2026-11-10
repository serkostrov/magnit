const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type AdminBulkProductCategoryAction = "add" | "remove";

export type AdminBulkProductCategoryInput = {
  productIds: string[];
  categorySlug: string;
  action: AdminBulkProductCategoryAction | "";
};

export function parseAdminBulkProductCategoryInput(body: Record<string, unknown>): AdminBulkProductCategoryInput {
  const rawProductIds = Array.isArray(body.productIds) ? body.productIds : [];
  const productIds = rawProductIds.every((value) => typeof value === "string")
    ? [...new Set(rawProductIds.map((value) => String(value).trim()))]
    : [];
  const action = body.action === "add" || body.action === "remove" ? body.action : "";
  return {
    productIds,
    categorySlug: typeof body.categorySlug === "string"
      ? body.categorySlug.trim().slice(0, 120).toLowerCase()
      : "",
    action,
  };
}

export function isValidAdminBulkProductCategoryInput(input: AdminBulkProductCategoryInput) {
  return Boolean(
    input.productIds.length > 0 &&
    input.productIds.length <= 100 &&
    input.productIds.every((id) => uuidPattern.test(id)) &&
    input.categorySlug &&
    /^[a-z0-9-]+$/.test(input.categorySlug) &&
    (input.action === "add" || input.action === "remove"),
  );
}
