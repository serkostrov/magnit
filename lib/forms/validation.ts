export const consentVersion = () => process.env.CONSENT_VERSION || "2026-08-04";

export type LeadKind = "quiz" | "wholesale" | "contact" | "other";

export const LEAD_KINDS: ReadonlySet<LeadKind> = new Set([
  "quiz",
  "wholesale",
  "contact",
  "other",
]);

export const ORDER_DELIVERY_METHODS: ReadonlySet<string> = new Set([
  "pickup",
  "moscow",
  "transport",
  "manager",
]);

export type BuyerType = "legal" | "individual";

export const BUYER_TYPES: ReadonlySet<BuyerType> = new Set([
  "legal",
  "individual",
]);

export type ValidatedLeadPayload = {
  kind: LeadKind;
  name: string;
  contact: string;
  phone: string;
  email: string;
  task: string;
  solution: string;
  parameters: string;
  company: string;
  request: string;
  comment: string;
  newsletter: boolean;
  source: string;
};

export type ValidatedOrderPayload = {
  firstName: string;
  phone: string;
  buyerType: BuyerType;
  company: string;
  inn: string;
  email: string;
  delivery: string;
  address: string;
  comment: string;
  lines: Array<{ slug: string; quantity: number }>;
};

export type ValidationResult<T> = { value: T } | { error: string };

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function cleanText(value: unknown, max = 2_000) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export function validPhone(value: string) {
  return value.replace(/\D/g, "").length >= 10;
}

export function validEmail(value: string) {
  return !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function safeConsent(payload: Record<string, unknown>) {
  return payload.consent === true || payload.consent === "true";
}

type TextResult = ValidationResult<string>;

function readTextValue(
  value: unknown,
  label: string,
  max: number,
  required = false,
): TextResult {
  if (value === undefined || value === null || value === "") {
    return required ? { error: `Поле «${label}» обязательно` } : { value: "" };
  }
  if (typeof value !== "string") {
    return { error: `Поле «${label}» должно быть строкой` };
  }
  const normalized = value.trim();
  if (!normalized && required) return { error: `Поле «${label}» обязательно` };
  if (normalized.length > max) {
    return { error: `Поле «${label}» слишком длинное` };
  }
  return { value: normalized };
}

function readText(
  payload: Record<string, unknown>,
  key: string,
  label: string,
  max: number,
  required = false,
) {
  return readTextValue(payload[key], label, max, required);
}

function textValue(result: TextResult) {
  return "error" in result ? "" : result.value;
}

export function validateLeadPayload(payload: unknown): ValidationResult<ValidatedLeadPayload> {
  if (!isRecord(payload)) return { error: "Некорректное тело запроса" };
  if (!safeConsent(payload)) {
    return { error: "Нужно согласиться с обработкой персональных данных" };
  }

  const kind = readText(payload, "kind", "тип заявки", 24, true);
  if ("error" in kind) return kind;
  if (!LEAD_KINDS.has(kind.value as LeadKind)) {
    return { error: "Неизвестный тип заявки" };
  }

  const fields = {
    name: readText(payload, "name", "имя", 120),
    contact: readText(payload, "contact", "контакт", 180),
    phone: readText(payload, "phone", "телефон", 40),
    email: readText(payload, "email", "email", 180),
    task: readText(payload, "task", "задача", 240),
    solution: readText(payload, "solution", "решение", 240),
    parameters: readText(payload, "parameters", "параметры", 240),
    company: readText(payload, "company", "компания", 240),
    request: readText(payload, "request", "запрос", 2_000),
    comment: readText(payload, "comment", "комментарий", 2_000),
    source: readText(payload, "source", "источник", 80),
  };
  for (const result of Object.values(fields)) {
    if ("error" in result) return result;
  }

  const phone = textValue(fields.phone);
  const email = textValue(fields.email);
  if (phone && !validPhone(phone)) return { error: "Укажите корректный номер телефона" };
  if (!validEmail(email)) return { error: "Укажите корректный email" };

  const name = textValue(fields.name);
  const contact = textValue(fields.contact);
  const task = textValue(fields.task);
  const solution = textValue(fields.solution);
  const parameters = textValue(fields.parameters);
  const company = textValue(fields.company);
  const request = textValue(fields.request);
  const comment = textValue(fields.comment);
  const source = textValue(fields.source);

  if (kind.value === "quiz") {
    if (!phone) return { error: "Укажите номер телефона" };
    if (!task || !solution || !parameters) return { error: "Заполните ответы для подбора" };
  }
  if (kind.value === "wholesale" && (!name || !contact)) {
    return { error: "Укажите имя и контакт для оптового расчёта" };
  }
  if (kind.value === "contact" && !contact) {
    return { error: "Укажите контакт для связи" };
  }
  if (kind.value === "other" && !contact && !phone && !email) {
    return { error: "Укажите телефон, email или другой контакт" };
  }

  if (payload.newsletter !== undefined && typeof payload.newsletter !== "boolean") {
    return { error: "Поле подписки имеет неверный тип" };
  }

  return {
    value: {
      kind: kind.value as LeadKind,
      name,
      contact,
      phone,
      email,
      task,
      solution,
      parameters,
      company,
      request,
      comment,
      newsletter: payload.newsletter === true,
      source,
    },
  };
}

export function validateOrderPayload(payload: unknown): ValidationResult<ValidatedOrderPayload> {
  if (!isRecord(payload)) return { error: "Некорректное тело запроса" };
  if (!safeConsent(payload)) {
    return { error: "Нужно согласиться с обработкой персональных данных" };
  }

  const firstName = readText(payload, "firstName", "контактное лицо", 120, true);
  const phone = readText(payload, "phone", "телефон", 40, true);
  const buyerType = readText(payload, "buyerType", "тип покупателя", 20, true);
  if ("error" in buyerType) return buyerType;
  if (!BUYER_TYPES.has(buyerType.value as BuyerType)) {
    return { error: "Выберите корректный тип покупателя" };
  }
  const isLegalBuyer = buyerType.value === "legal";
  const company = readText(payload, "company", "компания", 240, isLegalBuyer);
  const inn = readText(payload, "inn", "ИНН", 20, isLegalBuyer);
  const email = readText(payload, "email", "email", 180, true);
  const delivery = readText(payload, "delivery", "способ получения", 40, true);
  const address = readText(payload, "address", "адрес", 500);
  const comment = readText(payload, "comment", "комментарий", 2_000);
  const fields = [firstName, phone, company, inn, email, delivery, address, comment];
  for (const result of fields) {
    if ("error" in result) return result;
  }

  const firstNameValue = textValue(firstName);
  const phoneValue = textValue(phone);
  const companyValue = textValue(company);
  const innValue = textValue(inn);
  const emailValue = textValue(email);
  const deliveryValue = textValue(delivery);
  const addressValue = textValue(address);
  const commentValue = textValue(comment);
  if (!validPhone(phoneValue)) return { error: "Укажите корректный номер телефона" };
  if (!validEmail(emailValue)) return { error: "Укажите корректный email" };
  if (isLegalBuyer && !/^\d{10}$|^\d{12}$/.test(innValue)) {
    return { error: "ИНН должен содержать 10 или 12 цифр" };
  }
  if (!ORDER_DELIVERY_METHODS.has(deliveryValue)) return { error: "Выберите корректный способ получения" };

  if (!Array.isArray(payload.lines) || payload.lines.length === 0) {
    return { error: "Добавьте товары в заявку" };
  }
  if (payload.lines.length > 100) return { error: "В заявке слишком много позиций" };

  const seen = new Set<string>();
  const lines: Array<{ slug: string; quantity: number }> = [];
  for (const [index, rawLine] of payload.lines.entries()) {
    if (!isRecord(rawLine)) return { error: `Позиция ${index + 1} имеет неверный формат` };
    const slug = readTextValue(rawLine.slug, `slug позиции ${index + 1}`, 180, true);
    if ("error" in slug) return slug;
    if (seen.has(slug.value)) return { error: "В заявке есть повторяющиеся товары" };
    seen.add(slug.value);
    if (typeof rawLine.quantity !== "number" || !Number.isInteger(rawLine.quantity) || rawLine.quantity < 1 || rawLine.quantity > 9_999) {
      return { error: `Количество позиции ${index + 1} должно быть целым числом от 1 до 9999` };
    }
    lines.push({ slug: slug.value, quantity: rawLine.quantity });
  }

  return {
    value: {
      firstName: firstNameValue,
      phone: phoneValue,
      buyerType: buyerType.value as BuyerType,
      company: isLegalBuyer ? companyValue : "",
      inn: isLegalBuyer ? innValue : "",
      email: emailValue,
      delivery: deliveryValue,
      address: addressValue,
      comment: commentValue,
      lines,
    },
  };
}

export function publicFormError(payload: Record<string, unknown>) {
  if (!safeConsent(payload)) return "Нужно согласиться с обработкой персональных данных";
  const phone = cleanText(payload.phone, 40);
  if (phone && !validPhone(phone)) return "Укажите корректный номер телефона";
  const email = cleanText(payload.email, 180);
  if (!validEmail(email)) return "Укажите корректный email";
  return null;
}
