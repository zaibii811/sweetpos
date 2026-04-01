import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";

export const settingsTable = pgTable("settings", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  value: text("value").notNull().default(""),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const activityLogTable = pgTable("activity_log", {
  id: serial("id").primaryKey(),
  staffId: integer("staff_id"),
  staffName: text("staff_name"),
  actionType: text("action_type").notNull(),
  description: text("description").notNull(),
  metadata: text("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Setting = typeof settingsTable.$inferSelect;
export type ActivityLog = typeof activityLogTable.$inferSelect;
