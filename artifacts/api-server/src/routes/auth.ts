import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, staffTable } from "@workspace/db";
import { LoginBody, LoginResponse, LogoutResponse, GetMeResponse } from "@workspace/api-zod";

declare module "express-session" {
  interface SessionData {
    staffId?: number;
  }
}

const router: IRouter = Router();

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

  const staffData = {
    id: staff.id,
    name: staff.name,
    role: staff.role,
    active: staff.active,
    createdAt: staff.createdAt.toISOString(),
  };

  res.json(LoginResponse.parse({ staff: staffData, message: "Logged in successfully" }));
});

router.post("/auth/logout", async (req, res): Promise<void> => {
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

  const staffData = {
    id: staff.id,
    name: staff.name,
    role: staff.role,
    active: staff.active,
    createdAt: staff.createdAt.toISOString(),
  };

  res.json(GetMeResponse.parse(staffData));
});

export default router;
