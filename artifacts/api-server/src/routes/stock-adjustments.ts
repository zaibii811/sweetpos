import { Router, type IRouter } from "express";
import { desc, eq } from "drizzle-orm";
import { db, stockAdjustmentsTable, productsTable, consumablesTable, staffTable } from "@workspace/db";
import { z } from "zod";

const router: IRouter = Router();

const CreateAdjustmentBody = z.object({
  itemType: z.enum(["product", "consumable"]),
  itemId: z.number().int(),
  adjustmentType: z.enum(["top-up", "deduction"]),
  quantity: z.number().positive(),
  reason: z.string().optional().nullable(),
  staffId: z.number().int().optional().nullable(),
});

function fmt(s: typeof stockAdjustmentsTable.$inferSelect) {
  return {
    id: s.id,
    itemType: s.itemType,
    itemId: s.itemId,
    itemName: s.itemName,
    adjustmentType: s.adjustmentType,
    quantity: parseFloat(s.quantity),
    reason: s.reason,
    staffId: s.staffId,
    staffName: s.staffName,
    createdAt: s.createdAt.toISOString(),
  };
}

router.get("/stock-adjustments", async (req, res): Promise<void> => {
  const limit = Math.min(parseInt(String(req.query.limit || "100"), 10), 500);
  const offset = parseInt(String(req.query.offset || "0"), 10);
  const itemType = req.query.itemType as string | undefined;
  const itemId = req.query.itemId ? parseInt(String(req.query.itemId), 10) : undefined;

  let query = db.select().from(stockAdjustmentsTable);

  const rows = await db
    .select()
    .from(stockAdjustmentsTable)
    .orderBy(desc(stockAdjustmentsTable.createdAt))
    .limit(limit)
    .offset(offset);

  const filtered = rows.filter((r) => {
    if (itemType && r.itemType !== itemType) return false;
    if (itemId && r.itemId !== itemId) return false;
    return true;
  });

  res.json(filtered.map(fmt));
});

router.post("/stock-adjustments", async (req, res): Promise<void> => {
  const parsed = CreateAdjustmentBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { itemType, itemId, adjustmentType, quantity, reason, staffId } = parsed.data;

  let itemName = "Unknown";
  let staffName: string | null = null;

  if (itemType === "product") {
    const [p] = await db.select().from(productsTable).where(eq(productsTable.id, itemId));
    if (!p) { res.status(404).json({ error: "Product not found" }); return; }
    itemName = p.name;
    const delta = adjustmentType === "top-up" ? quantity : -quantity;
    const newStock = Math.max(0, p.stock + Math.round(delta));
    await db.update(productsTable).set({ stock: newStock }).where(eq(productsTable.id, itemId));
  } else {
    const [c] = await db.select().from(consumablesTable).where(eq(consumablesTable.id, itemId));
    if (!c) { res.status(404).json({ error: "Consumable not found" }); return; }
    itemName = c.name;
    const delta = adjustmentType === "top-up" ? quantity : -quantity;
    const newStock = Math.max(0, c.stock + Math.round(delta));
    await db.update(consumablesTable).set({ stock: newStock }).where(eq(consumablesTable.id, itemId));
  }

  if (staffId) {
    const [s] = await db.select().from(staffTable).where(eq(staffTable.id, staffId));
    if (s) staffName = s.name;
  }

  const [adj] = await db.insert(stockAdjustmentsTable).values({
    itemType,
    itemId,
    itemName,
    adjustmentType,
    quantity: String(quantity),
    reason: reason ?? null,
    staffId: staffId ?? null,
    staffName,
  }).returning();

  res.status(201).json(fmt(adj));
});

export default router;
