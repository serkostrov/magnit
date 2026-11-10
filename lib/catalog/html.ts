const allowedTags = new Set([
  "a",
  "blockquote",
  "br",
  "em",
  "h2",
  "h3",
  "h4",
  "li",
  "ol",
  "p",
  "s",
  "strong",
  "ul",
]);

function escapeAttribute(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function removeLegacyOffer(value: string) {
  return value
    .replace(/<a\b[^>]*>\s*предложить свою цену\s*<\/a>/gi, "")
    .replace(/предложить свою цену/gi, "")
    .replace(/<p>\s*<\/p>/gi, "");
}

export function sanitizeProductHtml(value: string) {
  return removeLegacyOffer(value || "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(
      /<(?:script|style|iframe|object|embed|noscript|template)\b[\s\S]*?<\/(?:script|style|iframe|object|embed|noscript|template)>/gi,
      "",
    )
    .replace(/<\/?([a-z0-9-]+)([^>]*)>/gi, (full, tagName, attributes) => {
      const tag = String(tagName).toLowerCase();
      if (!allowedTags.has(tag)) return "";
      if (full.startsWith("</")) return `</${tag}>`;
      if (tag === "br") return "<br>";
      if (tag !== "a") return `<${tag}>`;
      const hrefMatch = String(attributes).match(
        /\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i,
      );
      const href = hrefMatch?.[1] || hrefMatch?.[2] || hrefMatch?.[3] || "";
      const safeHref =
        /^(?:https?:|mailto:|tel:|\/|#)/i.test(href) && !/^javascript:/i.test(href)
          ? href
          : "";
      return safeHref ? `<a href="${escapeAttribute(safeHref)}">` : "<a>";
    })
    .trim();
}

export function cleanProductSummary(value: string) {
  return removeLegacyOffer(value || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .replace(/^[\s,.;:—-]+|[\s,.;:—-]+$/g, "")
    .trim();
}
