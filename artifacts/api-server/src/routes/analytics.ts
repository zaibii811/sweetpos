import { Router, type IRouter } from "express";
import { eq, gte, lte, and, sum, count, avg, isNull, isNotNull, lt } from "drizzle-orm";
import {
  db, ordersTable, orderItemsTable, productsTable, categoriesTable,
  consumablesTable, stockAdjustmentsTable, staffTable, timeEntriesTable,
} from "@workspace/db";
import { z } from "zod";

const router: IRouter = Router();

function todayRange(): { startDate: Date; endDate: Date } {
  const now = new Date();
  const startDate = new Date(now); startDate.setHours(0, 0, 0, 0);
  const endDate = new Date(now); endDate.setHours(23, 59, 59, 999);
  return { startDate, endDate };
}

function dateRange(from: string, to: string): { startDate: Date; endDate: Date } {
  const startDate = new Date(from); startDate.setHours(0, 0, 0, 0);
  const endDate = new Date(to); endDate.setHours(23, 59, 59, 999);
  return { startDate, endDate };
}

/* ─── Dashboard ──────────────────────────────────────────────────── */
router.get("/reports/dashboard", async (req, res): Promise<void> => {
  if (!req.session.staffId) { res.status(401).json({ error: "Not authenticated" }); return; }
  const { startDate, endDate } = todayRange();

  const [todaySummary] = await db.select({
    totalSales: sum(ordersTable.total),
    totalTransactions: count(ordersTable.id),
    sstCollected: sum(ordersTable.taxTotal),
  }).from(ordersTable).where(and(
    gte(ordersTable.createdAt, startDate),
    lte(ordersTable.createdAt, endDate),
    eq(ordersTable.status, "completed"),
  ));

  const topProductsRaw = await db.select({
    productId: orderItemsTable.productId,
    productName: orderItemsTable.productName,
    quantity: sum(orderItemsTable.quantity),
    revenue: sum(orderItemsTable.total),
  }).from(orderItemsTable)
    .innerJoin(ordersTable, eq(orderItemsTable.orderId, ordersTable.id))
    .where(and(gte(ordersTable.createdAt, startDate), lte(ordersTable.createdAt, endDate), eq(ordersTable.status, "completed")))
    .groupBy(orderItemsTable.productId, orderItemsTable.productName)
    .orderBy(sum(orderItemsTable.total))
    .limit(5);

  const allProducts = await db.select({ id: productsTable.id, stock: productsTable.stock, lowStockThreshold: productsTable.lowStockThreshold, active: productsTable.active }).from(productsTable);
  const allConsumables = await db.select({ id: consumablesTable.id, stock: consumablesTable.stock, lowStockThreshold: consumablesTable.lowStockThreshold, active: consumablesTable.active }).from(consumablesTable);
  const lowStockCount = allProducts.filter(p => p.active && p.stock <= p.lowStockThreshold).length + allConsumables.filter(c => c.active && c.stock <= c.lowStockThreshold).length;

  const today = new Date();
  const in14Days = new Date(); in14Days.setDate(today.getDate() + 14);
  const todayStr = today.toISOString().split("T")[0];
  const in14DaysStr = in14Days.toISOString().split("T")[0];
  const allProductsForExpiry = await db.select({ expiryDate: productsTable.expiryDate, active: productsTable.active }).from(productsTable);
  const expiringCount = allProductsForExpiry.filter(p => p.active && p.expiryDate && p.expiryDate >= todayStr && p.expiryDate <= in14DaysStr).length;

  const activeClockEntries = await db.select({
    staffId: timeEntriesTable.staffId,
    staffName: timeEntriesTable.staffName,
    clockInAt: timeEntriesTable.clockInAt,
  }).from(timeEntriesTable).where(isNull(timeEntriesTable.clockOutAt));

  res.json({
    today: {
      totalSales: parseFloat(todaySummary.totalSales ?? "0"),
      totalTransactions: Number(todaySummary.totalTransactions ?? 0),
      sstCollected: parseFloat(todaySummary.sstCollected ?? "0"),
      topProducts: topProductsRaw.map(r => ({
        productId: r.productId,
        productName: r.productName,
        quantity: Number(r.quantity ?? 0),
        revenue: parseFloat(r.revenue ?? "0"),
      })),
    },
    lowStockCount,
    expiringCount,
    activeStaff: activeClockEntries.map(e => ({
      staffId: e.staffId,
      staffName: e.staffName,
      clockInAt: e.clockInAt.toISOString(),
    })),
  });
});

/* ─── Detailed Sales ─────────────────────────────────────────────── */
router.get("/reports/detailed-sales", async (req, res): Promise<void> => {
  if (!req.session.staffId) { res.status(401).json({ error: "Not authenticated" }); return; }
  const { from, to } = req.query;
  if (!from || !to) { res.status(400).json({ error: "from and to required" }); return; }
  const { startDate, endDate } = dateRange(from as string, to as string);

  const completedOrders = await db.select({
    id: ordersTable.id,
    total: ordersTable.total,
    subtotal: ordersTable.subtotal,
    taxTotal: ordersTable.taxTotal,
    paymentMethod: ordersTable.paymentMethod,
    createdAt: ordersTable.createdAt,
  }).from(ordersTable).where(and(
    gte(ordersTable.createdAt, startDate),
    lte(ordersTable.createdAt, endDate),
    eq(ordersTable.status, "completed"),
  ));

  const totalRevenue = completedOrders.reduce((s, o) => s + parseFloat(o.total), 0);
  const totalTransactions = completedOrders.length;
  const avgOrderValue = totalTransactions > 0 ? totalRevenue / totalTransactions : 0;
  const sstCollected = completedOrders.reduce((s, o) => s + parseFloat(o.taxTotal), 0);

  const paymentBreakdown: Record<string, { revenue: number; count: number }> = {};
  for (const o of completedOrders) {
    const m = o.paymentMethod ?? "unknown";
    if (!paymentBreakdown[m]) paymentBreakdown[m] = { revenue: 0, count: 0 };
    paymentBreakdown[m].revenue += parseFloat(o.total);
    paymentBreakdown[m].count += 1;
  }

  const orderIds = completedOrders.map(o => o.id);
  const allItems = orderIds.length > 0
    ? await db.select({
        orderId: orderItemsTable.orderId,
        productId: orderItemsTable.productId,
        productName: orderItemsTable.productName,
        quantity: orderItemsTable.quantity,
        total: orderItemsTable.total,
        tax: orderItemsTable.tax,
        taxRate: orderItemsTable.taxRate,
      }).from(orderItemsTable).where(
        orderIds.length === 1
          ? eq(orderItemsTable.orderId, orderIds[0])
          : and(...orderIds.map(id => eq(orderItemsTable.orderId, id)))
      )
    : [];

  const allProductIds = [...new Set(allItems.map(i => i.productId))];
  const productDetails = allProductIds.length > 0
    ? await db.select({
        id: productsTable.id,
        productType: productsTable.productType,
        categoryId: productsTable.categoryId,
      }).from(productsTable)
    : [];
  const categoryDetails = await db.select({ id: categoriesTable.id, name: categoriesTable.name }).from(categoriesTable);
  const categoryMap = new Map(categoryDetails.map(c => [c.id, c.name]));
  const productMap = new Map(productDetails.map(p => [p.id, p]));

  const productSummary: Record<number, { productId: number; productName: string; quantity: number; revenue: number; isWeightBased: boolean; weightGrams: number }> = {};
  const categoryRevenue: Record<string, number> = {};

  for (const item of allItems) {
    const p = productMap.get(item.productId);
    const isWeightBased = p?.productType === "weight";
    const catId = p?.categoryId;
    const catName = catId ? (categoryMap.get(catId) ?? "Uncategorized") : "Uncategorized";

    if (!productSummary[item.productId]) {
      productSummary[item.productId] = { productId: item.productId, productName: item.productName, quantity: 0, revenue: 0, isWeightBased, weightGrams: 0 };
    }
    productSummary[item.productId].quantity += item.quantity;
    productSummary[item.productId].revenue += parseFloat(item.total);
    if (isWeightBased) productSummary[item.productId].weightGrams += item.quantity;

    categoryRevenue[catName] = (categoryRevenue[catName] ?? 0) + parseFloat(item.total);
  }

  const topProducts = Object.values(productSummary)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10)
    .map(p => ({
      ...p,
      weightKg: p.isWeightBased ? parseFloat((p.weightGrams / 1000).toFixed(3)) : null,
    }));

  const bagAdjustments = await db.select({
    itemId: stockAdjustmentsTable.itemId,
    itemName: stockAdjustmentsTable.itemName,
    quantity: stockAdjustmentsTable.quantity,
  }).from(stockAdjustmentsTable).where(and(
    eq(stockAdjustmentsTable.itemType, "consumable"),
    eq(stockAdjustmentsTable.adjustmentType, "deduct"),
    gte(stockAdjustmentsTable.createdAt, startDate),
    lte(stockAdjustmentsTable.createdAt, endDate),
  ));
  const bagUsageSummary: Record<number, { consumableId: number; name: string; totalUsed: number }> = {};
  for (const adj of bagAdjustments) {
    if (!bagUsageSummary[adj.itemId]) bagUsageSummary[adj.itemId] = { consumableId: adj.itemId, name: adj.itemName, totalUsed: 0 };
    bagUsageSummary[adj.itemId].totalUsed += parseFloat(adj.quantity as any);
  }

  res.json({
    totalRevenue: parseFloat(totalRevenue.toFixed(2)),
    totalTransactions,
    avgOrderValue: parseFloat(avgOrderValue.toFixed(2)),
    sstCollected: parseFloat(sstCollected.toFixed(2)),
    categoryBreakdown: Object.entries(categoryRevenue).map(([category, revenue]) => ({ category, revenue: parseFloat(revenue.toFixed(2)) })).sort((a, b) => b.revenue - a.revenue),
    paymentBreakdown: Object.entries(paymentBreakdown).map(([method, v]) => ({ method, revenue: parseFloat(v.revenue.toFixed(2)), count: v.count })).sort((a, b) => b.revenue - a.revenue),
    topProducts,
    bagUsage: Object.values(bagUsageSummary),
  });
});

/* ─── Inventory Status ───────────────────────────────────────────── */
router.get("/reports/inventory-status", async (req, res): Promise<void> => {
  if (!req.session.staffId) { res.status(401).json({ error: "Not authenticated" }); return; }

  const allProducts = await db.select({
    id: productsTable.id, name: productsTable.name, stock: productsTable.stock,
    lowStockThreshold: productsTable.lowStockThreshold, expiryDate: productsTable.expiryDate,
    active: productsTable.active, productType: productsTable.productType, sku: productsTable.sku,
    categoryId: productsTable.categoryId,
  }).from(productsTable).where(eq(productsTable.active, true));

  const allConsumables = await db.select().from(consumablesTable).where(eq(consumablesTable.active, true));
  const categoryDetails = await db.select({ id: categoriesTable.id, name: categoriesTable.name }).from(categoriesTable);
  const categoryMap = new Map(categoryDetails.map(c => [c.id, c.name]));

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const in14 = new Date(today); in14.setDate(today.getDate() + 14);
  const todayStr = today.toISOString().split("T")[0];
  const in14Str = in14.toISOString().split("T")[0];

  const products = allProducts.map(p => {
    const isLow = p.stock <= p.lowStockThreshold;
    const isExpired = !!(p.expiryDate && p.expiryDate < todayStr);
    const isExpiring = !!(p.expiryDate && !isExpired && p.expiryDate <= in14Str);
    return {
      ...p,
      categoryName: p.categoryId ? (categoryMap.get(p.categoryId) ?? "—") : "—",
      isLow,
      isExpiring,
      isExpired,
    };
  });

  const consumables = allConsumables.map(c => ({ ...c, isLow: c.stock <= c.lowStockThreshold }));

  res.json({
    products: products.sort((a, b) => a.name.localeCompare(b.name)),
    consumables: consumables.sort((a, b) => a.name.localeCompare(b.name)),
    lowStockProducts: products.filter(p => p.isLow).length,
    lowStockConsumables: consumables.filter(c => c.isLow).length,
    expiringCount: products.filter(p => p.isExpiring).length,
    expiredCount: products.filter(p => p.isExpired).length,
  });
});

/* ─── Bag Usage Over Time ─────────────────────────────────────────── */
router.get("/reports/bag-usage", async (req, res): Promise<void> => {
  if (!req.session.staffId) { res.status(401).json({ error: "Not authenticated" }); return; }
  const { from, to } = req.query;
  if (!from || !to) { res.status(400).json({ error: "from and to required" }); return; }
  const { startDate, endDate } = dateRange(from as string, to as string);

  const adjustments = await db.select({
    itemId: stockAdjustmentsTable.itemId,
    itemName: stockAdjustmentsTable.itemName,
    quantity: stockAdjustmentsTable.quantity,
    createdAt: stockAdjustmentsTable.createdAt,
    adjustmentType: stockAdjustmentsTable.adjustmentType,
  }).from(stockAdjustmentsTable).where(and(
    eq(stockAdjustmentsTable.itemType, "consumable"),
    gte(stockAdjustmentsTable.createdAt, startDate),
    lte(stockAdjustmentsTable.createdAt, endDate),
  ));

  const byDay: Record<string, Record<string, number>> = {};
  for (const adj of adjustments) {
    const day = adj.createdAt.toISOString().split("T")[0];
    if (!byDay[day]) byDay[day] = {};
    if (!byDay[day][adj.itemName]) byDay[day][adj.itemName] = 0;
    if (adj.adjustmentType === "deduct") byDay[day][adj.itemName] += parseFloat(adj.quantity as any);
  }

  const allConsumables = await db.select({ id: consumablesTable.id, name: consumablesTable.name, stock: consumablesTable.stock }).from(consumablesTable).where(eq(consumablesTable.active, true));

  res.json({
    byDay: Object.entries(byDay).sort(([a], [b]) => a.localeCompare(b)).map(([date, usage]) => ({ date, ...usage })),
    currentStock: allConsumables.map(c => ({ id: c.id, name: c.name, stock: c.stock })),
  });
});

export default router;
