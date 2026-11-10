import Link from "next/link";

export type BreadcrumbItem = {
  label: string;
  href?: string;
};

export function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav className="breadcrumbs" aria-label="Хлебные крошки">
      {items.map((item, index) => (
        <span className="breadcrumb-item" key={`${item.href ?? "current"}-${item.label}`}>
          {index > 0 && <span className="breadcrumb-separator" aria-hidden="true">/</span>}
          {item.href ? (
            <Link href={item.href}>{item.label}</Link>
          ) : (
            <span className="breadcrumb-current" aria-current="page">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
