import assert from "node:assert/strict";
import { createServer } from "node:net";
import { once } from "node:events";
import test from "node:test";

const smtpKeys = [
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_SECURE",
  "SMTP_USER",
  "SMTP_PASS",
  "NOTIFICATION_EMAIL_FROM",
  "NOTIFICATION_EMAIL_TO",
];
const previousEnvironment = Object.fromEntries(smtpKeys.map((key) => [key, process.env[key]]));

function restoreEnvironment() {
  for (const key of smtpKeys) {
    const value = previousEnvironment[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

function createFakeSmtpServer() {
  const messages = [];
  const server = createServer((socket) => {
    let buffer = "";
    let dataLines = null;
    let loginStep = 0;
    socket.setEncoding("utf8");
    socket.write("220 localhost test SMTP\r\n");
    socket.on("data", (chunk) => {
      buffer += chunk;
      let newlineIndex = buffer.indexOf("\r\n");
      while (newlineIndex >= 0) {
        const line = buffer.slice(0, newlineIndex);
        buffer = buffer.slice(newlineIndex + 2);

        if (dataLines) {
          if (line === ".") {
            messages.push(dataLines.join("\r\n"));
            dataLines = null;
            socket.write("250 2.0.0 queued\r\n");
          } else {
            dataLines.push(line);
          }
        } else if (loginStep === 1) {
          loginStep = 2;
          socket.write("334 UGFzc3dvcmQ6\r\n");
        } else if (loginStep === 2) {
          loginStep = 0;
          socket.write("235 2.7.0 authenticated\r\n");
        } else if (/^EHLO\b/i.test(line)) {
          socket.write("250-localhost\r\n250 AUTH PLAIN LOGIN\r\n");
        } else if (/^AUTH PLAIN\b/i.test(line)) {
          socket.write("235 2.7.0 authenticated\r\n");
        } else if (/^AUTH LOGIN\b/i.test(line)) {
          loginStep = 1;
          socket.write("334 VXNlcm5hbWU6\r\n");
        } else if (/^(MAIL FROM|RCPT TO):/i.test(line)) {
          socket.write("250 2.1.0 ok\r\n");
        } else if (/^DATA$/i.test(line)) {
          dataLines = [];
          socket.write("354 End data with <CR><LF>.<CR><LF>\r\n");
        } else if (/^QUIT$/i.test(line)) {
          socket.end("221 2.0.0 bye\r\n");
        } else {
          socket.write("250 ok\r\n");
        }

        newlineIndex = buffer.indexOf("\r\n");
      }
    });
  });
  return { server, messages };
}

test("SMTP readiness and delivery use the configured mailbox", async (t) => {
  const { server, messages } = createFakeSmtpServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(async () => {
    restoreEnvironment();
    server.close();
    await once(server, "close");
  });

  const address = server.address();
  assert(address && typeof address === "object");
  Object.assign(process.env, {
    SMTP_HOST: "127.0.0.1",
    SMTP_PORT: String(address.port),
    SMTP_SECURE: "false",
    SMTP_USER: "anna@saitmagnitov.ru",
    SMTP_PASS: "test-only-secret",
    NOTIFICATION_EMAIL_FROM: "anna@saitmagnitov.ru",
    NOTIFICATION_EMAIL_TO: "info@smagn.ru",
  });

  const { getEmailNotificationReadiness, notifyByEmail } = await import("../lib/notifications/email.ts");
  assert.deepEqual(getEmailNotificationReadiness(), {
    prepared: true,
    transport: "smtp",
    configured: true,
    fromConfigured: true,
    recipientConfigured: true,
    transportConfigured: true,
    issues: [],
  });

  const delivery = await notifyByEmail({
    subject: "Тестовая заявка",
    text: "Проверка SMTP-доставки",
    replyTo: "visitor@example.com",
  });
  assert.equal(delivery.delivered, true);
  assert.equal(messages.length, 1);
  assert.match(messages[0], /^From: anna@saitmagnitov\.ru$/m);
  assert.match(messages[0], /^To: info@smagn\.ru$/m);
  assert.match(messages[0], /^Reply-To: visitor@example\.com$/m);
  assert.match(messages[0], /^Subject:/m);

  const customerDelivery = await notifyByEmail({
    subject: "Заказ принят",
    text: "В ближайшее время с вами свяжется наш менеджер.",
    to: "customer@example.com",
  });
  assert.equal(customerDelivery.delivered, true);
  assert.equal(messages.length, 2);
  assert.match(messages[1], /^From: anna@saitmagnitov\.ru$/m);
  assert.match(messages[1], /^To: customer@example\.com$/m);

  const invalidRecipient = await notifyByEmail({
    subject: "Не отправлять",
    text: "Некорректный адрес",
    to: "invalid-address",
  });
  assert.equal(invalidRecipient.delivered, false);
  assert.equal(invalidRecipient.reason, "Email notification recipient is invalid");
  assert.equal(messages.length, 2);

  delete process.env.SMTP_PASS;
  const unavailable = getEmailNotificationReadiness();
  assert.equal(unavailable.configured, false);
  assert.equal(unavailable.transportConfigured, false);
  assert.deepEqual(unavailable.issues, ["SMTP_PASS is missing"]);
});

test("order validation requires a customer email", async () => {
  const { validateOrderPayload } = await import("../lib/forms/validation.ts");
  const baseOrder = {
    firstName: "Анна",
    phone: "+7 999 000-00-00",
    buyerType: "legal",
    company: "ООО Тест",
    inn: "7707083893",
    delivery: "pickup",
    address: "",
    comment: "",
    consent: true,
    lines: [{ slug: "test-product", quantity: 1 }],
  };

  assert.deepEqual(validateOrderPayload(baseOrder), { error: "Поле «email» обязательно" });
  assert.deepEqual(validateOrderPayload({ ...baseOrder, email: "invalid" }), { error: "Укажите корректный email" });
  assert.ok("value" in validateOrderPayload({ ...baseOrder, email: "customer@example.com" }));
});

test("order validation requires company details only for legal buyers", async () => {
  const { validateOrderPayload } = await import("../lib/forms/validation.ts");
  const baseOrder = {
    firstName: "Анна",
    phone: "+7 999 000-00-00",
    email: "customer@example.com",
    delivery: "pickup",
    address: "",
    comment: "",
    consent: true,
    lines: [{ slug: "test-product", quantity: 1 }],
  };

  assert.deepEqual(
    validateOrderPayload({ ...baseOrder, buyerType: "legal", company: "", inn: "7707083893" }),
    { error: "Поле «компания» обязательно" },
  );
  assert.deepEqual(
    validateOrderPayload({ ...baseOrder, buyerType: "legal", company: "ООО Тест", inn: "" }),
    { error: "Поле «ИНН» обязательно" },
  );

  const individual = validateOrderPayload({
    ...baseOrder,
    buyerType: "individual",
    company: "ООО Черновик",
    inn: "7707083893",
  });
  assert.ok("value" in individual);
  assert.equal(individual.value.buyerType, "individual");
  assert.equal(individual.value.company, "");
  assert.equal(individual.value.inn, "");
});

test("customer order message contains order details and manager follow-up", async () => {
  const { customerOrderNotification, managerOrderNotification } = await import("../lib/orders/notifications.ts");
  const details = {
    orderId: "12345678-abcd-ef00-1234-567890abcdef",
    firstName: "Анна",
    phone: "+7 999 000-00-00",
    buyerType: "legal",
    company: "ООО Тест",
    inn: "7707083893",
    email: "customer@example.com",
    delivery: "transport",
    address: "Москва",
    comment: "Позвонить утром",
    total: 1250,
    items: [{ name: "Магнит диск", sku: "Д001", quantity: 2, lineTotal: 1250 }],
  };

  const customer = customerOrderNotification(details);
  assert.equal(customer.to, "customer@example.com");
  assert.equal(customer.subject, "Заказ №12345678 принят");
  assert.match(customer.text, /Магнит диск \(Д001\) × 2/);
  assert.match(customer.text, /1[\s\u00a0]250 ₽/);
  assert.match(customer.text, /Транспортная компания по РФ/);
  assert.match(customer.text, /В ближайшее время с вами свяжется наш менеджер/);

  const manager = managerOrderNotification(details);
  assert.equal(manager.replyTo, "customer@example.com");
  assert.match(manager.text, /Email: customer@example\.com/);
  assert.match(manager.text, /Тип покупателя: Юридическое лицо/);
  assert.match(manager.text, /ИНН: 7707083893/);
});
