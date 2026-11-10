"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { addToCart } from "../lib/cart";
import { enhanceProductImageElement } from "./CatalogProductImage";

const bestsellerSlugs = [
  "neodimovyy-magnit-disk-10x2-mm",
  "neodimovyy-magnit-disk-8x2-mm",
  "neodimovyy-magnit-disk-20x3-mm",
  "neodimovyy-magnit-pryamougolnyy-15x8x2-mm",
  "neodimovyy-magnit-pryamougolnyy-20x10x5-mm",
  "neodimovyy-magnit-s-zenkovkoy-20x5-mm",
  "magnitnoe-kreplenie-a25",
  "neodimovyy-magnit-pryamougolnyy-80x60x20-mm",
];

const categoryLinks: Record<string, string> = {
  "Диски и цилиндры": "/catalog/category/diski",
  Прямоугольные: "/catalog/category/pryamougolnye",
  "Кольца и шайбы": "/catalog/category/kolca",
  "Магниты с зенковкой": "/catalog/category/zenkovka",
  "Все серии креплений": "/catalog/category/krepleniya",
  "Магнитные захваты": "/catalog/category/krepleniya",
  "Держатели и фурнитура": "/catalog/category/krepleniya",
  "Под заказ": "/#lead",
  "Магнитный винил": "/catalog?search=магнитный+винил",
  "Поисковые магниты": "/catalog/category/poiskovye",
  "Шары и сегменты": "/catalog?search=шары+сегменты",
  "Упаковка и POS": "/catalog?search=упаковка",
  "Застёжки и магнитные кнопки": "/catalog?search=застёжки",
  Новинки: "/catalog?sort=new",
};

export function OriginalHomeInteractions() {
  const pathname = usePathname();

  useEffect(() => {
    const root = document.querySelector<HTMLElement>(".original-home");
    if (!root) return;

    const controller = new AbortController();
    const { signal } = controller;
    const timers: number[] = [];
    const productImageCleanups = Array.from(
      root.querySelectorAll<HTMLImageElement>(".pr .pic img[data-product-image-source]"),
    ).map(enhanceProductImageElement);
    const leadForm = root.querySelector<HTMLElement>("#lead");
    const scrollToLead = (behavior: ScrollBehavior) => {
      if (!leadForm) return;
      leadForm.classList.add("in");
      const headerHeight =
        document
          .querySelector<HTMLElement>(".site-header")
          ?.getBoundingClientRect().height ?? 0;
      const top = Math.max(
        0,
        window.scrollY +
          leadForm.getBoundingClientRect().top -
          headerHeight -
          24,
      );
      window.scrollTo({ top, behavior });
    };

    root.querySelectorAll<HTMLAnchorElement>('a[href="#lead"]').forEach((link) => {
      link.addEventListener(
        "click",
        (event) => {
          event.preventDefault();
          if (window.location.hash === "#lead") {
            window.history.replaceState(null, "", "#lead");
          } else {
            window.history.pushState(null, "", "#lead");
          }
          const behavior = window.matchMedia("(prefers-reduced-motion: reduce)")
            .matches
            ? "auto"
            : "smooth";
          scrollToLead(behavior);
        },
        { signal },
      );
    });

    if (window.location.hash === "#lead") {
      timers.push(window.setTimeout(() => scrollToLead("auto"), 0));
    }

    const revealElements = root.querySelectorAll<HTMLElement>(".reveal");
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
    revealElements.forEach((element) => {
      const bounds = element.getBoundingClientRect();
      const isVisible = bounds.top < window.innerHeight && bounds.bottom > 0;
      if (isVisible) {
        element.classList.add("in");
      } else {
        observer.observe(element);
      }
    });

    const categories = root.querySelector<HTMLElement>("#cats");
    const categoriesButton =
      root.querySelector<HTMLButtonElement>("#catsMoreBtn");
    categoriesButton?.addEventListener(
      "click",
      () => {
        categories?.classList.toggle("expanded");
        categoriesButton.textContent = categories?.classList.contains(
          "expanded",
        )
          ? "Свернуть"
          : "Смотреть все виды магнитов →";
      },
      { signal },
    );

    const stage = root.querySelector<HTMLElement>("#stage");
    const glow = root.querySelector<HTMLElement>("#glow");
    const magnets = Array.from(
      root.querySelectorAll<HTMLElement>(".mstage .mag"),
    );

    stage?.addEventListener(
      "mousemove",
      (event) => {
        const bounds = stage.getBoundingClientRect();
        const mouseX = event.clientX - bounds.left;
        const mouseY = event.clientY - bounds.top;
        if (glow) {
          glow.style.left = `${mouseX}px`;
          glow.style.top = `${mouseY}px`;
        }

        magnets.forEach((magnet) => {
          const centerX = magnet.offsetLeft + magnet.offsetWidth / 2;
          const centerY = magnet.offsetTop + magnet.offsetHeight / 2;
          const deltaX = mouseX - centerX;
          const deltaY = mouseY - centerY;
          const distance = Math.hypot(deltaX, deltaY) || 1;
          const pull = Math.min(40, 3000 / distance);
          magnet.style.transform = `translate(${(deltaX / distance) * pull}px, ${(deltaY / distance) * pull}px)`;
        });
      },
      { signal },
    );

    stage?.addEventListener(
      "mouseleave",
      () => {
        magnets.forEach((magnet) => {
          magnet.style.transform = "translate(0, 0)";
        });
        if (glow) {
          glow.style.left = "50%";
          glow.style.top = "50%";
        }
      },
      { signal },
    );

    root.querySelectorAll<HTMLElement>(".cat").forEach((card) => {
      const title = card.querySelector("h4")?.textContent?.trim();
      const href = card.dataset.href || (title ? categoryLinks[title] : undefined);
      if (!href) return;

      card.dataset.href = href;
      card.tabIndex = 0;
      card.setAttribute("role", "link");
      const navigate = () => window.location.assign(href);
      card.addEventListener("click", navigate, { signal });
      card.addEventListener(
        "keydown",
        (event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            navigate();
          }
        },
        { signal },
      );
    });

    root.querySelectorAll<HTMLButtonElement>(".pr .add").forEach((button, index) => {
      const slug = button.closest<HTMLElement>(".pr")?.dataset.slug || bestsellerSlugs[index];
      if (!slug) return;
      button.textContent = "В корзину";
      button.addEventListener(
        "click",
        () => {
          addToCart(slug);
          button.textContent = "Добавлено";
          button.classList.add("is-added");
          timers.push(
            window.setTimeout(() => {
              button.textContent = "В корзину";
              button.classList.remove("is-added");
            }, 1600),
          );
        },
        { signal },
      );
    });

    root.querySelectorAll<HTMLFormElement>(".mini-lead, .opt-card").forEach((form) => {
      form.addEventListener(
        "submit",
        async (event) => {
          event.preventDefault();
          if (!form.reportValidity()) return;
          const submit = form.querySelector<HTMLButtonElement>(
            'button[type="submit"]',
          );
          const status = form.querySelector<HTMLElement>(".form-status");
          const data = new FormData(form);
          const isWholesale = form.classList.contains("opt-card");
          const body = {
            kind: isWholesale ? "wholesale" : "contact",
            source: isWholesale ? "home-wholesale" : "home-mini-lead",
            name: data.get("name"),
            contact: data.get("contact"),
            request: data.get("request"),
            newsletter: data.get("newsletter") === "on",
            consent: data.get("privacy") === "on",
          };
          if (submit) submit.disabled = true;
          if (status) {
            status.setAttribute("role", "status");
            status.setAttribute("aria-live", "polite");
            status.textContent = "Сохраняем заявку…";
          }
          try {
            const response = await fetch("/api/forms/lead", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify(body),
            });
            const result = (await response.json().catch(() => ({}))) as { error?: string };
            if (!response.ok) throw new Error(result.error || "Не удалось сохранить заявку");
            form.classList.add("is-sent");
            if (submit) submit.textContent = "Заявка сохранена ✓";
            if (status) status.textContent = "Заявка сохранена. Менеджер получил ваши данные.";
          } catch (error) {
            if (submit) submit.disabled = false;
            if (status) status.textContent = error instanceof Error ? error.message : "Попробуйте ещё раз";
          }
        },
        { signal },
      );
    });

    return () => {
      controller.abort();
      observer.disconnect();
      productImageCleanups.forEach((cleanup) => cleanup());
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [pathname]);

  return null;
}
