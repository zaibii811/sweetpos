import { Router, type IRouter } from "express";
import { db, timeEntriesTable, staffTable, shiftsTable } from "@workspace/db";
import { eq, and, isNull, gte, lte, desc } from "drizzle-orm";
import { z } from "zod";

const router: IRouter = Router();

const EditEntryBody = z.object({
  clockInAt: z.string().optional(),
  clockOutAt: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

function getMondayOfWeek(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().split("T")[0];
}

function getHoursWorked(clockIn: Date, clockOut: Date): string {
  const ms = clockOut.getTime() - clockIn.getTime();
  return (ms / 1000 / 3600).toFixed(4);
}

router.get("/time-entries", async (req, res): Promise<void> => {
  if (!req.session.staffId) { res.status(401).json({ error: "Not authenticated" }); return; }

  const { staffId, from, to, active } = req.query;
  let query = db.select().from(timeEntriesTable).$dynamic();

  const conditions = [];
  if (staffId && typeof staffId === "string") conditions.push(eq(timeEntriesTable.staffId, Number(staffId)));
  if (from && typeof from === "string") conditions.push(gte(timeEntriesTable.clockInAt, new Date(from)));
  if (to && typeof to === "string") conditions.push(lte(timeEntriesTable.clockInAt, new Date(to)));
  if (active === "true") conditions.push(isNull(timeEntriesTable.clockOutAt));

  const entries = await db.select()
    .from(timeEntriesTable)
    .where(conditions.length === 1 ? conditions[0] : conditions.length > 1 ? and(...conditions) : undefined)
    .orderBy(desc(timeEntriesTable.clockInAt))
    .limit(500);

  res.json(entries);
});

router.post("/time-entries/clock-in", async (req, res): Promise<void> => {
  const { pin } = req.body;
  if (!pin) { res.status(400).json({ error: "PIN required" }); return; }

  const [staff] = await db.select().from(staffTable).where(eq(staffTable.pin, pin)).limit(1);
  if (!staff || !staff.active) { res.status(401).json({ error: "Invalid PIN or inactive account" }); return; }

  const existing = await db.select().from(timeEntriesTable)
    .where(and(eq(timeEntriesTable.staffId, staff.id), isNull(timeEntriesTable.clockOutAt)))
    .limit(1);

  if (existing.length > 0) {
    res.status(409).json({ error: "Already clocked in", entry: existing[0], staff: { id: staff.id, name: staff.name, role: staff.role } });
    return;
  }

  const now = new Date();
  const weekStart = getMondayOfWeek(now);
  const dayOfWeek = now.getDay() === 0 ? 6 : now.getDay() - 1;

  const [shift] = await db.select().from(shiftsTable)
    .where(and(
      eq(shiftsTable.staffId, staff.id),
      eq(shiftsTable.weekStart, weekStart),
      eq(shiftsTable.dayOfWeek, dayOfWeek)
    ))
    .limit(1);

  let isLate = false;
  let lateMinutes = 0;
  if (shift) {
    const [shiftHour, shiftMin] = shift.startTime.split(":").map(Number);
    const scheduledStart = new Date(now);
    scheduledStart.setHours(shiftHour, shiftMin, 0, 0);
    const diffMs = now.getTime() - scheduledStart.getTime();
    if (diffMs > 5 * 60 * 1000) {
      isLate = true;
      lateMinutes = Math.floor(diffMs / 60000);
    }
  }

  const [entry] = await db.insert(timeEntriesTable).values({
    staffId: staff.id,
    staffName: staff.name,
    clockInAt: now,
    shiftId: shift?.id ?? null,
    isLate,
    lateMinutes,
  }).returning();

  res.json({ entry, staff: { id: staff.id, name: staff.name, role: staff.role }, isLate, lateMinutes, shift: shift ?? null });
});

router.post("/time-entries/clock-out", async (req, res): Promise<void> => {
  const { pin } = req.body;
  if (!pin) { res.status(400).json({ error: "PIN required" }); return; }

  const [staff] = await db.select().from(staffTable).where(eq(staffTable.pin, pin)).limit(1);
  if (!staff || !staff.active) { res.status(401).json({ error: "Invalid PIN or inactive account" }); return; }

  const [activeEntry] = await db.select().from(timeEntriesTable)
    .where(and(eq(timeEntriesTable.staffId, staff.id), isNull(timeEntriesTable.clockOutAt)))
    .limit(1);

  if (!activeEntry) {
    res.status(409).json({ error: "Not clocked in", staff: { id: staff.id, name: staff.name, role: staff.role } });
    return;
  }

  const now = new Date();
  const hoursWorked = getHoursWorked(activeEntry.clockInAt, now);

  const [entry] = await db.update(timeEntriesTable)
    .set({ clockOutAt: now, hoursWorked })
    .where(eq(timeEntriesTable.id, activeEntry.id))
    .returning();

  res.json({ entry, staff: { id: staff.id, name: staff.name, role: staff.role }, hoursWorked: parseFloat(hoursWorked) });
});

router.get("/time-entries/active/:staffId", async (req, res): Promise<void> => {
  if (!req.session.staffId) { res.status(401).json({ error: "Not authenticated" }); return; }
  const staffId = Number(req.params.staffId);
  const [entry] = await db.select().from(timeEntriesTable)
    .where(and(eq(timeEntriesTable.staffId, staffId), isNull(timeEntriesTable.clockOutAt)))
    .limit(1);
  res.json({ activeEntry: entry ?? null });
});

router.patch("/time-entries/:id", async (req, res): Promise<void> => {
  if (!req.session.staffId) { res.status(401).json({ error: "Not authenticated" }); return; }
  const id = Number(req.params.id);
  const parsed = EditEntryBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const updates: Record<string, unknown> = { isManualEdit: true, editedByStaffId: req.session.staffId };
  if (parsed.data.clockInAt) updates.clockInAt = new Date(parsed.data.clockInAt);
  if (parsed.data.clockOutAt !== undefined) updates.clockOutAt = parsed.data.clockOutAt ? new Date(parsed.data.clockOutAt) : null;
  if (parsed.data.notes !== undefined) updates.notes = parsed.data.notes;

  if (updates.clockInAt && updates.clockOutAt) {
    updates.hoursWorked = getHoursWorked(updates.clockInAt as Date, updates.clockOutAt as Date);
  }

  const [entry] = await db.update(timeEntriesTable).set(updates as any).where(eq(timeEntriesTable.id, id)).returning();
  if (!entry) { res.status(404).json({ error: "Entry not found" }); return; }
  res.json(entry);
});

router.delete("/time-entries/:id", async (req, res): Promise<void> => {
  if (!req.session.staffId) { res.status(401).json({ error: "Not authenticated" }); return; }
  const id = Number(req.params.id);
  const [entry] = await db.delete(timeEntriesTable).where(eq(timeEntriesTable.id, id)).returning();
  if (!entry) { res.status(404).json({ error: "Entry not found" }); return; }
  res.json({ success: true });
});

export default router;
