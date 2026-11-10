type OrderNotificationItem = {
  name: string;
  sku: string;
  quantity: number;
  lineTotal: number;
};

type BuyerType = "legal" | "individual";

export type OrderNotificationDetails = {
  orderId: string;
  firstName: string;
  phone: string;
  buyerType: BuyerType;
  company: string;
  inn: string;
  email: string;
  delivery: string;
  address: string;
  comment: string;
  total: number;
  items: OrderNotificationItem[];
};

const deliveryNames: Record<string, string> = {
  pickup: "Самовывоз",
  moscow: "Курьер по Москве",
  transport: "Транспортная компания по РФ",
  manager: "Обсудить с менеджером",
};

function money(value: number) {
  return new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

function orderNumber(orderId: string) {
  return orderId.slice(0, 8).toUpperCase();
}

function itemLines(items: OrderNotificationItem[]) {
  return items.map((item) => {
    const sku = item.sku ? ` (${item.sku})` : "";
    return `— ${item.name}${sku} × ${item.quantity} — ${money(item.lineTotal)} ₽`;
  });
}

export function managerOrderNotification(details: OrderNotificationDetails) {
  return {
    subject: `Новая заявка из корзины №${orderNumber(details.orderId)}`,
    replyTo: details.email,
    text: [
      `Заказ №${orderNumber(details.orderId)}`,
      `Контакт: ${details.firstName}`,
      `Телефон: ${details.phone}`,
      `Email: ${details.email}`,
      `Тип покупателя: ${details.buyerType === "legal" ? "Юридическое лицо" : "Физическое лицо"}`,
      ...(details.buyerType === "legal"
        ? [`Компания: ${details.company}`, `ИНН: ${details.inn}`]
        : []),
      "",
      "Состав заказа:",
      ...itemLines(details.items),
      "",
      `Итого: ${money(details.total)} ₽`,
      `Получение: ${deliveryNames[details.delivery] || details.delivery}`,
      ...(details.address ? [`Адрес или город: ${details.address}`] : []),
      ...(details.comment ? [`Комментарий: ${details.comment}`] : []),
    ].join("\n"),
  };
}

export function customerOrderNotification(details: OrderNotificationDetails) {
  return {
    subject: `Заказ №${orderNumber(details.orderId)} принят`,
    to: details.email,
    text: [
      `Здравствуйте, ${details.firstName}!`,
      "",
      `Мы получили ваш заказ №${orderNumber(details.orderId)}.`,
      "",
      "Состав заказа:",
      ...itemLines(details.items),
      "",
      `Итого: ${money(details.total)} ₽`,
      `Способ получения: ${deliveryNames[details.delivery] || details.delivery}`,
      ...(details.address ? [`Адрес или город: ${details.address}`] : []),
      ...(details.comment ? [`Комментарий: ${details.comment}`] : []),
      "",
      "В ближайшее время с вами свяжется наш менеджер, чтобы подтвердить наличие, итоговую стоимость и условия получения.",
      "",
      "С уважением,",
      "команда «Сайт Магнитов»",
      "+7 (495) 120-75-67",
    ].join("\n"),
  };
}
