import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, staffTable } from "@workspace/db";
import {
  CreateStaffBody,
  UpdateStaffBody,
  UpdateStaffParams,
  DeleteStaffParams,
  ListStaffResponse,
  UpdateStaffResponse,
  DeleteStaffResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

function formatStaff(s: typeof staffTable.$inferSelect) {
  return {
    id: s.id,
    name: s.name,
    role: s.role,
    active: s.active,
    createdAt: s.createdAt.toISOString(),
  };
}

router.get("/staff", async (_req, res): Promise<void> => {
  const staff = await db
    .select()
    .from(staffTable)
    .orderBy(staffTable.name);

  res.json(ListStaffResponse.parse(staff.map(formatStaff)));
});

router.post("/staff", async (req, res): Promise<void> => {
  const parsed = CreateStaffBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [staff] = await db
    .insert(staffTable)
    .values({
      name: parsed.data.name,
      pin: parsed.data.pin,
      role: parsed.data.role,
      active: parsed.data.active ?? true,
    })
    .returning();

  res.status(201).json(formatStaff(staff));
});

router.patch("/staff/:id", async (req, res): Promise<void> => {
  const params = UpdateStaffParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const parsed = UpdateStaffBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updateData: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) updateData.name = parsed.data.name;
  if (parsed.data.pin !== undefined && parsed.data.pin !== null) updateData.pin = parsed.data.pin;
  if (parsed.data.role !== undefined) updateData.role = parsed.data.role;
  if (parsed.data.active !== undefined) updateData.active = parsed.data.active;

  const [staff] = await db
    .update(staffTable)
    .set(updateData)
    .where(eq(staffTable.id, params.data.id))
    .returning();

  if (!staff) {
    res.status(404).json({ error: "Staff not found" });
    return;
  }

  res.json(UpdateStaffResponse.parse(formatStaff(staff)));
});

router.delete("/staff/:id", async (req, res): Promise<void> => {
  const params = DeleteStaffParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const [staff] = await db
    .delete(staffTable)
    .where(eq(staffTable.id, params.data.id))
    .returning();

  if (!staff) {
    res.status(404).json({ error: "Staff not found" });
    return;
  }

  res.json(DeleteStaffResponse.parse({ message: "Staff deleted" }));
});

export default router;
