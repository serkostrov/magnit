"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Order = { id: string; status: string; first_name: string; company: string; phone: string; total_amount: number | string; item_count: number; created_at: string };
const statusNames: Record<string, string> = { new: "Новый", in_progress: "В работе", confirmed: "Подтверждён", paid: "Оплачен", completed: "Завершён", cancelled: "Отменён" };

export default function AdminOrdersPage() {
  const router = useRouter(); const [items,setItems]=useState<Order[]>([]); const [status,setStatus]=useState(""); const [error,setError]=useState("");
  async function load(){const query=status?`?status=${encodeURIComponent(status)}`:"";const response=await fetch(`/api/admin/orders${query}`);if(response.status===401){router.replace("/admin/login");return;}const payload=await response.json();setItems(payload.items||[]);setError(payload.error||"");}
  useEffect(()=>{const timer=window.setTimeout(()=>{void load();},0);return()=>window.clearTimeout(timer); // eslint-disable-next-line react-hooks/exhaustive-deps
  },[status,router]);
  return <section className="admin-page"><div className="admin-page-head"><div><span className="eyebrow">Клиенты</span><h1>Заказы</h1><p>Заказы из корзины с составом, суммой и рабочим статусом.</p></div></div><div className="admin-toolbar admin-toolbar--compact"><select aria-label="Фильтр заказов по статусу" value={status} onChange={(event)=>setStatus(event.target.value)}><option value="">Все статусы</option>{Object.entries(statusNames).map(([value,label])=><option value={value} key={value}>{label}</option>)}</select></div>{error&&<p className="form-error">{error}</p>}<div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Номер и дата</th><th>Клиент</th><th>Контакты</th><th>Сумма</th><th>Статус</th><th /></tr></thead><tbody>{items.map((order)=><tr key={order.id}><td><strong>#{order.id.slice(0,8)}</strong><small>{new Date(order.created_at).toLocaleString("ru-RU")}</small></td><td>{order.first_name}<small>{order.company||"Частный заказ"}</small></td><td>{order.phone}</td><td>{Number(order.total_amount).toLocaleString("ru-RU")} ₽<small>{order.item_count} поз.</small></td><td><span className={`admin-status status-${order.status}`}>{statusNames[order.status]||order.status}</span></td><td><Link href={`/admin/orders/${order.id}`}>Открыть →</Link></td></tr>)}</tbody></table>{items.length===0&&<p className="admin-empty">Заказов пока нет.</p>}</div></section>;
}
