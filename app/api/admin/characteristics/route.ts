import { NextResponse } from "next/server";
import {
  createAdminCharacteristicDefinition,
  isAdminCharacteristicDefinitionDatabaseConfigured,
  isValidAdminCharacteristicDefinitionInput,
  listAdminCharacteristicDefinitions,
  parseAdminCharacteristicDefinitionInput,
} from "@/lib/catalog/characteristic-definition-service";
import { revalidateCatalog } from "@/lib/catalog/revalidation";
import { authorizeAdmin } from "@/lib/security/admin-request";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await authorizeAdmin(request);
  if (auth.error) return auth.error;
  if (!isAdminCharacteristicDefinitionDatabaseConfigured()) {
    return NextResponse.json({ items: [], demo: true });
  }
  return NextResponse.json({ items: await listAdminCharacteristicDefinitions() });
}

export async function POST(request: Request) {
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
    const item = await createAdminCharacteristicDefinition(input, auth.admin!.id);
    revalidateCatalog();
    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
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
    return Response.json({ error: "Не удалось создать характеристику" }, { status: 500 });
  }
}
