"use client";

import Link from "next/link";
import { useState } from "react";
import type { CatalogCategory } from "../lib/catalog/types";

export function CategoryGrid({
  categories,
}: {
  categories: CatalogCategory[];
}) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded
    ? categories
    : categories.filter((category) => category.featured);

  return (
    <>
      <div className="category-grid">
        {visible.map((category, index) => {
          const query =
            category.slug === "novinki"
              ? "sort=new"
              : category.slug === "pod-zakaz" ||
                  category.slug === "upakovka" ||
                  category.slug === "derzhateli"
                ? ""
                : `category=${category.slug}`;
          return (
            <Link
              className={`category-card category-tone-${(index % 6) + 1}`}
              href={query ? `/catalog?${query}` : "/catalog"}
              key={category.slug}
            >
              <div className="category-image">
                <img src={category.image} alt="" />
                {category.badge && (
                  <span className="category-badge">{category.badge}</span>
                )}
              </div>
              <div>
                <h3>{category.title}</h3>
                <p>{category.description}</p>
                <span>Смотреть товары →</span>
              </div>
            </Link>
          );
        })}
      </div>
      <div className="centered-action">
        <button
          className="button button-secondary"
          type="button"
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? "Свернуть категории" : "Смотреть все виды магнитов"}
        </button>
      </div>
    </>
  );
}
