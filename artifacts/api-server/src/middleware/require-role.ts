import { Request, Response, NextFunction } from "express";
import { db, staffTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export type StaffRole = "owner" | "admin" | "manager" | "cashier";

export function isOwner(role: string) {
  return role === "owner" || role === "admin";
}

export function isManagerOrAbove(role: string) {
  return role === "owner" || role === "admin" || role === "manager";
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.session.staffId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  next();
}

export function requireOwner(req: Request, res: Response, next: NextFunction): void {
  if (!req.session.staffId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  next();
}

export async function requireOwnerAsync(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!req.session.staffId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const [staff] = await db.select().from(staffTable).where(eq(staffTable.id, req.session.staffId)).limit(1);
  if (!staff || !isOwner(staff.role)) {
    res.status(403).json({ error: "Owner access required" });
    return;
  }
  next();
}

export async function requireManagerAsync(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!req.session.staffId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const [staff] = await db.select().from(staffTable).where(eq(staffTable.id, req.session.staffId)).limit(1);
  if (!staff || !isManagerOrAbove(staff.role)) {
    res.status(403).json({ error: "Manager access required" });
    return;
  }
  next();
}
