import { checkDatabase } from "../../../lib/db/client";
import { getEmailNotificationReadiness } from "../../../lib/notifications/email";

export const dynamic = "force-dynamic";

export async function GET() {
  const database = await checkDatabase();
  return Response.json({
    ok: true,
    service: "site-magnit",
    catalog: {
      source: database.healthy ? "postgresql" : "static-seed",
    },
    database: { prepared: true, ...database },
    moysklad: {
      prepared: true,
      enabled: process.env.MOYSKLAD_SYNC_ENABLED === "true",
      configured: Boolean(process.env.MOYSKLAD_API_TOKEN),
    },
    notifications: {
      email: getEmailNotificationReadiness(),
    },
  });
}
