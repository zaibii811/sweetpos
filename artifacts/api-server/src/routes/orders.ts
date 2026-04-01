import { Router, type IRouter } from "express";
import { eq, and, gte, lt, inArray, SQL } from "drizzle-orm";
import { db, ordersTable, orderItemsTable, productsTable, staffTable } from "@workspace/db";
import {
  CreateOrderBody,
  ListOrdersQueryParams,
  GetOrderParams,
  UpdateOrderStatusParams,
  UpdateOrderStatusBody,
  ListOrdersResponse,
  GetOrderResponse,
  UpdateOrderStatusResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

const SST_RATE = 0.08;

async function getOrderWithItems(orderId: number) {
  const [order] = await db
    .select({
      order: ordersTable,
      staffName: staffTable.name,
    })
    .from(ordersTable)
    .leftJoin(staffTable, eq(ordersTable.staffId, staffTable.id))
    .where(eq(ordersTable.id, orderId));

  if (!order) return null;

  const items = await db
    .select()
    .from(orderItemsTable)
    .where(eq(orderItemsTable.orderId, orderId));

  return {
    id: order.order.id,
    orderNumber: order.order.orderNumber,
    status: order.order.status,
    items: items.map((i) => ({
      id: i.id,
      productId: i.productId,
      productName: i.productName,
      quantity: i.quantity,
      unitPrice: parseFloat(i.unitPrice),
      taxRate: parseFloat(i.taxRate),
      subtotal: parseFloat(i.subtotal),
      tax: parseFloat(i.tax),
      total: parseFloat(i.total),
    })),
    subtotal: parseFloat(order.order.subtotal),
    taxTotal: parseFloat(order.order.taxTotal),
    total: parseFloat(order.order.total),
    paymentMethod: order.order.paymentMethod,
    amountPaid: order.order.amountPaid ? parseFloat(order.order.amountPaid) : null,
    change: order.order.change ? parseFloat(order.order.change) : null,
    notes: order.order.notes,
    staffId: order.order.staffId,
    staffName: order.staffName ?? null,
    createdAt: order.order.createdAt.toISOString(),
    updatedAt: order.order.updatedAt.toISOString(),
  };
}

function generateOrderNumber(): string {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, "");
  const time = String(now.getTime()).slice(-6);
  return `ORD-${date}-${time}`;
}

router.get("/orders", async (req, res): Promise<void> => {
  const queryParams = ListOrdersQueryParams.safeParse(req.query);
  if (!queryParams.success) {
    res.status(400).json({ error: queryParams.error.message });
    return;
  }

  const { status, date, limit, offset } = queryParams.data;

  const conditions: SQL[] = [];

  if (status) {
    conditions.push(eq(ordersTable.status, status));
  }

  if (date) {
    const startDate = new Date(date);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(date);
    endDate.setHours(23, 59, 59, 999);
    conditions.push(gte(ordersTable.createdAt, startDate));
    conditions.push(lt(ordersTable.createdAt, endDate));
  }

  const query = db
    .select({
      order: ordersTable,
      staffName: staffTable.name,
    })
    .from(ordersTable)
    .leftJoin(staffTable, eq(ordersTable.staffId, staffTable.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(ordersTable.createdAt)
    .limit(limit ?? 50)
    .offset(offset ?? 0);

  const orders = await query;

  const orderIds = orders.map((o) => o.order.id);
  let allItems: typeof orderItemsTable.$inferSelect[] = [];

  if (orderIds.length > 0) {
    allItems = await db
      .select()
      .from(orderItemsTable)
      .where(inArray(orderItemsTable.orderId, orderIds));
  }

  const data = orders.map((o) => {
    const items = allItems.filter((i) => i.orderId === o.order.id);
    return {
      id: o.order.id,
      orderNumber: o.order.orderNumber,
      status: o.order.status,
      items: items.map((i) => ({
        id: i.id,
        productId: i.productId,
        productName: i.productName,
        quantity: i.quantity,
        unitPrice: parseFloat(i.unitPrice),
        taxRate: parseFloat(i.taxRate),
        subtotal: parseFloat(i.subtotal),
        tax: parseFloat(i.tax),
        total: parseFloat(i.total),
      })),
      subtotal: parseFloat(o.order.subtotal),
      taxTotal: parseFloat(o.order.taxTotal),
      total: parseFloat(o.order.total),
      paymentMethod: o.order.paymentMethod,
      amountPaid: o.order.amountPaid ? parseFloat(o.order.amountPaid) : null,
      change: o.order.change ? parseFloat(o.order.change) : null,
      notes: o.order.notes,
      staffId: o.order.staffId,
      staffName: o.staffName ?? null,
      createdAt: o.order.createdAt.toISOString(),
      updatedAt: o.order.updatedAt.toISOString(),
    };
  });

  res.json(ListOrdersResponse.parse(data));
});

router.post("/orders", async (req, res): Promise<void> => {
  const parsed = CreateOrderBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { items, paymentMethod, amountPaid, notes, staffId } = parsed.data;

  if (!items || items.length === 0) {
    res.status(400).json({ error: "Order must have at least one item" });
    return;
  }

  const productIds = items.map((i) => i.productId);
  const products = await db
    .select()
    .from(productsTable)
    .where(inArray(productsTable.id, productIds));

  const productMap = new Map(products.map((p) => [p.id, p]));

  let subtotal = 0;
  let taxTotal = 0;

  const orderItemData = items.map((item) => {
    const product = productMap.get(item.productId);
    if (!product) throw new Error(`Product ${item.productId} not found`);

    const unitPrice = parseFloat(product.price);
    const taxRate = product.taxable ? SST_RATE : 0;
    const itemSubtotal = unitPrice * item.quantity;
    const itemTax = itemSubtotal * taxRate;
    const itemTotal = itemSubtotal + itemTax;

    subtotal += itemSubtotal;
    taxTotal += itemTax;

    return {
      productId: item.productId,
      productName: product.name,
      quantity: item.quantity,
      unitPrice: String(unitPrice),
      taxRate: String(taxRate),
      subtotal: String(itemSubtotal.toFixed(2)),
      tax: String(itemTax.toFixed(2)),
      total: String(itemTotal.toFixed(2)),
    };
  });

  const total = subtotal + taxTotal;
  const change = amountPaid != null && amountPaid > 0 ? amountPaid - total : null;

  const [newOrder] = await db
    .insert(ordersTable)
    .values({
      orderNumber: generateOrderNumber(),
      status: "completed",
      subtotal: String(subtotal.toFixed(2)),
      taxTotal: String(taxTotal.toFixed(2)),
      total: String(total.toFixed(2)),
      paymentMethod,
      amountPaid: amountPaid != null ? String(amountPaid) : null,
      change: change != null ? String(change.toFixed(2)) : null,
      notes,
      staffId,
    })
    .returning();

  await db.insert(orderItemsTable).values(
    orderItemData.map((item) => ({ ...item, orderId: newOrder.id }))
  );

  for (const item of items) {
    const product = productMap.get(item.productId);
    if (product && product.stock > 0) {
      await db
        .update(productsTable)
        .set({ stock: Math.max(0, product.stock - item.quantity) })
        .where(eq(productsTable.id, item.productId));
    }
  }

  const result = await getOrderWithItems(newOrder.id);
  res.status(201).json(result);
});

router.get("/orders/:id", async (req, res): Promise<void> => {
  const params = GetOrderParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const order = await getOrderWithItems(params.data.id);

  if (!order) {
    res.status(404).json({ error: "Order not found" });
    return;
  }

  res.json(GetOrderResponse.parse(order));
});

router.patch("/orders/:id/status", async (req, res): Promise<void> => {
  const params = UpdateOrderStatusParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const parsed = UpdateOrderStatusBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [order] = await db
    .update(ordersTable)
    .set({ status: parsed.data.status })
    .where(eq(ordersTable.id, params.data.id))
    .returning();

  if (!order) {
    res.status(404).json({ error: "Order not found" });
    return;
  }

  const result = await getOrderWithItems(order.id);
  res.json(UpdateOrderStatusResponse.parse(result));
});

export default router;
