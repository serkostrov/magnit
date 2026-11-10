import { NextResponse } from "next/server";
import {
  AdminCategoryNotFoundError,
  isAdminCategoryDatabaseConfigured,
  setAdminCategoryImage,
} from "@/lib/catalog/category-service";
import { revalidateCatalog } from "@/lib/catalog/revalidation";
import { authorizeAdmin } from "@/lib/security/admin-request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authorizeAdmin(request, true);
  if (auth.error) return auth.error;
  if (!isAdminCategoryDatabaseConfigured()) {
    return Response.json({ error: "Подключите PostgreSQL для загрузки изображения" }, { status: 503 });
  }
  const { id } = await params;
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: "Выберите изображение" }, { status: 422 });
  }
  try {
    const result = await setAdminCategoryImage(id, file, auth.admin!.id);
    revalidateCatalog();
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof AdminCategoryNotFoundError) {
      return Response.json({ error: "Категория не найдена" }, { status: 404 });
    }
    if (error instanceof Error && error.message === "UNSUPPORTED_IMAGE_TYPE") {
      return Response.json({ error: "Поддерживаются JPEG, PNG, WebP, GIF и AVIF" }, { status: 415 });
    }
    if (error instanceof Error && error.message === "IMAGE_TOO_LARGE") {
      return Response.json({ error: "Файл слишком большой" }, { status: 413 });
    }
    return Response.json({ error: "Не удалось загрузить изображение" }, { status: 500 });
  }
}
