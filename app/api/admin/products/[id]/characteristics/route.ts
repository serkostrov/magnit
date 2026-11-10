import { NextResponse } from "next/server";
import { authorizeAdmin } from "@/lib/security/admin-request";
import { isAdminCatalogDatabaseConfigured } from "@/lib/catalog/admin-service";
import { AdminProductImageNotFoundError, updateProductCharacteristics } from "@/lib/catalog/media-service";
import { revalidateCatalog } from "@/lib/catalog/revalidation";

export const dynamic = "force-dynamic";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeAdmin(request, true);
  if (auth.error) return auth.error;
  if (!isAdminCatalogDatabaseConfigured()) return Response.json({ error: "Подключите PostgreSQL для изменения характеристик" }, { status: 503 });
  const { id } = await params;
  let body: Record<string, unknown>;
  try { body = (await request.json()) as Record<string, unknown>; } catch { return Response.json({ error: "Некорректное тело запроса" }, { status: 400 }); }
  const characteristics = Array.isArray(body.characteristics) ? body.characteristics.filter((item): item is { label: string; value: string; confidence?: number | null; needsReview?: boolean } => Boolean(item && typeof item === "object" && typeof (item as Record<string, unknown>).label === "string" && typeof (item as Record<string, unknown>).value === "string")) : [];
  try {
    const result = await updateProductCharacteristics(id, characteristics, auth.admin!.id);
    revalidateCatalog(result.slug);
    return NextResponse.json({ ok: true, characteristics: result.characteristics });
  } catch (error) {
    if (error instanceof AdminProductImageNotFoundError) return Response.json({ error: "Товар не найден" }, { status: 404 });
    if (error instanceof Error && error.message === "INVALID_CHARACTERISTIC_CONFIDENCE") return Response.json({ error: "Confidence должен быть числом от 0 до 1" }, { status: 422 });
    if (error instanceof Error && error.message === "UNKNOWN_CHARACTERISTIC_DEFINITION") return Response.json({ error: "Выберите характеристику из справочника" }, { status: 422 });
    return Response.json({ error: "Не удалось сохранить характеристики" }, { status: 500 });
  }
}
