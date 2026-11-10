import { query, isDatabaseConfigured, withTransaction } from "../db/client";
import { consentVersion, type BuyerType } from "../forms/validation";
import { deliverNotification, enqueueNotification, publicNotificationStatus } from "../notifications/service";
import { recordAdminAudit } from "../audit/service";
import { customerOrderNotification, managerOrderNotification } from "./notifications";
import { createReviewRequestForPaidOrder } from "../reviews/service";

export type OrderLine = { slug: string; quantity: number };

export type CreateOrderInput = {
  firstName: string;
  phone: string;
  buyerType: BuyerType;
  company: string;
  inn: string;
  email: string;
  delivery: string;
  address: string;
  comment: string;
  lines: OrderLine[];
  consentIp?: string;
  consentUserAgent?: string;
};

export class PublishedProductsUnavailableError extends Error {
  constructor() {
    super("PRODUCTS_UNAVAILABLE");
    this.name = "PublishedProductsUnavailableError";
  }
}

export class OrderNotFoundError extends Error {
  constructor() {
    super("NOT_FOUND");
    this.name = "OrderNotFoundError";
  }
}

export function isOrdersDatabaseConfigured() {
  return isDatabaseConfigured();
}

export async function createOrder(input: CreateOrderInput) {
  if (!isDatabaseConfigured()) return { stored: false as const };

  const slugs = [...new Set(input.lines.map((line) => line.slug))];
  const result = await query<{ id: string; slug: string; external_id: string | null; name: string; sku: string; price: string }>(
    `SELECT id, slug, external_id, name, COALESCE(sku, '') AS sku, price::text FROM products WHERE slug = ANY($1::text[]) AND status = 'published'`,
    [slugs],
  );
  const products = new Map<string, typeof result.rows[number]>();
  for (const row of result.rows) products.set(row.slug, row);
  if (products.size !== slugs.length) throw new PublishedProductsUnavailableError();

  const order = await withTransaction(async (client) => {
    let total = 0;
    const prepared = input.lines.map((line) => {
      const product = products.get(line.slug)!;
      const unitPrice = Number(product.price);
      const lineTotal = unitPrice * line.quantity;
      total += lineTotal;
      return { line, product, unitPrice, lineTotal };
    });
    const inserted = await client.query<{ id: string }>(
      `INSERT INTO orders (first_name, phone, company, inn, email, delivery_method, delivery_address, comment, total_amount, consent_version, consent_at, consent_ip, consent_user_agent)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,now(),$11,$12) RETURNING id`,
      [input.firstName, input.phone, input.company, input.inn, input.email, input.delivery, input.address, input.comment, total, consentVersion(), input.consentIp || "", input.consentUserAgent || ""],
    );
    const orderId = inserted.rows[0].id;
    for (const item of prepared) {
      await client.query(
        `INSERT INTO order_items (order_id, product_id, external_product_id, product_name, sku, quantity, unit_price, line_total)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [orderId, item.product.id, item.product.external_id, item.product.name, item.product.sku, item.line.quantity, item.unitPrice, item.lineTotal],
      );
    }
    const details = {
      orderId,
      firstName: input.firstName,
      phone: input.phone,
      buyerType: input.buyerType,
      company: input.company,
      inn: input.inn,
      email: input.email,
      delivery: input.delivery,
      address: input.address,
      comment: input.comment,
      total,
      items: prepared.map((item) => ({
        name: item.product.name,
        sku: item.product.sku,
        quantity: item.line.quantity,
        lineTotal: item.lineTotal,
      })),
    };
    const managerNotificationId = await enqueueNotification(client, {
      entityType: "order",
      entityId: orderId,
      recipientKind: "manager",
      ...managerOrderNotification(details),
    });
    const customerNotificationId = await enqueueNotification(client, {
      entityType: "order",
      entityId: orderId,
      recipientKind: "customer",
      ...customerOrderNotification(details),
    });
    return { id: orderId, managerNotificationId, customerNotificationId };
  });

  const [managerNotification, customerNotification] = await Promise.all([
    deliverNotification(order.managerNotificationId),
    deliverNotification(order.customerNotificationId),
  ]);
  return {
    stored: true as const,
    orderId: order.id,
    notification: publicNotificationStatus(managerNotification),
    customerNotification: publicNotificationStatus(customerNotification),
  };
}

export async function listOrders(status = "") {
  if (!isDatabaseConfigured()) return [];
  const params: unknown[] = [];
  const where = status ? "WHERE o.status = $1" : "";
  if (status) params.push(status);
  const result = await query<Record<string, unknown>>(
    `SELECT o.id,o.status,o.first_name,o.company,o.phone,o.email,o.total_amount,o.created_at,COUNT(oi.id)::int AS item_count FROM orders o LEFT JOIN order_items oi ON oi.order_id=o.id ${where} GROUP BY o.id ORDER BY o.created_at DESC LIMIT 100`,
    params,
  );
  return result.rows;
}

export async function getOrder(id: string) {
  const order = await query<Record<string, unknown>>("SELECT * FROM orders WHERE id=$1", [id]);
  if (!order.rows[0]) return null;
  const items = await query<Record<string, unknown>>("SELECT * FROM order_items WHERE order_id=$1 ORDER BY id", [id]);
  return { ...order.rows[0], items: items.rows };
}

export async function updateOrderStatus(id: string, status: string, adminId: string) {
  const result = await withTransaction(async (client) => {
    const current = await client.query<{ id: string; status: string; first_name: string; email: string }>(
      "SELECT id,status,first_name,email FROM orders WHERE id=$1 FOR UPDATE",
      [id],
    );
    const order = current.rows[0];
    if (!order) throw new OrderNotFoundError();
    await client.query("UPDATE orders SET status=$1, updated_at=now() WHERE id=$2", [status, id]);
    const reviewRequest = status === "paid" && order.status !== "paid"
      ? await createReviewRequestForPaidOrder(client, order)
      : null;
    await recordAdminAudit(adminId, "update_status", "order", id, { from: order.status, to: status, reviewRequestCreated: Boolean(reviewRequest) }, client);
    return reviewRequest;
  });
  if (!result) return { reviewInvitation: null, reviewInvitationCreated: false };
  const delivery = await deliverNotification(result.notificationId);
  return { reviewInvitation: publicNotificationStatus(delivery), reviewInvitationCreated: true };
}
