import { pgTable, text, serial, timestamp, boolean, integer, numeric } from "drizzle-orm/pg-core";

export const consumablesTable = pgTable("consumables", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  unit: text("unit").notNull().default("pieces"),
  stock: integer("stock").notNull().default(0),
  lowStockThreshold: integer("low_stock_threshold").notNull().default(50),
  costPerUnit: numeric("cost_per_unit", { precision: 10, scale: 2 }),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const stockAdjustmentsTable = pgTable("stock_adjustments", {
  id: serial("id").primaryKey(),
  itemType: text("item_type").notNull(),
  itemId: integer("item_id").notNull(),
  itemName: text("item_name").notNull(),
  adjustmentType: text("adjustment_type").notNull(),
  quantity: numeric("quantity", { precision: 10, scale: 3 }).notNull(),
  reason: text("reason"),
  staffId: integer("staff_id"),
  staffName: text("staff_name"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const bagSizeRulesTable = pgTable("bag_size_rules", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  maxWeightGrams: integer("max_weight_grams").notNull(),
  consumableId: integer("consumable_id").references(() => consumablesTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Consumable = typeof consumablesTable.$inferSelect;
export type StockAdjustment = typeof stockAdjustmentsTable.$inferSelect;
export type BagSizeRule = typeof bagSizeRulesTable.$inferSelect;
