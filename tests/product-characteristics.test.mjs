import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { groupProductCharacteristics } from "../lib/catalog/product-characteristics.ts";
import {
  isValidAdminBulkProductCategoryInput,
  parseAdminBulkProductCategoryInput,
} from "../lib/catalog/bulk-category-input.ts";

test("groups applications and industries while preserving other characteristics", () => {
  const groups = groupProductCharacteristics([
    { label: "Вес", value: "1 г" },
    { label: "Применение", value: "Для рекламы", filterKey: "application", filterSlug: "reklama", filterEnabled: true },
    { label: "Применение", value: "Для маркерных досок", filterKey: "application", filterSlug: "doski", filterEnabled: true },
    { label: "Отрасль", value: "Мебель", filterKey: "industry", filterSlug: "mebel", filterEnabled: true },
    { label: "Отрасль", value: "Реклама", filterKey: "industry", filterSlug: "reklama", filterEnabled: true },
    { label: "Толщина", value: "1 мм" },
  ]);

  assert.deepEqual(
    groups.map((group) => ({
      label: group.label,
      values: group.values.map((item) => item.value),
    })),
    [
      { label: "Вес", values: ["1 г"] },
      { label: "Применение", values: ["Для рекламы", "Для маркерных досок"] },
      { label: "Отрасль", values: ["Мебель", "Реклама"] },
      { label: "Толщина", values: ["1 мм"] },
    ],
  );
});

test("removes exact duplicates inside grouped values", () => {
  const groups = groupProductCharacteristics([
    { label: "Применение", value: "Для рекламы", filterKey: "application", filterSlug: "reklama" },
    { label: "Применение", value: "Для рекламы", filterKey: "application", filterSlug: "reklama" },
  ]);

  assert.equal(groups.length, 1);
  assert.equal(groups[0].values.length, 1);
});

test("product descriptions explicitly restore unordered and ordered list markers", async () => {
  const [globalCss, correctionCss] = await Promise.all([
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/client-corrections.css", import.meta.url), "utf8"),
  ]);

  for (const css of [globalCss, correctionCss]) {
    assert.match(css, /\.product-description-content ul\s*\{[^}]*list-style-type:\s*disc/s);
    assert.match(css, /\.product-description-content ol\s*\{[^}]*list-style-type:\s*decimal/s);
  }
});

test("admin uses one product save and explains protected category deletion", async () => {
  const [categoryEditor, mediaEditor, categoryPage, categoryRoute] = await Promise.all([
    readFile(new URL("../components/AdminProductCategoryEditor.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/AdminProductMediaEditor.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/admin/categories/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/admin/categories/[id]/route.ts", import.meta.url), "utf8"),
  ]);

  assert.doesNotMatch(categoryEditor, /Сохранить категории/);
  assert.doesNotMatch(mediaEditor, /Сохранить характеристики|Confidence характеристики|В фильтрах/);
  assert.match(categoryPage, /rowError\.message/);
  assert.match(
    categoryRoute,
    /Нельзя удалить категорию: к ней привязано.*Сначала перенесите их в другую категорию/,
  );
});

test("admin product category filter follows the managed category order", async () => {
  const [adminService, characteristicsPage, productsPage, productsRoute] = await Promise.all([
    readFile(new URL("../lib/catalog/admin-service.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/admin/characteristics/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/admin/products/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/admin/products/route.ts", import.meta.url), "utf8"),
  ]);

  assert.match(
    adminService,
    /SELECT slug, title FROM categories ORDER BY sort_order, title/,
  );
  assert.match(
    adminService,
    /FROM product_categories category_relation[\s\S]*related_category\.slug = \$\$\{params\.length\}/,
  );
  assert.match(characteristicsPage, /\/admin\/products\?characteristic=/);
  assert.match(productsPage, /Характеристика:[\s\S]*characteristicLabel/);
  assert.match(productsRoute, /characteristicKey: url\.searchParams\.get\("characteristic"\)/);
  assert.match(
    adminService,
    /FROM product_characteristics characteristic_filter[\s\S]*characteristic_setting\.filter_key = \$\$\{params\.length\}/,
  );
});

test("validates a bounded bulk product category request", () => {
  const firstId = "11111111-1111-4111-8111-111111111111";
  const secondId = "22222222-2222-4222-8222-222222222222";
  const input = parseAdminBulkProductCategoryInput({
    productIds: [firstId, secondId, firstId],
    categorySlug: "  Magnitnye-Krepleniya  ",
    action: "add",
  });

  assert.deepEqual(input, {
    productIds: [firstId, secondId],
    categorySlug: "magnitnye-krepleniya",
    action: "add",
  });
  assert.equal(isValidAdminBulkProductCategoryInput(input), true);
  assert.equal(
    isValidAdminBulkProductCategoryInput({ ...input, productIds: ["not-a-uuid"] }),
    false,
  );
});

test("admin catalog exposes protected bulk category add and remove", async () => {
  const [productsPage, bulkRoute, categoryService] = await Promise.all([
    readFile(new URL("../app/admin/products/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/admin/products/bulk-categories/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/catalog/category-service.ts", import.meta.url), "utf8"),
  ]);

  assert.match(productsPage, /Выбрать все товары на странице/);
  assert.match(productsPage, /Добавить в категорию/);
  assert.match(productsPage, /Убрать из категории/);
  assert.match(productsPage, /\/api\/admin\/products\/bulk-categories/);
  assert.match(bulkRoute, /authorizeAdmin\(request, true\)/);
  assert.match(bulkRoute, /export async function PATCH/);
  assert.match(categoryService, /ON CONFLICT \(product_id,category_id\) DO NOTHING/);
  assert.match(categoryService, /product\.main_category_id IS DISTINCT FROM \$2::uuid/);
  assert.match(categoryService, /relation\.is_primary=false/);
  assert.match(categoryService, /primarySkippedCount/);
});
