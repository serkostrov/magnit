import { NextResponse } from "next/server";
import { authorizeAdmin } from "@/lib/security/admin-request";
import { isAdminCatalogDatabaseConfigured } from "@/lib/catalog/admin-service";
import { AdminProductImageNotFoundError, deleteProductImage } from "@/lib/catalog/media-service";
import { revalidateCatalog } from "@/lib/catalog/revalidation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string; imageId: string }> }) {
  const auth = await authorizeAdmin(request, true);
  if (auth.error) return auth.error;
  if (!isAdminCatalogDatabaseConfigured()) return Response.json({ error: "Подключите PostgreSQL для удаления изображений" }, { status: 503 });
  const { id, imageId } = await params;
  try {
    const result = await deleteProductImage(id, imageId, auth.admin!.id);
    revalidateCatalog(result.slug);
    return NextResponse.json({ ok: true, imageId, primaryImageId: result.primaryImageId });
  } catch (error) {
    if (error instanceof AdminProductImageNotFoundError) return Response.json({ error: "Изображение не найдено" }, { status: 404 });
    return Response.json({ error: "Не удалось удалить изображение" }, { status: 500 });
  }
}
