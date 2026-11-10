"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { industryOptions } from "../lib/catalog/filter-definitions";

type IndustryProduct = { slug: string; name: string; sku: string; description: string; image: string };

export function OriginalIndustriesInteractions({ productsByIndustry }: { productsByIndustry: Record<string, IndustryProduct[]> }) {
  const pathname = usePathname();

  useEffect(() => {
    const root = document.querySelector<HTMLElement>(".original-industries");
    if (!root) return;

    const controller = new AbortController();
    const tabs = Array.from(
      root.querySelectorAll<HTMLButtonElement>(".ind-tab"),
    );
    const panels = Array.from(
      root.querySelectorAll<HTMLElement>(".ind-panel"),
    );
    const tabList = root.querySelector<HTMLElement>(".ind-tabs");

    panels.forEach((panel, index) => {
      const industry = industryOptions[index];
      const list = panel.querySelector<HTMLElement>(".iprods");
      if (!industry || !list) return;
      const products = productsByIndustry[industry.slug] || [];
      list.replaceChildren();
      if (!products.length) {
        const empty = document.createElement("a");
        empty.className = "ip industry-products-empty";
        empty.href = `/catalog?industry=${encodeURIComponent(industry.slug)}`;
        empty.innerHTML = `<div><div class="tag">Каталог</div><h6>Товары для отрасли ещё не назначены</h6><div class="ds">Назначьте отрасль товарам в админке</div></div><div class="ar">→</div>`;
        list.append(empty);
        return;
      }
      for (const product of products) {
        const card = document.createElement("a");
        card.className = "ip";
        card.href = `/catalog/${encodeURIComponent(product.slug)}`;
        const thumbnail = document.createElement("div");
        thumbnail.className = "th industry-product-thumbnail";
        const image = document.createElement("img");
        image.src = product.image;
        image.alt = product.name;
        thumbnail.append(image);
        const copy = document.createElement("div");
        const tag = document.createElement("div");
        tag.className = "tag";
        tag.textContent = product.sku || "Товар";
        const title = document.createElement("h6");
        title.textContent = product.name;
        const description = document.createElement("div");
        description.className = "ds";
        description.textContent = product.description;
        copy.append(tag, title, description);
        const arrow = document.createElement("div");
        arrow.className = "ar";
        arrow.textContent = "→";
        card.append(thumbnail, copy, arrow);
        list.append(card);
      }
    });

    tabList?.setAttribute("role", "tablist");
    tabList?.setAttribute("aria-label", "Отрасли");

    const selectTab = (selectedIndex: number) => {
      tabs.forEach((tab, index) => {
        const isSelected = index === selectedIndex;
        tab.classList.toggle("active", isSelected);
        tab.setAttribute("aria-selected", String(isSelected));
        tab.tabIndex = isSelected ? 0 : -1;
      });
      panels.forEach((panel, index) => {
        const isSelected = index === selectedIndex;
        panel.classList.toggle("active", isSelected);
        panel.hidden = !isSelected;
      });
    };

    tabs.forEach((tab, index) => {
      const panel = panels[index];
      const tabId = `industry-tab-${index + 1}`;
      const panelId = `industry-panel-${index + 1}`;
      tab.id = tabId;
      tab.setAttribute("role", "tab");
      tab.setAttribute("aria-controls", panelId);
      if (panel) {
        panel.id = panelId;
        panel.setAttribute("role", "tabpanel");
        panel.setAttribute("aria-labelledby", tabId);
      }

      tab.addEventListener("click", () => selectTab(index), {
        signal: controller.signal,
      });
      tab.addEventListener(
        "keydown",
        (event) => {
          if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
          event.preventDefault();
          const direction = event.key === "ArrowRight" ? 1 : -1;
          const nextIndex = (index + direction + tabs.length) % tabs.length;
          selectTab(nextIndex);
          tabs[nextIndex]?.focus();
        },
        { signal: controller.signal },
      );
    });
    selectTab(0);

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("in");
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.1 },
    );
    root.querySelectorAll<HTMLElement>(".reveal").forEach((element) => {
      const bounds = element.getBoundingClientRect();
      const isVisible = bounds.top < window.innerHeight && bounds.bottom > 0;
      if (isVisible) {
        element.classList.add("in");
      } else {
        observer.observe(element);
      }
    });

    return () => {
      controller.abort();
      observer.disconnect();
    };
  }, [pathname, productsByIndustry]);

  return null;
}
