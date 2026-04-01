import { pgTable, text, serial, timestamp, boolean, integer, numeric } from "drizzle-orm/pg-core";

export const shiftsTable = pgTable("shifts", {
  id: serial("id").primaryKey(),
  staffId: integer("staff_id").notNull(),
  weekStart: text("week_start").notNull(),
  dayOfWeek: integer("day_of_week").notNull(),
  startTime: text("start_time").notNull(),
  endTime: text("end_time").notNull(),
  shiftRole: text("shift_role"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const timeEntriesTable = pgTable("time_entries", {
  id: serial("id").primaryKey(),
  staffId: integer("staff_id").notNull(),
  staffName: text("staff_name"),
  clockInAt: timestamp("clock_in_at", { withTimezone: true }).notNull(),
  clockOutAt: timestamp("clock_out_at", { withTimezone: true }),
  shiftId: integer("shift_id"),
  hoursWorked: numeric("hours_worked", { precision: 10, scale: 4 }),
  isLate: boolean("is_late").default(false),
  lateMinutes: integer("late_minutes").default(0),
  isManualEdit: boolean("is_manual_edit").default(false),
  editedByStaffId: integer("edited_by_staff_id"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Shift = typeof shiftsTable.$inferSelect;
export type TimeEntry = typeof timeEntriesTable.$inferSelect;
