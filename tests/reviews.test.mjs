import assert from "node:assert/strict";
import test from "node:test";

import { detectReviewPhoto, reviewInitials, validateReviewFields } from "../lib/reviews/validation.ts";
import { reviewRequestNotification, managerReviewNotification, yandexReviewsUrl } from "../lib/reviews/notifications.ts";

test("review initials use the first letters of the first and last name", () => {
  assert.equal(reviewInitials("Сергей Костров"), "СК");
  assert.equal(reviewInitials("  Анна  "), "А");
  assert.equal(reviewInitials("Иван Сергеевич Петров"), "ИП");
});

test("review fields require author, rating, text and consent", () => {
  assert.deepEqual(validateReviewFields({ authorName: "", rating: 5, body: "Хорошие магниты", consent: true }), { error: "Укажите имя и фамилию" });
  assert.deepEqual(validateReviewFields({ authorName: "Сергей Костров", rating: 0, body: "Хорошие магниты", consent: true }), { error: "Выберите оценку от 1 до 5" });
  assert.deepEqual(validateReviewFields({ authorName: "Сергей Костров", rating: 5, body: "Коротко", consent: true }), { error: "Напишите отзыв длиной не менее 10 символов" });
  assert.ok("value" in validateReviewFields({ authorName: "Сергей Костров", rating: 5, body: "Отличные сильные магниты", consent: true }));
});

test("review photo detection trusts file signatures instead of extensions", () => {
  assert.deepEqual(detectReviewPhoto(Uint8Array.from([0xff, 0xd8, 0xff, 0x00])), { extension: "jpg", contentType: "image/jpeg" });
  assert.deepEqual(detectReviewPhoto(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), { extension: "png", contentType: "image/png" });
  assert.equal(detectReviewPhoto(new TextEncoder().encode("<svg onload=alert(1)>")), null);
});

test("paid order email offers equal Yandex and site review choices", () => {
  const message = reviewRequestNotification({ orderId: "12345678-abcd", firstName: "Анна", email: "customer@example.com", reviewUrl: "https://saitmagnitov.ru/reviews/new?token=test" });
  assert.equal(message.to, "customer@example.com");
  assert.ok(message.text.includes(yandexReviewsUrl));
  assert.match(message.text, /https:\/\/saitmagnitov\.ru\/reviews\/new\?token=test/);
  assert.match(message.html, />Отзыв в Яндексе</);
  assert.match(message.html, />Отзыв на сайте</);
});

test("manager review email points to moderation", () => {
  const message = managerReviewNotification({ reviewId: "review-id", authorName: "Сергей Костров", rating: 5, body: "Отличные магниты", adminUrl: "https://saitmagnitov.ru/admin/reviews?status=moderation" });
  assert.match(message.subject, /5★/);
  assert.match(message.text, /admin\/reviews\?status=moderation/);
});
