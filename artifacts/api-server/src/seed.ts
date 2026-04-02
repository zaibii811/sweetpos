import bcrypt from "bcryptjs";
import { sql, eq } from "drizzle-orm";
import {
  db,
  staffTable,
  categoriesTable,
  productsTable,
  settingsTable,
  consumablesTable,
} from "@workspace/db";
import { REAL_CATEGORIES, REAL_PRODUCTS } from "./seedData";

export async function seedIfEmpty() {
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(staffTable);

  if (count === 0) {
    console.log("[seed] Empty database detected — seeding staff and settings…");

    // Default demo credentials — change the owner password after first login in production
    const ownerPasswordHash = await bcrypt.hash("sweetpos2024", 10);

    await db.insert(staffTable).values([
      { name: "Owner", role: "owner", pin: "1234", username: "owner", passwordHash: ownerPasswordHash, active: true },
      { name: "Siti Rahimah", role: "manager", pin: "2222", active: true },
      { name: "Ahmad Faizal", role: "cashier", pin: "3333", active: true },
      { name: "Nur Ain", role: "cashier", pin: "4444", active: true },
      { name: "Farah Lim", role: "cashier", pin: "5555", active: true },
    ]);

    await db.insert(settingsTable).values([
      { key: "shop_name", value: "Hashtag Sweets" },
      { key: "shop_address", value: "Kuala Lumpur, Malaysia" },
      { key: "sst_number", value: "" },
      { key: "receipt_footer", value: "Thank you for shopping with us!" },
      { key: "sst_enabled_global", value: "true" },
      { key: "payment_methods", value: JSON.stringify(["cash", "card", "tng", "duitnow"]) },
    ]).onConflictDoNothing();

    console.log("[seed] Staff and settings seeded.");
  }

  await seedProductsIfNeeded();
}

async function seedProductsIfNeeded() {
  const [{ catCount }] = await db
    .select({ catCount: sql<number>`count(*)::int` })
    .from(categoriesTable);

  if (catCount >= 21) {
    console.log("[seed] Real product data already present — skipping product seed.");
    return;
  }

  console.log("[seed] Seeding real product catalogue (21 categories, 370 products)…");

  await db.execute(sql`DELETE FROM order_items WHERE product_id IN (SELECT id FROM products)`);
  await db.execute(sql`DELETE FROM products`);
  await db.execute(sql`DELETE FROM categories`);
  await db.execute(sql`ALTER SEQUENCE IF EXISTS products_id_seq RESTART WITH 1`);
  await db.execute(sql`ALTER SEQUENCE IF EXISTS categories_id_seq RESTART WITH 1`);

  const insertedCats = await db.insert(categoriesTable)
    .values(REAL_CATEGORIES.map(c => ({ name: c.name, color: c.color, icon: c.icon })))
    .returning({ id: categoriesTable.id, name: categoriesTable.name });

  const categoryMap: Record<string, number> = {};
  insertedCats.forEach(c => { categoryMap[c.name] = c.id; });

  const CHUNK = 50;
  for (let i = 0; i < REAL_PRODUCTS.length; i += CHUNK) {
    const chunk = REAL_PRODUCTS.slice(i, i + CHUNK);
    await db.insert(productsTable).values(
      chunk.map(p => ({
        name: p.name,
        sku: p.sku,
        price: p.price,
        costPrice: p.costPrice,
        productType: p.productType,
        categoryId: categoryMap[p.category] ?? null,
        stock: p.stock,
        lowStockThreshold: p.lowStockThreshold,
        taxable: p.taxable,
        active: p.active,
        barcode: p.barcode,
      }))
    );
  }

  const existing = await db.select().from(consumablesTable)
    .where(eq(consumablesTable.name, "Gummy Plastic Bag")).limit(1);
  if (existing.length === 0) {
    await db.insert(consumablesTable).values({
      name: "Gummy Plastic Bag",
      unit: "pieces",
      stock: 500,
      lowStockThreshold: 50,
      costPerUnit: "0.10",
    });
  }

  console.log(`[seed] Product seed complete: ${insertedCats.length} categories, ${REAL_PRODUCTS.length} products.`);
}
