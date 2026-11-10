"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const navigation = [
  {
    label: "Каталог",
    items: [
      { href: "/admin/products", label: "Товары" },
      { href: "/admin/categories", label: "Категории" },
      { href: "/admin/characteristics", label: "Характеристики" },
      { href: "/admin/collections", label: "Подборки" },
    ],
  },
  {
    label: "Клиенты",
    items: [
      { href: "/admin/orders", label: "Заказы" },
      { href: "/admin/leads", label: "Заявки с форм" },
      { href: "/admin/reviews", label: "Отзывы" },
    ],
  },
  {
    label: "Система",
    items: [
      { href: "/admin/notifications", label: "Уведомления" },
      { href: "/admin/imports", label: "Импорты" },
      { href: "/admin/audit", label: "История действий" },
    ],
  },
];

function csrfToken() {
  return document.cookie.split(";").map((part) => part.trim()).find((part) => part.startsWith("site_magnit_csrf="))?.split("=").slice(1).join("=") || "";
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [login, setLogin] = useState("");

  useEffect(() => {
    if (pathname === "/admin/login") return;
    fetch("/api/admin/me").then((response) => {
      if (!response.ok) router.replace("/admin/login");
      else response.json().then((payload) => setLogin(payload.user?.login || ""));
    }).catch(() => router.replace("/admin/login"));
  }, [pathname, router]);

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST", headers: { "x-csrf-token": csrfToken() } });
    router.replace("/admin/login");
  }

  if (pathname === "/admin/login") return <>{children}</>;
  return (
    <div className="admin-layout">
      <aside className="admin-sidebar">
        <div className="admin-sidebar-head">
          <Link className="admin-brand" href="/admin">Сайт Магнитов <small>admin</small></Link>
          <button className="admin-mobile-logout" type="button" onClick={logout}>Выйти</button>
        </div>
        <nav aria-label="Админ-навигация">
          {navigation.map((group) => (
            <div className="admin-nav-group" key={group.label}>
              <span className="admin-nav-label">{group.label}</span>
              {group.items.map((item) => {
                const active = pathname.startsWith(item.href);
                return (
                  <Link
                    className={active ? "is-active" : ""}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    key={item.href}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          ))}
          <Link className="admin-open-site-mobile" href="/" target="_blank">Сайт ↗</Link>
        </nav>
        <div className="admin-sidebar-footer">
          <Link className="admin-open-site" href="/" target="_blank">Открыть сайт ↗</Link>
          <div className="admin-user"><span>{login || "Администратор"}</span><button type="button" onClick={logout}>Выйти</button></div>
        </div>
      </aside>
      <main className="admin-content">{children}</main>
    </div>
  );
}
