import { NextResponse } from "next/server";
import { authorizeAdmin } from "@/lib/security/admin-request";
import { CatalogRevalidationError, revalidateCatalog } from "@/lib/catalog/revalidation";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await authorizeAdmin(request, true);
  if (auth.error) return auth.error;

  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    // An empty body retries all catalog paths.
  }

  const slug = typeof body.slug === "string" ? body.slug.trim() : "";
  if (slug && !/^[a-z0-9-]+$/.test(slug)) {
    return NextResponse.json({ error: "Некорректный slug товара" }, { status: 422 });
  }

  try {
    revalidateCatalog(slug || undefined);
    return NextResponse.json({ ok: true, slug: slug || null });
  } catch (error) {
    if (error instanceof CatalogRevalidationError) {
      return NextResponse.json(
        {
          error: "Данные сохранены, но кеш не обновился; повторите ревалидацию",
          retryable: true,
          failures: error.failures,
        },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: "Не удалось обновить кеш каталога", retryable: true }, { status: 500 });
  }
}
