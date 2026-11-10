"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Footer } from "./Footer";
import { Header } from "./Header";

type HeaderCategory = { slug: string; title: string };

export function SiteChromeFrame({
  categories,
  children,
}: {
  categories: HeaderCategory[];
  children: ReactNode;
}) {
  const pathname = usePathname();

  if (pathname.startsWith("/admin")) return <>{children}</>;

  return (
    <>
      <Header categories={categories} />
      {children}
      <Footer />
    </>
  );
}
