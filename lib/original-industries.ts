import { readFile } from "node:fs/promises";
import path from "node:path";

export type OriginalIndustriesMarkup = {
  css: string;
  html: string;
};

export async function loadOriginalIndustries(): Promise<OriginalIndustriesMarkup> {
  const source = await readFile(
    path.join(process.cwd(), "reference", "original-industries.html"),
    "utf8",
  );
  const css = source.match(/<style>([\s\S]*?)<\/style>/)?.[1];
  const body = source.match(/<body>([\s\S]*?)<\/body>/)?.[1];

  if (!css || !body) {
    throw new Error("Не удалось прочитать исходный макет страницы по отраслям.");
  }

  const pageStart = body.indexOf('<div class="ind-block section"');
  const pageEnd = body.indexOf("<!-- FOOTER -->");
  if (pageStart === -1 || pageEnd === -1) {
    throw new Error("Не удалось выделить содержимое страницы по отраслям.");
  }

  const html = body
    .slice(pageStart, pageEnd)
    .replace(/<script>[\s\S]*?<\/script>/g, "")
    .replace(/\sonclick="[^"]*"/g, "")
    .replaceAll('src="img/', 'src="/assets/')
    .replaceAll("url(img/", "url(/assets/")
    .replaceAll('href="index.html#lead"', 'href="/#lead"')
    .replaceAll('href="index.html"', 'href="/"')
    .replaceAll('href="otrasli.html"', 'href="/otrasli"');

  return { css, html };
}
