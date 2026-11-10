import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:net";
import { readFile } from "node:fs/promises";
import test, { after, before } from "node:test";

let baseUrl;
let serverProcess;
let serverOutput = "";

async function getFreePort() {
  const server = createServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert(address && typeof address === "object");
  const port = address.port;
  server.close();
  await once(server, "close");
  return port;
}

before(async () => {
  const port = await getFreePort();
  baseUrl = `http://127.0.0.1:${port}`;
  serverProcess = spawn(process.execPath, [".next/standalone/server.js"], {
    cwd: new URL("..", import.meta.url),
    env: {
      ...process.env,
      HOSTNAME: "127.0.0.1",
      PORT: String(port),
      NODE_ENV: "production",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  serverProcess.stdout.on("data", (chunk) => {
    serverOutput += chunk.toString();
  });
  serverProcess.stderr.on("data", (chunk) => {
    serverOutput += chunk.toString();
  });

  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (serverProcess.exitCode !== null) {
      throw new Error(`Next.js завершился до старта:\n${serverOutput}`);
    }

    try {
      const response = await fetch(`${baseUrl}/api/health`);
      if (response.ok) return;
    } catch {
      // Сервер ещё запускается.
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error(`Next.js не запустился:\n${serverOutput}`);
});

after(async () => {
  if (!serverProcess || serverProcess.exitCode !== null) return;
  serverProcess.kill("SIGTERM");
  await Promise.race([
    once(serverProcess, "exit"),
    new Promise((resolve) => setTimeout(resolve, 3000)),
  ]);
});

async function request(pathname) {
  return fetch(`${baseUrl}${pathname}`, {
    headers: { accept: "text/html" },
  });
}

test("healthcheck describes the prepared VM runtime", async () => {
  const response = await fetch(`${baseUrl}/api/health`);
  assert.equal(response.status, 200);
  const health = await response.json();
  assert.equal(health.ok, true);
  assert.equal(health.service, "site-magnit");
  assert.equal(health.database.prepared, true);
  assert.equal(health.moysklad.prepared, true);
  assert.equal(health.notifications.email.prepared, true);
  assert.equal(health.notifications.email.transport, "smtp");
  assert.equal(typeof health.notifications.email.configured, "boolean");
  assert.ok(Array.isArray(health.notifications.email.issues));
});

test("renders the finished home page with production metadata", async () => {
  const response = await request("/");
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(
    html,
    /<title>Неодимовые магниты оптом с доставкой по России — saitmagnitov\.ru<\/title>/,
  );
  assert.match(html, /Неодимовые магниты по/);
  assert.match(html, /class="mstage"/);
  assert.match(html, /class="home-marketplaces"/);
  assert.match(
    html,
    /class="product-cutout-image catalog-product-image is-(?:processing|ready)"[^>]+data-product-image-source=/,
  );
  assert.match(html, /Название, размер или артикул/);
  assert.match(html, /data-href="\/catalog\/category\//);
  assert.match(html, /Наш ассортимент закроет 99% потребностей/);
  assert.doesNotMatch(html, /Доступен к заказу/);
  assert.doesNotMatch(html, /В наличии/);
  assert.match(html, /id="home-quiz-root"/);
  assert.match(html, /class="adv-grid">/);
  assert.match(html, /Опыт работы/);
  assert.doesNotMatch(html, /class="adv-grid reveal"/);
  assert.doesNotMatch(html, /Подробнее о компании/);
  assert.match(html, /Любая форма и размер под заказ\. Работаем с 2013 года\./);
  assert.doesNotMatch(html, /6000 артикулов в каталоге, под заказ/);
  assert.doesNotMatch(html, /Розница от 1 ₽ — без минималки/);
  assert.doesNotMatch(html, /4 простых вопроса — без регистрации/);
  assert.doesNotMatch(html, /Начать подбор/);
  assert.match(html, /Wildberries/);
  assert.match(html, /Ozon/);
  assert.match(html, /https:\/\/saitmagnitov\.ru\/og\.png/);
  assert.match(html, /application\/ld\+json/);
  assert.match(
    html,
    /https:\/\/mc\.yandex\.ru\/metrika\/tag\.js\?id=34581830/,
  );
  assert.match(html, /ym\(34581830,"init"/);
  assert.match(html, /https:\/\/mc\.yandex\.ru\/watch\/34581830/);
  assert.doesNotMatch(html, /<span class="n">N52<\/span>/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape/);
});

test("renders a dedicated noindex favorites page", async () => {
  const response = await request("/favorites");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /<meta name="robots" content="noindex, follow"\/>/);
  assert.match(html, /<h1>Избранное<\/h1>/);
  assert.match(html, /Сохранённые товары/);
});

test("renders published reviews and protects the order review form with a token", async () => {
  const reviewsResponse = await request("/reviews");
  assert.equal(reviewsResponse.status, 200);
  const reviewsHtml = await reviewsResponse.text();
  assert.match(reviewsHtml, /<h1>Отзывы покупателей<\/h1>/);
  assert.match(reviewsHtml, /Отзывы в Яндексе/);
  assert.match(reviewsHtml, /reviews\.yandex\.ru\/shop\/saitmagnitov\.ru/);

  const invalidResponse = await request("/reviews/new?token=invalid");
  assert.equal(invalidResponse.status, 200);
  const invalidHtml = await invalidResponse.text();
  assert.match(invalidHtml, /<meta name="robots" content="noindex, nofollow"\/>/);
  assert.match(invalidHtml, /Ссылка недействительна/);
  assert.doesNotMatch(invalidHtml, /name="authorName"/);
});

test("renders catalog and a crawlable product page", async () => {
  const catalogResponse = await request("/catalog");
  assert.equal(catalogResponse.status, 200);
  const catalogHtml = await catalogResponse.text();
  assert.match(catalogHtml, /Каталог неодимовых магнитов/);
  assert.match(catalogHtml, /Фильтры/);
  assert.match(catalogHtml, /Сначала популярные/);
  assert.match(catalogHtml, /Избранное/);
  assert.doesNotMatch(catalogHtml, /aria-label="Популярные категории"/);
  assert.doesNotMatch(catalogHtml, /Только избранные/);

  const searchResponse = await request("/catalog?search=%D0%94029");
  assert.equal(searchResponse.status, 200);
  const searchHtml = await searchResponse.text();
  assert.match(searchHtml, /Диск 10×2 мм/);
  assert.equal((searchHtml.match(/class="catalog-search-top"/g) || []).length, 1);
  assert.doesNotMatch(searchHtml, /class="catalog-filters"[\s\S]*catalog-search-top/);

  const combinedFilterResponse = await request("/catalog?category=diski&priceFrom=10&priceTo=20");
  assert.equal(combinedFilterResponse.status, 200);
  const combinedFilterHtml = await combinedFilterResponse.text();
  assert.match(combinedFilterHtml, /Найдено: <b>1<\/b>/);
  assert.match(combinedFilterHtml, /Диск 20×3 мм/);
  assert.doesNotMatch(combinedFilterHtml, /Диск 10×2 мм/);

  const categoryResponse = await request("/catalog/category/diski");
  assert.equal(categoryResponse.status, 200);
  const categoryHtml = await categoryResponse.text();
  assert.match(categoryHtml, /<h1>Диски и цилиндры<\/h1>/);
  assert.match(categoryHtml, /Главная/);
  assert.match(categoryHtml, /Каталог/);

  const invalidPageResponse = await fetch(`${baseUrl}/catalog?page=abc`, { redirect: "manual" });
  assert.equal(invalidPageResponse.status, 307);
  assert.equal(invalidPageResponse.headers.get("location"), "/catalog");

  const outOfRangePageResponse = await fetch(`${baseUrl}/catalog?page=999`, { redirect: "manual" });
  assert.equal(outOfRangePageResponse.status, 307);
  assert.equal(outOfRangePageResponse.headers.get("location"), "/catalog");

  const productResponse = await request(
    "/catalog/neodimovyy-magnit-disk-10x2-mm",
  );
  assert.equal(productResponse.status, 200);
  const productHtml = await productResponse.text();
  assert.match(productHtml, /Неодимовый магнит диск 10×2 мм/);
  assert.doesNotMatch(productHtml, /Доступен к заказу/);
  assert.doesNotMatch(productHtml, /schema\.org\/InStock/);
  assert.match(
    productHtml,
    /https:\/\/saitmagnitov\.ru\/catalog\/neodimovyy-magnit-disk-10x2-mm/,
  );
  assert.match(
    productHtml,
    /<title>Неодимовый магнит диск 10×2 мм — купить по цене 9 ₽ \| Сайт Магнитов<\/title>/,
  );
  assert.match(
    productHtml,
    /<meta name="description" content="Купить неодимовый магнит диск 10×2 мм N38\./,
  );
  assert.match(
    productHtml,
    /<link rel="canonical" href="https:\/\/saitmagnitov\.ru\/catalog\/neodimovyy-magnit-disk-10x2-mm"\/>/,
  );
  assert.match(productHtml, /"@type":"Product"/);
  assert.match(productHtml, /"priceCurrency":"RUB"/);
  assert.match(
    productHtml,
    /class="product-cutout-image catalog-product-image is-(?:processing|ready)"/,
  );

  const structuredData = [...productHtml.matchAll(
    /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g,
  )].map(([, payload]) => JSON.parse(payload));
  const productStructuredData = structuredData.find(
    (entry) => entry["@type"] === "Product",
  );
  const breadcrumbStructuredData = structuredData.find(
    (entry) => entry["@type"] === "BreadcrumbList",
  );
  assert(productStructuredData);
  assert.equal(productStructuredData.sku, "Д029");
  assert.equal(productStructuredData.offers.price, 9);
  assert.equal(
    productStructuredData.offers.url,
    "https://saitmagnitov.ru/catalog/neodimovyy-magnit-disk-10x2-mm",
  );
  assert(breadcrumbStructuredData);
  assert.deepEqual(
    breadcrumbStructuredData.itemListElement.map((item) => item.item),
    [
      "https://saitmagnitov.ru/",
      "https://saitmagnitov.ru/catalog",
      "https://saitmagnitov.ru/catalog/category/diski",
      "https://saitmagnitov.ru/catalog/neodimovyy-magnit-disk-10x2-mm",
    ],
  );

  const unpublishedResponse = await request("/catalog/not-published-product");
  assert.equal(unpublishedResponse.status, 404);
  const unpublishedHtml = await unpublishedResponse.text();
  assert.match(unpublishedHtml, /robots[^>]+noindex/i);
});

test("renders the original industries page as a crawlable route", async () => {
  const response = await request("/otrasli");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(
    html,
    /Магниты по отраслям: мебель, упаковка, реклама, сварка, промышленность/,
  );
  assert.match(html, /Что покупают в вашей отрасли/);
  assert.match(html, /Мебельная фурнитура/);
  assert.match(html, /Промышленность и оснастка/);
  assert.match(html, /rel="canonical" href="https:\/\/saitmagnitov\.ru\/otrasli"/);
});

test("publishes all demo product URLs in sitemap", async () => {
  const response = await request("/sitemap.xml");
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /xml/i);
  const xml = await response.text();
  assert.match(xml, /<loc>https:\/\/saitmagnitov\.ru\/otrasli<\/loc>/);
  assert.match(xml, /<loc>https:\/\/saitmagnitov\.ru\/opt<\/loc>/);
  assert.match(xml, /<loc>https:\/\/saitmagnitov\.ru\/delivery<\/loc>/);
  assert.match(xml, /<loc>https:\/\/saitmagnitov\.ru\/reviews<\/loc>/);
  assert.match(xml, /<loc>https:\/\/saitmagnitov\.ru\/catalog\/category\/diski<\/loc>/);
  const productUrls =
    xml.match(/<loc>https:\/\/saitmagnitov\.ru\/catalog\/(?!category\/)[^<]+<\/loc>/g) ?? [];
  assert.equal(productUrls.length, 12);
  assert.match(xml, /<lastmod>2026-08-05T00:00:00\.000Z<\/lastmod>/);
});

test("keeps checkout out of search results", async () => {
  const response = await request("/cart");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /<meta name="robots" content="noindex, follow"\/>/);
  assert.match(html, /<h1>Корзина<\/h1>/);

  const cartComponent = await readFile(
    new URL("../components/CartClient.tsx", import.meta.url),
    "utf8",
  );
  assert.match(cartComponent, /ИНН \*/);
  assert.match(cartComponent, /Тип покупателя \*/);
  assert.match(cartComponent, /useState<"legal" \| "individual">\("legal"\)/);
  assert.match(cartComponent, /value="legal"/);
  assert.match(cartComponent, /value="individual"/);
  assert.match(cartComponent, /buyerType === "legal"/);
  assert.match(cartComponent, /Компания \*/);
  assert.match(cartComponent, /E-mail \*/);
  assert.match(cartComponent, /name="email"[^>]+required/);
  assert.match(cartComponent, /Онлайн-оплата на этом этапе не требуется/);
  assert.doesNotMatch(cartComponent, /href="\/consent"/);
  assert.match(cartComponent, /formatRussianPhone/);
  assert.match(cartComponent, /maxLength=\{18\}/);
  assert.match(cartComponent, /Заказ отправлен/);
  assert.doesNotMatch(
    cartComponent,
    /Черновик заказа сформирован|демонстрационном режиме|На следующем этапе/,
  );
});

test("uses only the privacy policy link in public form consent text", async () => {
  const [quizComponent, footerComponent, homeTemplate] = await Promise.all([
    readFile(new URL("../components/HomeQuiz.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/Footer.tsx", import.meta.url), "utf8"),
    readFile(new URL("../reference/original-home.html", import.meta.url), "utf8"),
  ]);

  assert.doesNotMatch(quizComponent, /href="\/consent"/);
  assert.doesNotMatch(footerComponent, /href="\/consent"/);
  assert.doesNotMatch(homeTemplate, /href="\/consent"/);
  assert.match(quizComponent, /href="\/privacy"/);
  assert.match(homeTemplate, /href="\/privacy"/);
});

test("publishes the complete source privacy policy", async () => {
  const response = await request("/privacy");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /ИП Костров Сергей Александрович/);
  assert.match(html, /2\.14\. Уничтожение персональных данных/);
  assert.match(html, /8\.9\. Условием прекращения обработки персональных данных/);
  assert.match(html, /12\.3\. Актуальная версия Политики/);
  assert.match(html, /https:\/\/saitmagnitov\.ru\/privacy/);
  assert.match(html, /info@smagn\.ru/);
  assert.doesNotMatch(html, /rus-magnit\.ru/);
  assert.doesNotMatch(html, /info@rus-magnit\.ru/);
  assert.doesNotMatch(html, /Дата публикации: 14 августа 2026 года/);
});

test("stores cart lines for imported products without an SKU", async () => {
  const orderService = await readFile(
    new URL("../lib/orders/service.ts", import.meta.url),
    "utf8",
  );

  assert.match(orderService, /COALESCE\(sku, ''\) AS sku/);
});
