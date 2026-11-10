import { validateOrderPayload } from "../../../lib/forms/validation";
import { createOrder, PublishedProductsUnavailableError } from "../../../lib/orders/service";
import { allowRequest, clientKey } from "../../../lib/security/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!(await allowRequest(`${clientKey(request)}:order`, 5, 10 * 60_000))) {
    return Response.json({ error: "Слишком много заявок. Попробуйте позже." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Некорректное тело запроса" }, { status: 400 });
  }

  const validation = validateOrderPayload(body);
  if ("error" in validation) return Response.json({ error: validation.error }, { status: 422 });
  const consentIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("x-real-ip")?.trim()
    || "";
  const consentUserAgent = request.headers.get("user-agent")?.trim().slice(0, 500) || "";

  try {
    const result = await createOrder({ ...validation.value, consentIp, consentUserAgent });
    if (!result.stored) return Response.json({ ok: true, stored: false, message: "Заявка принята в демонстрационном режиме" }, { status: 201 });
    return Response.json({
      ok: true,
      stored: true,
      orderId: result.orderId,
      notification: result.notification,
      customerNotification: result.customerNotification,
    }, { status: 201 });
  } catch (error) {
    if (error instanceof PublishedProductsUnavailableError) return Response.json({ error: "Один из товаров больше недоступен" }, { status: 409 });
    throw error;
  }
}
