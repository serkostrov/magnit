import { NextResponse } from "next/server";
import { authorizeAdmin } from "@/lib/security/admin-request";
import { isAdminCatalogDatabaseConfigured } from "@/lib/catalog/admin-service";
import { addProductImage, InvalidProductImageOrderError, reorderProductImages } from "@/lib/catalog/media-service";
import { revalidateCatalog } from "@/lib/catalog/revalidation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeAdmin(request, true);
  if (auth.error) return auth.error;
  if (!isAdminCatalogDatabaseConfigured()) return Response.json({ error: "Подключите PostgreSQL для загрузки изображений" }, { status: 503 });
  const { id } = await params;
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return Response.json({ error: "Выберите файл изображения" }, { status: 422 });
  try {
    const result = await addProductImage(id, file, auth.admin!.id);
    revalidateCatalog(result.slug);
    return NextResponse.json(result.image, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.name === "AdminProductImageNotFoundError") return Response.json({ error: "Товар не найден" }, { status: 404 });
    if (error instanceof Error && error.message === "UNSUPPORTED_IMAGE_TYPE") return Response.json({ error: "Поддерживаются JPEG, PNG, WebP, GIF и AVIF" }, { status: 415 });
    if (error instanceof Error && error.message === "IMAGE_TOO_LARGE") return Response.json({ error: "Файл слишком большой" }, { status: 413 });
    return Response.json({ error: "Не удалось загрузить изображение" }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeAdmin(request, true);
  if (auth.error) return auth.error;
  if (!isAdminCatalogDatabaseConfigured()) return Response.json({ error: "Подключите PostgreSQL для изменения галереи" }, { status: 503 });
  const { id } = await params;
  let body: Record<string, unknown>;
  try { body = (await request.json()) as Record<string, unknown>; } catch { return Response.json({ error: "Некорректное тело запроса" }, { status: 400 }); }
  const imageIds = Array.isArray(body.imageIds) ? body.imageIds.filter((item): item is string => typeof item === "string") : [];
  const primaryImageId = typeof body.primaryImageId === "string" ? body.primaryImageId : "";
  try {
    const result = await reorderProductImages(id, imageIds, primaryImageId, auth.admin!.id);
    revalidateCatalog(result.slug);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof InvalidProductImageOrderError) return Response.json({ error: "Проверьте порядок и главное изображение" }, { status: 422 });
    if (error instanceof Error && error.name === "AdminProductImageNotFoundError") return Response.json({ error: "Товар или изображение не найдено" }, { status: 404 });
    return Response.json({ error: "Не удалось сохранить галерею" }, { status: 500 });
  }
}
