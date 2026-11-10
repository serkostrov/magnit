"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

type ImportRun = { id: string; source_name: string; mode: string; status: string; stats?: Record<string, unknown>; errors?: Array<Record<string, unknown>>; started_at?: string; finished_at?: string | null };
function date(value?: string | null) { return value ? new Date(value).toLocaleString("ru-RU") : "—"; }
function display(value: unknown) { return typeof value === "object" ? JSON.stringify(value) || "—" : String(value ?? "—"); }

export default function AdminImportDetailPage() {
  const params = useParams<{ id: string }>(); const router = useRouter(); const [run, setRun] = useState<ImportRun | null>(null); const [error, setError] = useState("");
  useEffect(() => { const timer = window.setTimeout(() => { fetch(`/api/admin/imports/${params.id}`).then(async (response) => { if (response.status === 401) { router.replace("/admin/login"); return; } const payload = await response.json(); if (!response.ok) throw new Error(payload.error || "Не удалось загрузить запуск"); setRun(payload.item); }).catch((err) => setError(err instanceof Error ? err.message : "Не удалось загрузить запуск")); }, 0); return () => window.clearTimeout(timer); }, [params.id, router]);
  if (!run && !error) return <section className="admin-page"><p>Загружаем запуск…</p></section>;
  if (!run) return <section className="admin-page"><p className="form-error">{error}</p><Link href="/admin/imports">← К журналу</Link></section>;
  const stats = run.stats || {}; const errors = run.errors || [];
  return <section className="admin-page"><div className="admin-page-head"><div><span className="eyebrow">Импорт</span><h1>Детали запуска</h1><p>{run.source_name}</p></div><Link className="button button-secondary" href="/admin/imports">← К журналу</Link></div><div className="admin-run-meta"><span className={`admin-status ${run.mode === "dry-run" ? "status-dry-run" : "status-apply"}`}>{run.mode}</span><span className={`admin-status status-${run.status}`}>{run.status}</span><span>Начат: {date(run.started_at)}</span><span>Завершён: {date(run.finished_at)}</span></div><h2 className="admin-subheading">Статистика и исходные идентификаторы</h2><div className="admin-stats-grid">{Object.entries(stats).map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{Array.isArray(value) ? `${value.length} записей` : display(value)}</dd></div>)}</div><h2 className="admin-subheading">Ошибки и конфликты <small>({errors.length})</small></h2>{errors.length ? <div className="admin-error-list">{errors.map((item, index) => <article key={`${String(item.externalId || "error")}-${index}`}><strong>{String(item.externalId || "Без external ID")}{item.rowNumber ? ` · строка ${String(item.rowNumber)}` : ""}</strong><p>{String(item.message || "Ошибка без сообщения")}</p>{item.image != null && <small>{String(item.image)}</small>}</article>)}</div> : <p className="admin-empty">Ошибок в запуске нет.</p>}</section>;
}
