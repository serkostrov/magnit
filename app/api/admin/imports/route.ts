import { NextResponse } from "next/server";
import { isImportDatabaseConfigured, listImportRuns, runTildaImport } from "@/lib/imports/service";
import { authorizeAdmin } from "@/lib/security/admin-request";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await authorizeAdmin(request);
  if (auth.error) return auth.error;
  if (!isImportDatabaseConfigured()) return NextResponse.json({ items: [], demo: true });
  const url = new URL(request.url);
  const mode = url.searchParams.get("mode");
  const status = url.searchParams.get("status");
  return NextResponse.json({ items: await listImportRuns({ mode: mode === "dry-run" || mode === "apply" ? mode : undefined, status: status === "running" || status === "completed" || status === "failed" ? status : undefined, search: url.searchParams.get("search") || "", hasErrors: url.searchParams.get("hasErrors") === "true" }) });
}

export async function POST(request: Request) {
  const auth = await authorizeAdmin(request, true);
  if (auth.error) return auth.error;
  let body: Record<string, unknown>;
  try { body = (await request.json()) as Record<string, unknown>; } catch { return Response.json({ error: "Некорректное тело запроса" }, { status: 400 }); }
  const source = typeof body.source === "string" ? body.source.trim() : "";
  const dryRun = body.mode !== "apply";
  if (!source || source.includes("\0") || /^https?:/i.test(source)) return Response.json({ error: "Укажите локальный путь к CSV" }, { status: 422 });
  if (!dryRun && !isImportDatabaseConfigured()) return Response.json({ error: "Для рабочего импорта подключите PostgreSQL" }, { status: 503 });
  try {
    const result = await runTildaImport(source, dryRun);
    return NextResponse.json({ ok: true, mode: dryRun ? "dry-run" : "apply", output: result.stdout, stderr: result.stderr });
  } catch (error) {
    const details = error && typeof error === "object" && "stdout" in error ? String((error as { stdout?: unknown }).stdout || "") : "";
    return Response.json({ error: "Импорт завершился с ошибкой", details }, { status: 500 });
  }
}
