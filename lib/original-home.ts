import { readFile } from "node:fs/promises";
import path from "node:path";

export type OriginalHomeMarkup = {
  css: string;
  html: string;
};

export async function loadOriginalHome(): Promise<OriginalHomeMarkup> {
  const [source, corrections] = await Promise.all([
    readFile(
      path.join(process.cwd(), "reference", "original-home.html"),
      "utf8",
    ),
    readFile(
      path.join(process.cwd(), "reference", "original-home-corrections.css"),
      "utf8",
    ),
  ]);
  const css = source.match(/<style>([\s\S]*?)<\/style>/)?.[1];
  const body = source.match(/<body>([\s\S]*?)<\/body>/)?.[1];

  if (!css || !body) {
    throw new Error("Не удалось прочитать исходный макет главной страницы.");
  }

  const homeStart = body.indexOf("<!-- HERO -->");
  const homeEnd = body.indexOf("<!-- FOOTER -->");
  if (homeStart === -1 || homeEnd === -1) {
    throw new Error("Не удалось выделить содержимое исходной главной страницы.");
  }

  const html = body
    .slice(homeStart, homeEnd)
    .replace(/<script>[\s\S]*?<\/script>/g, "")
    .replace(/\sonclick="[^"]*"/g, "")
    .replaceAll('src="img/', 'src="/assets/')
    .replaceAll("url(img/", "url(/assets/")
    .replaceAll('href="otrasli.html"', 'href="/otrasli"')
    .replace(
      '<a href="#" class="btn btn-ghost">Открыть весь каталог →</a>',
      '<a href="/catalog" class="btn btn-ghost">Открыть весь каталог →</a>',
    );

  return { css: `${css}\n${corrections}`, html };
}
