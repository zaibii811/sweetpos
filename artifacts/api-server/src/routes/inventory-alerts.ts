import { Router, type IRouter } from "express";
import { lte, and, eq } from "drizzle-orm";
import { db, productsTable, consumablesTable } from "@workspace/db";
import { sql } from "drizzle-orm";

const router: IRouter = Router();

router.get("/inventory/alerts", async (_req, res): Promise<void> => {
  const today = new Date();
  const sevenDaysLater = new Date(today);
  sevenDaysLater.setDate(today.getDate() + 7);
  const sevenDaysStr = sevenDaysLater.toISOString().slice(0, 10);
  const todayStr = today.toISOString().slice(0, 10);

  const products = await db
    .select({
      id: productsTable.id,
      name: productsTable.name,
      stock: productsTable.stock,
      lowStockThreshold: productsTable.lowStockThreshold,
      expiryDate: productsTable.expiryDate,
      productType: productsTable.productType,
    })
    .from(productsTable)
    .where(eq(productsTable.active, true));

  const consumables = await db
    .select({
      id: consumablesTable.id,
      name: consumablesTable.name,
      stock: consumablesTable.stock,
      lowStockThreshold: consumablesTable.lowStockThreshold,
    })
    .from(consumablesTable)
    .where(eq(consumablesTable.active, true));

  const lowStockProducts = products.filter((p) => p.stock <= p.lowStockThreshold);
  const expiringProducts = products.filter((p) => {
    if (!p.expiryDate) return false;
    return p.expiryDate >= todayStr && p.expiryDate <= sevenDaysStr;
  });
  const expiredProducts = products.filter((p) => {
    if (!p.expiryDate) return false;
    return p.expiryDate < todayStr;
  });
  const lowStockConsumables = consumables.filter((c) => c.stock <= c.lowStockThreshold);

  res.json({
    lowStockProducts: lowStockProducts.map((p) => ({
      id: p.id,
      name: p.name,
      stock: p.stock,
      threshold: p.lowStockThreshold,
      productType: p.productType,
    })),
    expiringProducts: expiringProducts.map((p) => ({
      id: p.id,
      name: p.name,
      expiryDate: p.expiryDate,
      daysLeft: Math.ceil((new Date(p.expiryDate!).getTime() - today.getTime()) / 86400000),
    })),
    expiredProducts: expiredProducts.map((p) => ({
      id: p.id,
      name: p.name,
      expiryDate: p.expiryDate,
    })),
    lowStockConsumables: lowStockConsumables.map((c) => ({
      id: c.id,
      name: c.name,
      stock: c.stock,
      threshold: c.lowStockThreshold,
    })),
    totalAlertCount:
      lowStockProducts.length + expiringProducts.length + expiredProducts.length + lowStockConsumables.length,
  });
});

export default router;
