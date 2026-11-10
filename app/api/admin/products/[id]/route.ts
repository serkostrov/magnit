import { NextResponse } from "next/server";
import {
  getAdminProduct,
  isAdminCatalogDatabaseConfigured,
  isValidAdminProductInput,
  parseAdminProductInput,
  updateAdminProduct,
  deleteAdminProduct,
  AdminProductNotFoundError,
  AdminProductStatusTransitionError,
} from "@/lib/catalog/admin-service";
import { authorizeAdmin } from "@/lib/security/admin-request";
import { revalidateCatalog } from "@/lib/catalog/revalidation";
import {
  assignAdminProductCategories,
  InvalidCategoryAssignmentError,
} from "@/lib/catalog/category-service";
import {
  AdminProductImageNotFoundError,
  updateProductCharacteristics,
} from "@/lib/catalog/media-service";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeAdmin(request);
  if (auth.error) return auth.error;
  if (!isAdminCatalogDatabaseConfigured()) return Response.json({ error: "Товар доступен после подключения PostgreSQL" }, { status: 503 });
  const { id } = await params;
  const product = await getAdminProduct(id);
  if (!product) return Response.json({ error: "Товар не найден" }, { status: 404 });
  return NextResponse.json(product);
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeAdmin(request, true);
  if (auth.error) return auth.error;
  if (!isAdminCatalogDatabaseConfigured()) {
    return Response.json({ error: "Подключите PostgreSQL для удаления товара" }, { status: 503 });
  }
  const { id } = await params;
  try {
    const result = await deleteAdminProduct(id, auth.admin!.id);
    revalidateCatalog(result.slug);
    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof AdminProductNotFoundError) {
      return Response.json({ error: "Товар не найден" }, { status: 404 });
    }
    return Response.json({ error: "Не удалось удалить товар" }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeAdmin(request, true);
  if (auth.error) return auth.error;
  if (!isAdminCatalogDatabaseConfigured()) return Response.json({ error: "Подключите PostgreSQL для записи каталога" }, { status: 503 });
  const { id } = await params;
  let body: Record<string, unknown>;
  try { body = (await request.json()) as Record<string, unknown>; } catch { return Response.json({ error: "Некорректное тело запроса" }, { status: 400 }); }
  const input = parseAdminProductInput(body);
  if (!isValidAdminProductInput(input)) return Response.json({ error: "Заполните обязательные поля карточки и проверьте числовые значения" }, { status: 422 });
  const hasComposition = Object.hasOwn(body, "primaryCategoryId");
  const primaryCategoryId = typeof body.primaryCategoryId === "string" ? body.primaryCategoryId : "";
  const additionalCategoryIds = Array.isArray(body.additionalCategoryIds)
    ? body.additionalCategoryIds.filter((value): value is string => typeof value === "string")
    : [];
  const characteristics = Array.isArray(body.characteristics)
    ? body.characteristics.filter(
        (item): item is {
          label: string;
          value: string;
          confidence?: number | null;
          needsReview?: boolean;
        } => Boolean(
          item &&
          typeof item === "object" &&
          typeof (item as Record<string, unknown>).label === "string" &&
          typeof (item as Record<string, unknown>).value === "string",
        ),
      )
    : [];
  if (hasComposition && !primaryCategoryId) {
    return Response.json({ error: "Выберите основную категорию" }, { status: 422 });
  }
  try {
    const current = await getAdminProduct(id);
    if (!current) return Response.json({ error: "Товар не найден" }, { status: 404 });
    const result = await updateAdminProduct(id, input, auth.admin!.id);
    if (hasComposition) {
      await assignAdminProductCategories(
        id,
        primaryCategoryId,
        additionalCategoryIds,
        auth.admin!.id,
      );
      await updateProductCharacteristics(id, characteristics, auth.admin!.id);
    }
    revalidateCatalog(result);
    if (typeof current.slug === "string" && current.slug !== result) revalidateCatalog(current.slug);
    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof AdminProductNotFoundError) return Response.json({ error: "Товар не найден" }, { status: 404 });
    if (error instanceof AdminProductStatusTransitionError) return Response.json({ error: "Недопустимый переход статуса" }, { status: 422 });
    if (error instanceof InvalidCategoryAssignmentError) return Response.json({ error: "Проверьте выбранные категории" }, { status: 422 });
    if (error instanceof AdminProductImageNotFoundError) return Response.json({ error: "Товар не найден" }, { status: 404 });
    if (error instanceof Error && error.message === "UNKNOWN_CHARACTERISTIC_DEFINITION") return Response.json({ error: "Выберите характеристику из справочника" }, { status: 422 });
    if (error instanceof Error && /duplicate|unique/i.test(error.message)) return Response.json({ error: "Такой slug уже существует" }, { status: 409 });
    return Response.json({ error: "Не удалось обновить товар" }, { status: 500 });
  }
}
