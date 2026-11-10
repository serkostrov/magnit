import { NextResponse } from "next/server";
import {
  AdminCharacteristicDefinitionInUseError,
  AdminCharacteristicDefinitionNotFoundError,
  deleteAdminCharacteristicDefinition,
  isAdminCharacteristicDefinitionDatabaseConfigured,
  isValidAdminCharacteristicDefinitionInput,
  parseAdminCharacteristicDefinitionInput,
  updateAdminCharacteristicDefinition,
} from "@/lib/catalog/characteristic-definition-service";
import { revalidateCatalog } from "@/lib/catalog/revalidation";
import { authorizeAdmin } from "@/lib/security/admin-request";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ key: string }> },
) {
  const auth = await authorizeAdmin(request, true);
  if (auth.error) return auth.error;
  if (!isAdminCharacteristicDefinitionDatabaseConfigured()) {
    return Response.json(
      { error: "Подключите PostgreSQL для записи характеристик" },
      { status: 503 },
    );
  }
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "Некорректное тело запроса" }, { status: 400 });
  }
  const input = parseAdminCharacteristicDefinitionInput(body);
  if (!isValidAdminCharacteristicDefinitionInput(input)) {
    return Response.json({ error: "Укажите название характеристики" }, { status: 422 });
  }
  try {
    const { key } = await params;
    const item = await updateAdminCharacteristicDefinition(key, input, auth.admin!.id);
    revalidateCatalog();
    return NextResponse.json({ item });
  } catch (error) {
    if (error instanceof AdminCharacteristicDefinitionNotFoundError) {
      return Response.json({ error: "Характеристика не найдена" }, { status: 404 });
    }
    if (
      error instanceof Error &&
      (/duplicate|unique/i.test(error.message) ||
        error.message === "DUPLICATE_CHARACTERISTIC_DEFINITION")
    ) {
      return Response.json(
        { error: "Такая характеристика уже существует" },
        { status: 409 },
      );
    }
    return Response.json({ error: "Не удалось обновить характеристику" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ key: string }> },
) {
  const auth = await authorizeAdmin(request, true);
  if (auth.error) return auth.error;
  if (!isAdminCharacteristicDefinitionDatabaseConfigured()) {
    return Response.json(
      { error: "Подключите PostgreSQL для удаления характеристик" },
      { status: 503 },
    );
  }
  try {
    const { key } = await params;
    await deleteAdminCharacteristicDefinition(key, auth.admin!.id);
    revalidateCatalog();
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AdminCharacteristicDefinitionNotFoundError) {
      return Response.json({ error: "Характеристика не найдена" }, { status: 404 });
    }
    if (error instanceof AdminCharacteristicDefinitionInUseError) {
      return Response.json(
        {
          error: `Нельзя удалить характеристику: она используется в ${error.productCount} товарах`,
        },
        { status: 409 },
      );
    }
    return Response.json({ error: "Не удалось удалить характеристику" }, { status: 500 });
  }
}
