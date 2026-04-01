import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, bagSizeRulesTable, consumablesTable } from "@workspace/db";
import { z } from "zod";

const router: IRouter = Router();

const BagSizeRuleBody = z.object({
  name: z.string().min(1),
  maxWeightGrams: z.number().int().positive(),
  consumableId: z.number().int().nullable().optional(),
});

function fmt(r: typeof bagSizeRulesTable.$inferSelect) {
  return {
    id: r.id,
    name: r.name,
    maxWeightGrams: r.maxWeightGrams,
    consumableId: r.consumableId,
    createdAt: r.createdAt.toISOString(),
  };
}

router.get("/bag-size-rules", async (_req, res): Promise<void> => {
  const rows = await db.select().from(bagSizeRulesTable).orderBy(bagSizeRulesTable.maxWeightGrams);
  res.json(rows.map(fmt));
});

router.post("/bag-size-rules", async (req, res): Promise<void> => {
  const parsed = BagSizeRuleBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [row] = await db.insert(bagSizeRulesTable).values({
    name: parsed.data.name,
    maxWeightGrams: parsed.data.maxWeightGrams,
    consumableId: parsed.data.consumableId ?? null,
  }).returning();
  res.status(201).json(fmt(row));
});

router.patch("/bag-size-rules/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
  const parsed = BagSizeRuleBody.partial().safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [row] = await db.update(bagSizeRulesTable).set(parsed.data).where(eq(bagSizeRulesTable.id, id)).returning();
  if (!row) { res.status(404).json({ error: "Rule not found" }); return; }
  res.json(fmt(row));
});

router.delete("/bag-size-rules/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
  await db.delete(bagSizeRulesTable).where(eq(bagSizeRulesTable.id, id));
  res.json({ message: "Rule deleted" });
});

export default router;
