import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, staffTable } from "@workspace/db";
import bcrypt from "bcryptjs";
import {
  CreateStaffBody,
  UpdateStaffBody,
  UpdateStaffParams,
  DeleteStaffParams,
  ListStaffResponse,
  UpdateStaffResponse,
  DeleteStaffResponse,
} from "@workspace/api-zod";
import { z } from "zod";

const router: IRouter = Router();

function formatStaff(s: typeof staffTable.$inferSelect) {
  return {
    id: s.id,
    name: s.name,
    role: s.role,
    active: s.active,
    username: s.username ?? undefined,
    createdAt: s.createdAt.toISOString(),
  };
}

const ExtendedCreateBody = z.object({
  name: z.string(),
  pin: z.string(),
  role: z.string().optional(),
  active: z.boolean().optional(),
  username: z.string().optional(),
  password: z.string().optional(),
});

const ExtendedUpdateBody = z.object({
  name: z.string().optional(),
  pin: z.string().optional(),
  role: z.string().optional(),
  active: z.boolean().optional(),
  username: z.string().optional().nullable(),
  password: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  hourlyRate: z.string().optional().nullable(),
  photoUrl: z.string().optional().nullable(),
});

router.get("/staff", async (_req, res): Promise<void> => {
  const staff = await db
    .select()
    .from(staffTable)
    .orderBy(staffTable.name);
  res.json(ListStaffResponse.parse(staff.map(formatStaff)));
});

router.post("/staff", async (req, res): Promise<void> => {
  const parsed = ExtendedCreateBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const values: Record<string, unknown> = {
    name: parsed.data.name,
    pin: parsed.data.pin,
    role: parsed.data.role ?? "cashier",
    active: parsed.data.active ?? true,
  };

  if (parsed.data.username) values.username = parsed.data.username;
  if (parsed.data.password) values.passwordHash = await bcrypt.hash(parsed.data.password, 10);

  const [staff] = await db.insert(staffTable).values(values as any).returning();
  res.status(201).json(formatStaff(staff));
});

router.patch("/staff/:id", async (req, res): Promise<void> => {
  const params = UpdateStaffParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const parsed = ExtendedUpdateBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updateData: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) updateData.name = parsed.data.name;
  if (parsed.data.pin !== undefined && parsed.data.pin !== null) updateData.pin = parsed.data.pin;
  if (parsed.data.role !== undefined) updateData.role = parsed.data.role;
  if (parsed.data.active !== undefined) updateData.active = parsed.data.active;
  if (parsed.data.username !== undefined) updateData.username = parsed.data.username;
  if (parsed.data.phone !== undefined) updateData.phone = parsed.data.phone;
  if (parsed.data.hourlyRate !== undefined) updateData.hourlyRate = parsed.data.hourlyRate;
  if (parsed.data.photoUrl !== undefined) updateData.photoUrl = parsed.data.photoUrl;
  if (parsed.data.password) {
    updateData.passwordHash = await bcrypt.hash(parsed.data.password, 10);
  } else if (parsed.data.password === null) {
    updateData.passwordHash = null;
  }

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
