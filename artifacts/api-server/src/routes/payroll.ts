import { Router, type IRouter } from "express";
import { db, timeEntriesTable, staffTable } from "@workspace/db";
import { and, gte, lte, eq, isNotNull } from "drizzle-orm";
import { z } from "zod";

const router: IRouter = Router();

router.get("/payroll/summary", async (req, res): Promise<void> => {
  if (!req.session.staffId) { res.status(401).json({ error: "Not authenticated" }); return; }

  const { from, to } = req.query;
  if (!from || !to) { res.status(400).json({ error: "from and to query params required" }); return; }

  const fromDate = new Date(from as string);
  const toDate = new Date(to as string);
  toDate.setHours(23, 59, 59, 999);

  const allStaff = await db.select().from(staffTable).where(eq(staffTable.active, true));
  const entries = await db.select().from(timeEntriesTable)
    .where(and(
      gte(timeEntriesTable.clockInAt, fromDate),
      lte(timeEntriesTable.clockInAt, toDate),
      isNotNull(timeEntriesTable.clockOutAt)
    ));

  const summary = allStaff.map(staff => {
    const staffEntries = entries.filter(e => e.staffId === staff.id);
    const totalHours = staffEntries.reduce((sum, e) => sum + parseFloat(e.hoursWorked ?? "0"), 0);
    const lateCount = staffEntries.filter(e => e.isLate).length;
    const overtimeDays = staffEntries.filter(e => parseFloat(e.hoursWorked ?? "0") > 8).length;
    const hourlyRate = parseFloat(staff.hourlyRate ?? "0");
    const estimatedPay = totalHours * hourlyRate;

    const entriesByDay: Record<string, number> = {};
    for (const e of staffEntries) {
      const day = e.clockInAt.toISOString().split("T")[0];
      entriesByDay[day] = (entriesByDay[day] ?? 0) + parseFloat(e.hoursWorked ?? "0");
    }
    const overtimeDaysDetail = Object.entries(entriesByDay)
      .filter(([, h]) => h > 8)
      .map(([d]) => d);

    return {
      staffId: staff.id,
      staffName: staff.name,
      role: staff.role,
      hourlyRate: staff.hourlyRate ?? "0",
      totalHours: parseFloat(totalHours.toFixed(2)),
      lateCount,
      overtimeDays,
      overtimeDaysDetail,
      estimatedPay: parseFloat(estimatedPay.toFixed(2)),
      entryCount: staffEntries.length,
    };
  });

  res.json({ from: fromDate.toISOString(), to: toDate.toISOString(), summary });
});

export default router;
