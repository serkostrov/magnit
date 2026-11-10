const yandexReviewsUrl = "https://reviews.yandex.ru/shop/saitmagnitov.ru";

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] || character);
}

function orderNumber(orderId: string) {
  return orderId.slice(0, 8).toUpperCase();
}

export function reviewRequestNotification(input: { orderId: string; firstName: string; email: string; reviewUrl: string }) {
  const name = input.firstName.trim() || "покупатель";
  const subject = `Как вам заказ №${orderNumber(input.orderId)}?`;
  const text = [
    `Здравствуйте, ${name}!`,
    "",
    `Спасибо за заказ №${orderNumber(input.orderId)}. Будем рады вашему отзыву — выберите удобный вариант:`,
    "",
    `Оставить отзыв в Яндексе: ${yandexReviewsUrl}`,
    `Оставить отзыв на сайте: ${input.reviewUrl}`,
    "",
    "С уважением,",
    "команда «Сайт Магнитов»",
  ].join("\n");
  const buttonStyle = "display:inline-block;box-sizing:border-box;min-width:240px;margin:6px;padding:14px 18px;border-radius:10px;text-align:center;text-decoration:none;font:600 16px Arial,sans-serif";
  const html = `<!doctype html><html lang="ru"><body style="margin:0;padding:24px;background:#f4f7ff;color:#0d1830;font:16px/1.5 Arial,sans-serif"><div style="max-width:640px;margin:0 auto;padding:28px;background:#fff;border-radius:16px"><p>Здравствуйте, ${escapeHtml(name)}!</p><p>Спасибо за заказ №${escapeHtml(orderNumber(input.orderId))}. Будем рады вашему отзыву — выберите удобный вариант:</p><p style="margin:24px -6px"><a href="${yandexReviewsUrl}" style="${buttonStyle};background:#ffcc00;color:#111">Отзыв в Яндексе</a><a href="${escapeHtml(input.reviewUrl)}" style="${buttonStyle};background:#1769ff;color:#fff">Отзыв на сайте</a></p><p>С уважением,<br>команда «Сайт Магнитов»</p></div></body></html>`;
  return { subject, text, html, to: input.email };
}

export function managerReviewNotification(input: { reviewId: string; authorName: string; rating: number; body: string; adminUrl: string }) {
  return {
    subject: `Новый отзыв: ${input.rating}★ — ${input.authorName}`,
    text: [
      `Новый отзыв от ${input.authorName}`,
      `Оценка: ${input.rating} из 5`,
      "",
      input.body,
      "",
      `Проверить и опубликовать: ${input.adminUrl}`,
      `ID: ${input.reviewId}`,
    ].join("\n"),
  };
}

export { yandexReviewsUrl };
