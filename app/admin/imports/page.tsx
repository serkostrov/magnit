"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

type ImportRun = { id: string; source_name: string; mode: "dry-run" | "apply"; status: string; stats?: Record<string, unknown>; errors?: Array<Record<string, unknown>>; started_at?: string; finished_at?: string | null };

function csrfToken() { return document.cookie.split(";").map((part) => part.trim()).find((part) => part.startsWith("site_magnit_csrf="))?.split("=").slice(1).join("=") || ""; }
function date(value?: string | null) { return value ? new Date(value).toLocaleString("ru-RU") : "—"; }
function modeLabel(mode: string) { return mode === "dry-run" ? "Dry-run" : "Apply"; }
function statusLabel(status: string) { return status === "completed" ? "Завершён" : status === "failed" ? "Ошибка" : "Выполняется"; }

export default function AdminImportsPage() {
  const router = useRouter();
  const [source, setSource] = useState("/Users/alexlol/Downloads/Telegram Desktop/store-8215887-202608021218.csv");
  const [output, setOutput] = useState("");
  const [lastMode, setLastMode] = useState<"dry-run" | "apply" | "">("");
  const [error, setError] = useState("");
  const [running, setRunning] = useState(false);
  const [runs, setRuns] = useState<ImportRun[]>([]);
  const [search, setSearch] = useState("");
  const [mode, setMode] = useState("");
  const [status, setStatus] = useState("");
  const [hasErrors, setHasErrors] = useState(false);

  async function load() {
    const query = new URLSearchParams(); if (search) query.set("search", search); if (mode) query.set("mode", mode); if (status) query.set("status", status); if (hasErrors) query.set("hasErrors", "true");
    const response = await fetch(`/api/admin/imports?${query}`);
    if (response.status === 401) { router.replace("/admin/login"); return; }
    const payload = await response.json(); if (!response.ok) throw new Error(payload.error || "Не удалось загрузить журнал"); setRuns(payload.items || []);
  }

  useEffect(() => { const timer = window.setTimeout(() => { void load().catch((err) => setError(err instanceof Error ? err.message : "Не удалось загрузить журнал")); }, 0); return () => window.clearTimeout(timer); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, search, mode, status, hasErrors]);

  async function run(event: FormEvent<HTMLFormElement>, runMode: "dry-run" | "apply") {
    event.preventDefault(); setRunning(true); setError(""); setOutput(""); setLastMode(runMode);
    try { const response = await fetch("/api/admin/imports", { method: "POST", headers: { "content-type": "application/json", "x-csrf-token": csrfToken() }, body: JSON.stringify({ source, mode: runMode }) }); const payload = await response.json(); if (!response.ok) throw new Error(payload.error || "Импорт не выполнен"); setOutput(payload.output || "Готово"); void load(); } catch (err) { setError(err instanceof Error ? err.message : "Ошибка импорта"); } finally { setRunning(false); }
  }

  return <section className="admin-page"><div className="admin-page-head"><div><span className="eyebrow">Каталог</span><h1>Импорт Tilda</h1><p>Dry-run формирует отчёт; Apply сохраняет товары, изображения и результаты запуска.</p></div></div><form className="admin-form import-form" onSubmit={(event) => void run(event, "dry-run")}><label>CSV-файл на сервере<input value={source} onChange={(event) => setSource(event.target.value)} required /></label><div className="admin-actions"><button className="button button-secondary" type="submit" disabled={running}>Проверить dry-run</button><button className="button button-primary" type="button" disabled={running} onClick={(event) => { const form = event.currentTarget.form; if (form) void run({ preventDefault: () => {}, currentTarget: form } as FormEvent<HTMLFormElement>, "apply"); }}>Запустить импорт</button></div></form>{output && <pre className={`admin-output ${lastMode === "dry-run" ? "admin-dry-run-preview" : ""}`}>{output}</pre>}{error && <p className="form-error" role="alert">{error}</p>}<h2 className="admin-subheading">Журнал запусков</h2><form className="admin-toolbar admin-toolbar--imports" onSubmit={(event) => { event.preventDefault(); void load(); }}><input type="search" aria-label="Поиск по журналу импортов" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Источник, внешний ID или ошибка" /><select aria-label="Фильтр по режиму" value={mode} onChange={(event) => setMode(event.target.value)}><option value="">Все режимы</option><option value="dry-run">Dry-run</option><option value="apply">Apply</option></select><select aria-label="Фильтр по статусу" value={status} onChange={(event) => setStatus(event.target.value)}><option value="">Все статусы</option><option value="completed">Завершён</option><option value="failed">Ошибка</option><option value="running">Выполняется</option></select><label className="admin-checkbox"><input type="checkbox" checked={hasErrors} onChange={(event) => setHasErrors(event.target.checked)} /> Только с ошибками</label><button className="button button-secondary" type="submit">Фильтровать</button></form><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Источник</th><th>Режим</th><th>Статус</th><th>Старт</th><th>Ошибки</th><th /></tr></thead><tbody>{runs.map((run) => <tr key={run.id}><td><strong>{run.source_name}</strong><small>{date(run.finished_at || run.started_at)}</small></td><td><span className={`admin-status ${run.mode === "dry-run" ? "status-dry-run" : "status-apply"}`}>{modeLabel(run.mode)}</span></td><td><span className={`admin-status status-${run.status}`}>{statusLabel(run.status)}</span></td><td>{date(run.started_at)}</td><td>{run.errors?.length || 0}</td><td><Link href={`/admin/imports/${run.id}`}>Открыть →</Link></td></tr>)}</tbody></table>{runs.length === 0 && <p className="admin-empty">Запусков по выбранным условиям нет.</p>}</div></section>;
}
