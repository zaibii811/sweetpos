import { Router, type IRouter } from "express";
import { db, activityLogTable, staffTable } from "@workspace/db";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { requireManagerAsync } from "../middleware/require-role";

const router: IRouter = Router();

const CreateLogBody = z.object({
  actionType: z.string(),
  description: z.string(),
  metadata: z.string().optional(),
});

export async function logActivity(
  staffId: number | null,
  staffName: string | null,
  actionType: string,
  description: string,
  metadata?: object
) {
  try {
    await db.insert(activityLogTable).values({
      staffId,
      staffName,
      actionType,
      description,
      metadata: metadata ? JSON.stringify(metadata) : null,
    });
  } catch (_) {}
}

router.get("/activity-log", requireManagerAsync, async (req, res): Promise<void> => {
  const limit = Math.min(Number(req.query.limit) || 100, 500);
  const logs = await db
    .select()
    .from(activityLogTable)
    .orderBy(desc(activityLogTable.createdAt))
    .limit(limit);
  res.json(logs);
});

router.post("/activity-log", async (req, res): Promise<void> => {
  if (!req.session.staffId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const parsed = CreateLogBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }
  const [staff] = await db.select().from(staffTable).where(eq(staffTable.id, req.session.staffId)).limit(1);
  await logActivity(
    req.session.staffId,
    staff?.name ?? null,
    parsed.data.actionType,
    parsed.data.description,
    parsed.data.metadata ? { raw: parsed.data.metadata } : undefined
  );
  res.json({ success: true });
});

export default router;
