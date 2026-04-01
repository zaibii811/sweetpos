import { Router, type IRouter } from "express";
import { eq, and, SQL } from "drizzle-orm";
import { db, consumablesTable } from "@workspace/db";
import { z } from "zod";

const router: IRouter = Router();

const CreateConsumableBody = z.object({
  name: z.string().min(1),
  unit: z.string().default("pieces"),
  stock: z.number().int().default(0),
  lowStockThreshold: z.number().int().default(50),
  costPerUnit: z.number().optional().nullable(),
  active: z.boolean().default(true),
});

const UpdateConsumableBody = CreateConsumableBody.partial();

function fmt(c: typeof consumablesTable.$inferSelect) {
  return {
    id: c.id,
    name: c.name,
    unit: c.unit,
    stock: c.stock,
    lowStockThreshold: c.lowStockThreshold,
    costPerUnit: c.costPerUnit ? parseFloat(c.costPerUnit) : null,
    active: c.active,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  };
}

router.get("/consumables", async (_req, res): Promise<void> => {
  const rows = await db.select().from(consumablesTable).orderBy(consumablesTable.name);
  res.json(rows.map(fmt));
});

router.post("/consumables", async (req, res): Promise<void> => {
  const parsed = CreateConsumableBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [row] = await db.insert(consumablesTable).values({
    ...parsed.data,
    costPerUnit: parsed.data.costPerUnit != null ? String(parsed.data.costPerUnit) : null,
  }).returning();
  res.status(201).json(fmt(row));
});

router.patch("/consumables/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
  const parsed = UpdateConsumableBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const updateData: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.costPerUnit !== undefined) {
    updateData.costPerUnit = parsed.data.costPerUnit != null ? String(parsed.data.costPerUnit) : null;
  }
  const [row] = await db.update(consumablesTable).set(updateData).where(eq(consumablesTable.id, id)).returning();
  if (!row) { res.status(404).json({ error: "Consumable not found" }); return; }
  res.json(fmt(row));
});

router.delete("/consumables/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
  const [row] = await db.delete(consumablesTable).where(eq(consumablesTable.id, id)).returning();
  if (!row) { res.status(404).json({ error: "Consumable not found" }); return; }
  res.json({ message: "Consumable deleted" });
});

export default router;
