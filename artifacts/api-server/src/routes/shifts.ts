import { Router, type IRouter } from "express";
import { db, shiftsTable, staffTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { z } from "zod";

const router: IRouter = Router();

const UpsertShiftBody = z.object({
  staffId: z.number(),
  weekStart: z.string(),
  dayOfWeek: z.number().min(0).max(6),
  startTime: z.string(),
  endTime: z.string(),
  shiftRole: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

const CopyWeekBody = z.object({
  fromWeek: z.string(),
  toWeek: z.string(),
});

router.get("/shifts", async (req, res): Promise<void> => {
  if (!req.session.staffId) { res.status(401).json({ error: "Not authenticated" }); return; }
  const { weekStart } = req.query;
  if (!weekStart || typeof weekStart !== "string") {
    res.status(400).json({ error: "weekStart query param required" });
    return;
  }
  const shifts = await db.select().from(shiftsTable).where(eq(shiftsTable.weekStart, weekStart));
  res.json(shifts);
});

router.post("/shifts", async (req, res): Promise<void> => {
  if (!req.session.staffId) { res.status(401).json({ error: "Not authenticated" }); return; }
  const parsed = UpsertShiftBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { staffId, weekStart, dayOfWeek, startTime, endTime, shiftRole, notes } = parsed.data;

  const existing = await db.select().from(shiftsTable)
    .where(and(
      eq(shiftsTable.staffId, staffId),
      eq(shiftsTable.weekStart, weekStart),
      eq(shiftsTable.dayOfWeek, dayOfWeek)
    ))
    .limit(1);

  let shift;
  if (existing.length > 0) {
    [shift] = await db.update(shiftsTable)
      .set({ startTime, endTime, shiftRole: shiftRole ?? null, notes: notes ?? null })
      .where(eq(shiftsTable.id, existing[0].id))
      .returning();
  } else {
    [shift] = await db.insert(shiftsTable)
      .values({ staffId, weekStart, dayOfWeek, startTime, endTime, shiftRole: shiftRole ?? null, notes: notes ?? null })
      .returning();
  }
  res.json(shift);
});

router.delete("/shifts/:id", async (req, res): Promise<void> => {
  if (!req.session.staffId) { res.status(401).json({ error: "Not authenticated" }); return; }
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
  const [shift] = await db.delete(shiftsTable).where(eq(shiftsTable.id, id)).returning();
  if (!shift) { res.status(404).json({ error: "Shift not found" }); return; }
  res.json({ success: true });
});

router.post("/shifts/copy-week", async (req, res): Promise<void> => {
  if (!req.session.staffId) { res.status(401).json({ error: "Not authenticated" }); return; }
  const parsed = CopyWeekBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { fromWeek, toWeek } = parsed.data;
  const sourceShifts = await db.select().from(shiftsTable).where(eq(shiftsTable.weekStart, fromWeek));

  if (sourceShifts.length === 0) {
    res.json({ copied: 0 });
    return;
  }

  await db.delete(shiftsTable).where(eq(shiftsTable.weekStart, toWeek));

  const newShifts = await db.insert(shiftsTable)
    .values(sourceShifts.map(s => ({
      staffId: s.staffId,
      weekStart: toWeek,
      dayOfWeek: s.dayOfWeek,
      startTime: s.startTime,
      endTime: s.endTime,
      shiftRole: s.shiftRole,
      notes: s.notes,
    })))
    .returning();

  res.json({ copied: newShifts.length, shifts: newShifts });
});

export default router;
