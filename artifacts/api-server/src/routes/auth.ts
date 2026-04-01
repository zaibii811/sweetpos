import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, staffTable } from "@workspace/db";
import bcrypt from "bcryptjs";
import { LoginBody, LoginResponse, LogoutResponse, GetMeResponse } from "@workspace/api-zod";
import { z } from "zod";
import { logActivity } from "./activity-log";

declare module "express-session" {
  interface SessionData {
    staffId?: number;
  }
}

const router: IRouter = Router();

const PasswordLoginBody = z.object({
  username: z.string(),
  password: z.string(),
});

function buildStaffData(staff: typeof staffTable.$inferSelect) {
  return {
    id: staff.id,
    name: staff.name,
    role: staff.role,
    active: staff.active,
    createdAt: staff.createdAt.toISOString(),
  };
}

router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }

  const { pin } = parsed.data;

  const [staff] = await db
    .select()
    .from(staffTable)
    .where(eq(staffTable.pin, pin))
    .limit(1);

  if (!staff || !staff.active) {
    res.status(401).json({ error: "Invalid PIN or account inactive" });
    return;
  }

  req.session.staffId = staff.id;
  await logActivity(staff.id, staff.name, "auth.login", `${staff.name} logged in via PIN`);

  res.json(LoginResponse.parse({ staff: buildStaffData(staff), message: "Logged in successfully" }));
});

router.post("/auth/login-password", async (req, res): Promise<void> => {
  const parsed = PasswordLoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Username and password required" });
    return;
  }

  const { username, password } = parsed.data;

  const [staff] = await db
    .select()
    .from(staffTable)
    .where(eq(staffTable.username, username))
    .limit(1);

  if (!staff || !staff.active || !staff.passwordHash) {
    res.status(401).json({ error: "Invalid username or password" });
    return;
  }

  const valid = await bcrypt.compare(password, staff.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Invalid username or password" });
    return;
  }

  req.session.staffId = staff.id;
  await logActivity(staff.id, staff.name, "auth.login", `${staff.name} logged in via username/password`);

  res.json(LoginResponse.parse({ staff: buildStaffData(staff), message: "Logged in successfully" }));
});

router.post("/auth/logout", async (req, res): Promise<void> => {
  if (req.session.staffId) {
    const [staff] = await db.select().from(staffTable).where(eq(staffTable.id, req.session.staffId)).limit(1);
    if (staff) {
      await logActivity(staff.id, staff.name, "auth.logout", `${staff.name} logged out`);
    }
  }
  req.session.destroy(() => {
    res.json(LogoutResponse.parse({ message: "Logged out successfully" }));
  });
});

router.get("/auth/me", async (req, res): Promise<void> => {
  if (!req.session.staffId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const [staff] = await db
    .select()
    .from(staffTable)
    .where(eq(staffTable.id, req.session.staffId))
    .limit(1);

  if (!staff || !staff.active) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  res.json(GetMeResponse.parse(buildStaffData(staff)));
});

export default router;
