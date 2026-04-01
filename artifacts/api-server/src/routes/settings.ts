import { Router, type IRouter } from "express";
import { db, settingsTable, staffTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { isOwner } from "../middleware/require-role";

const router: IRouter = Router();

const DEFAULT_SETTINGS: Record<string, string> = {
  shop_name: "SweetPOS",
  shop_address: "Kuala Lumpur, Malaysia",
  sst_number: "",
  receipt_footer: "Thank you for your purchase!",
  sst_enabled_global: "true",
  payment_methods: JSON.stringify(["cash", "card", "tng", "duitnow"]),
};

async function ensureDefaults() {
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    const existing = await db.select().from(settingsTable).where(eq(settingsTable.key, key)).limit(1);
    if (existing.length === 0) {
      await db.insert(settingsTable).values({ key, value });
    }
  }
}

router.get("/settings", async (req, res): Promise<void> => {
  if (!req.session.staffId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  await ensureDefaults();
  const rows = await db.select().from(settingsTable);
  const result: Record<string, string> = {};
  for (const row of rows) {
    result[row.key] = row.value;
  }
  res.json(result);
});

const UpdateSettingsBody = z.record(z.string(), z.string());

router.patch("/settings", async (req, res): Promise<void> => {
  if (!req.session.staffId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const [staff] = await db.select().from(staffTable).where(eq(staffTable.id, req.session.staffId)).limit(1);
  if (!staff || !isOwner(staff.role)) {
    res.status(403).json({ error: "Owner access required" });
    return;
  }
  const parsed = UpdateSettingsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }
  for (const [key, value] of Object.entries(parsed.data)) {
    const existing = await db.select().from(settingsTable).where(eq(settingsTable.key, key)).limit(1);
    if (existing.length > 0) {
      await db.update(settingsTable).set({ value }).where(eq(settingsTable.key, key));
    } else {
      await db.insert(settingsTable).values({ key, value });
    }
  }
  const rows = await db.select().from(settingsTable);
  const result: Record<string, string> = {};
  for (const row of rows) {
    result[row.key] = row.value;
  }
  res.json(result);
});

export default router;
