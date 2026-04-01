import { Router, type IRouter } from "express";
import { eq, gte, lt, and, sum, count, avg, SQL } from "drizzle-orm";
import { db, ordersTable, orderItemsTable, productsTable, categoriesTable } from "@workspace/db";
import {
  GetReportSummaryQueryParams,
  GetReportSummaryResponse,
  GetTopProductsQueryParams,
  GetTopProductsResponse,
  GetSalesByDayQueryParams,
  GetSalesByDayResponse,
  GetSalesByCategoryQueryParams,
  GetSalesByCategoryResponse,
  GetRecentActivityQueryParams,
  GetRecentActivityResponse,
  ListOrdersResponse,
} from "@workspace/api-zod";
import { staffTable } from "@workspace/db";

const router: IRouter = Router();

function getPeriodDates(period?: string): { startDate: Date; endDate: Date } {
  const now = new Date();
  const endDate = new Date(now);
  endDate.setHours(23, 59, 59, 999);

  let startDate: Date;

  switch (period) {
    case "week": {
      startDate = new Date(now);
      startDate.setDate(now.getDate() - 6);
      startDate.setHours(0, 0, 0, 0);
      break;
    }
    case "month": {
      startDate = new Date(now);
      startDate.setDate(1);
      startDate.setHours(0, 0, 0, 0);
      break;
    }
    default: {
      startDate = new Date(now);
      startDate.setHours(0, 0, 0, 0);
      break;
    }
  }

  return { startDate, endDate };
}

router.get("/reports/summary", async (req, res): Promise<void> => {
  const queryParams = GetReportSummaryQueryParams.safeParse(req.query);
  if (!queryParams.success) {
    res.status(400).json({ error: queryParams.error.message });
    return;
  }

  const period = queryParams.data.period ?? "today";
  const { startDate, endDate } = getPeriodDates(period);

  const conditions: SQL[] = [
    gte(ordersTable.createdAt, startDate),
    lt(ordersTable.createdAt, endDate),
    eq(ordersTable.status, "completed"),
  ];

  const [summary] = await db
    .select({
      totalSales: sum(ordersTable.total),
      totalOrders: count(ordersTable.id),
      totalTax: sum(ordersTable.taxTotal),
      averageOrderValue: avg(ordersTable.total),
    })
    .from(ordersTable)
    .where(and(...conditions));

  res.json(
    GetReportSummaryResponse.parse({
      totalSales: parseFloat(summary.totalSales ?? "0"),
      totalOrders: Number(summary.totalOrders ?? 0),
      totalTax: parseFloat(summary.totalTax ?? "0"),
      averageOrderValue: parseFloat(summary.averageOrderValue ?? "0"),
      period,
    })
  );
});

router.get("/reports/top-products", async (req, res): Promise<void> => {
  const queryParams = GetTopProductsQueryParams.safeParse(req.query);
  if (!queryParams.success) {
    res.status(400).json({ error: queryParams.error.message });
    return;
  }

  const period = queryParams.data.period ?? "month";
  const limit = queryParams.data.limit ?? 10;
  const { startDate, endDate } = getPeriodDates(period);

  const rows = await db
    .select({
      productId: orderItemsTable.productId,
      productName: orderItemsTable.productName,
      quantitySold: sum(orderItemsTable.quantity),
      revenue: sum(orderItemsTable.total),
    })
    .from(orderItemsTable)
    .innerJoin(ordersTable, eq(orderItemsTable.orderId, ordersTable.id))
    .where(
      and(
        gte(ordersTable.createdAt, startDate),
        lt(ordersTable.createdAt, endDate),
        eq(ordersTable.status, "completed")
      )
    )
    .groupBy(orderItemsTable.productId, orderItemsTable.productName)
    .limit(limit);

  const productIds = rows.map((r) => r.productId);
  const products = productIds.length > 0
    ? await db
        .select({ id: productsTable.id, categoryName: categoriesTable.name })
        .from(productsTable)
        .leftJoin(categoriesTable, eq(productsTable.categoryId, categoriesTable.id))
        .where(and(...productIds.map((id) => eq(productsTable.id, id))))
    : [];

  const categoryMap = new Map(products.map((p) => [p.id, p.categoryName]));

  const data = rows.map((r) => ({
    productId: r.productId,
    productName: r.productName,
    categoryName: categoryMap.get(r.productId) ?? null,
    quantitySold: Number(r.quantitySold ?? 0),
    revenue: parseFloat(r.revenue ?? "0"),
  }));

  res.json(GetTopProductsResponse.parse(data));
});

router.get("/reports/sales-by-day", async (req, res): Promise<void> => {
  const queryParams = GetSalesByDayQueryParams.safeParse(req.query);
  if (!queryParams.success) {
    res.status(400).json({ error: queryParams.error.message });
    return;
  }

  const days = queryParams.data.days ?? 7;
  const endDate = new Date();
  endDate.setHours(23, 59, 59, 999);
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - (days - 1));
  startDate.setHours(0, 0, 0, 0);

  const orders = await db
    .select()
    .from(ordersTable)
    .where(
      and(
        gte(ordersTable.createdAt, startDate),
        lt(ordersTable.createdAt, endDate),
        eq(ordersTable.status, "completed")
      )
    );

  const dayMap = new Map<string, { totalSales: number; totalOrders: number }>();

  for (let i = 0; i < days; i++) {
    const d = new Date();
    d.setDate(d.getDate() - (days - 1 - i));
    const key = d.toISOString().slice(0, 10);
    dayMap.set(key, { totalSales: 0, totalOrders: 0 });
  }

  for (const order of orders) {
    const key = order.createdAt.toISOString().slice(0, 10);
    const existing = dayMap.get(key);
    if (existing) {
      existing.totalSales += parseFloat(order.total);
      existing.totalOrders += 1;
    }
  }

  const data = Array.from(dayMap.entries()).map(([date, v]) => ({
    date,
    totalSales: parseFloat(v.totalSales.toFixed(2)),
    totalOrders: v.totalOrders,
  }));

  res.json(GetSalesByDayResponse.parse(data));
});

router.get("/reports/sales-by-category", async (req, res): Promise<void> => {
  const queryParams = GetSalesByCategoryQueryParams.safeParse(req.query);
  if (!queryParams.success) {
    res.status(400).json({ error: queryParams.error.message });
    return;
  }

  const period = queryParams.data.period ?? "month";
  const { startDate, endDate } = getPeriodDates(period);

  const rows = await db
    .select({
      productId: orderItemsTable.productId,
      revenue: sum(orderItemsTable.total),
    })
    .from(orderItemsTable)
    .innerJoin(ordersTable, eq(orderItemsTable.orderId, ordersTable.id))
    .where(
      and(
        gte(ordersTable.createdAt, startDate),
        lt(ordersTable.createdAt, endDate),
        eq(ordersTable.status, "completed")
      )
    )
    .groupBy(orderItemsTable.productId);

  const productIds = rows.map((r) => r.productId);
  const products = productIds.length > 0
    ? await db
        .select({
          id: productsTable.id,
          categoryId: productsTable.categoryId,
          categoryName: categoriesTable.name,
        })
        .from(productsTable)
        .leftJoin(categoriesTable, eq(productsTable.categoryId, categoriesTable.id))
        .where(and(...productIds.map((id) => eq(productsTable.id, id))))
    : [];

  const productCategoryMap = new Map(products.map((p) => [p.id, { id: p.categoryId, name: p.categoryName }]));

  const categoryRevenue = new Map<string, { id: number | null; totalSales: number }>();

  for (const row of rows) {
    const cat = productCategoryMap.get(row.productId);
    const catName = cat?.name ?? "Uncategorized";
    const existing = categoryRevenue.get(catName);
    if (existing) {
      existing.totalSales += parseFloat(row.revenue ?? "0");
    } else {
      categoryRevenue.set(catName, { id: cat?.id ?? null, totalSales: parseFloat(row.revenue ?? "0") });
    }
  }

  const grandTotal = Array.from(categoryRevenue.values()).reduce((a, c) => a + c.totalSales, 0);

  const data = Array.from(categoryRevenue.entries()).map(([name, v]) => ({
    categoryId: v.id,
    categoryName: name,
    totalSales: parseFloat(v.totalSales.toFixed(2)),
    percentage: grandTotal > 0 ? parseFloat(((v.totalSales / grandTotal) * 100).toFixed(1)) : 0,
  }));

  res.json(GetSalesByCategoryResponse.parse(data));
});

router.get("/reports/recent-activity", async (req, res): Promise<void> => {
  const queryParams = GetRecentActivityQueryParams.safeParse(req.query);
  if (!queryParams.success) {
    res.status(400).json({ error: queryParams.error.message });
    return;
  }

  const limit = queryParams.data.limit ?? 10;

  const orders = await db
    .select({
      order: ordersTable,
      staffName: staffTable.name,
    })
    .from(ordersTable)
    .leftJoin(staffTable, eq(ordersTable.staffId, staffTable.id))
    .orderBy(ordersTable.createdAt)
    .limit(limit);

  const orderIds = orders.map((o) => o.order.id);
  const allItems = orderIds.length > 0
    ? await db
        .select()
        .from(orderItemsTable)
        .where(and(...orderIds.map((id) => eq(orderItemsTable.orderId, id))))
    : [];

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

  res.json(GetRecentActivityResponse.parse(data));
});

export default router;
