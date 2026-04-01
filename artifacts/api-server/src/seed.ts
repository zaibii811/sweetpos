import bcrypt from "bcryptjs";
import { sql } from "drizzle-orm";
import {
  db,
  staffTable,
  categoriesTable,
  productsTable,
  settingsTable,
  consumablesTable,
} from "@workspace/db";

export async function seedIfEmpty() {
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(staffTable);

  if (count > 0) return;

  console.log("[seed] Empty database detected — seeding default data…");

  const ownerPasswordHash = await bcrypt.hash("sweetpos2024", 10);

  await db.insert(staffTable).values([
    { name: "Owner", role: "owner", pin: "1234", username: "owner", passwordHash: ownerPasswordHash, active: true },
    { name: "Siti Rahimah", role: "manager", pin: "2222", active: true },
    { name: "Ahmad Faizal", role: "cashier", pin: "3333", active: true },
    { name: "Nur Ain", role: "cashier", pin: "4444", active: true },
    { name: "Farah Lim", role: "cashier", pin: "5555", active: true },
  ]);

  await db.insert(categoriesTable).values([
    { name: "Cakes", color: "#FF6B9D", icon: "cake" },
    { name: "Kuih", color: "#FFB347", icon: "star" },
    { name: "Candy & Sweets", color: "#FF6B6B", icon: "candy" },
    { name: "Cookies & Biscuits", color: "#DEB887", icon: "cookie" },
    { name: "Drinks & Beverages", color: "#87CEEB", icon: "coffee" },
    { name: "Imported Snacks", color: "#98FB98", icon: "package" },
  ]);

  const [cakes, kuih, candy, cookies, drinks, imported] = await db
    .select({ id: categoriesTable.id })
    .from(categoriesTable)
    .orderBy(categoriesTable.id);

  await db.insert(productsTable).values([
    { name: "Black Forest Cake (Whole)", description: "Rich chocolate sponge with cherries and whipped cream, whole cake", price: "68.00", categoryId: cakes.id, sku: "CK-001", stock: 9, taxable: true, lowStockThreshold: 10 },
    { name: "Chocolate Indulgence Slice", description: "Single slice of our signature chocolate indulgence cake", price: "12.00", categoryId: cakes.id, sku: "CK-002", stock: 20, taxable: true, lowStockThreshold: 10 },
    { name: "Mango Mousse Cake (Whole)", description: "Light and fruity mango mousse cake, whole 8-inch", price: "72.00", categoryId: cakes.id, sku: "CK-003", stock: 8, taxable: true, lowStockThreshold: 10 },
    { name: "Red Velvet Cupcake", description: "Classic red velvet with cream cheese frosting", price: "6.50", categoryId: cakes.id, sku: "CK-004", stock: 30, taxable: true, lowStockThreshold: 10 },
    { name: "Vanilla Birthday Cake (6-inch)", description: "Custom birthday cake with buttercream, 6-inch round", price: "55.00", categoryId: cakes.id, sku: "CK-005", stock: 5, taxable: true, lowStockThreshold: 10 },
    { name: "Kuih Lapis", description: "Layered steamed cake, rainbow colored, per piece", price: "2.50", categoryId: kuih.id, sku: "KH-001", stock: 50, taxable: false, lowStockThreshold: 10 },
    { name: "Kuih Cara Berlauk", description: "Savory pandan cups with spiced coconut filling, 3 pieces", price: "4.50", categoryId: kuih.id, sku: "KH-002", stock: 40, taxable: false, lowStockThreshold: 10 },
    { name: "Onde-Onde", description: "Pandan rice balls with palm sugar filling, 6 pieces", price: "5.00", categoryId: kuih.id, sku: "KH-003", stock: 35, taxable: false, lowStockThreshold: 10 },
    { name: "Kuih Seri Muka", description: "Two-layered glutinous rice and pandan custard, per piece", price: "3.00", categoryId: kuih.id, sku: "KH-004", stock: 45, taxable: false, lowStockThreshold: 10 },
    { name: "Apam Balik (Large)", description: "Crispy peanut pancake turnover, large", price: "8.00", categoryId: kuih.id, sku: "KH-005", stock: 20, taxable: false, lowStockThreshold: 10 },
    { name: "Gummy Bears (100g)", description: "Assorted fruit gummy bears, imported from Germany", price: "7.90", categoryId: candy.id, sku: "CD-001", stock: 60, taxable: true, lowStockThreshold: 10 },
    { name: "Rock Candy Sticks", description: "Crystallized sugar candy on a stick, assorted flavors", price: "3.50", categoryId: candy.id, sku: "CD-002", stock: 80, taxable: true, lowStockThreshold: 10 },
    { name: "Lollipop Set (5 pieces)", description: "Colorful fruit flavored lollipops, 5 assorted", price: "9.90", categoryId: candy.id, sku: "CD-003", stock: 40, taxable: true, lowStockThreshold: 10 },
    { name: "Marshmallow Cloud Bag", description: "Soft vanilla and strawberry marshmallows, 150g bag", price: "11.50", categoryId: candy.id, sku: "CD-004", stock: 35, taxable: true, lowStockThreshold: 10 },
    { name: "Alphabet Candy Jar", description: "Mixed alphabet hard candies in a cute jar", price: "15.00", categoryId: candy.id, sku: "CD-005", stock: 24, taxable: true, lowStockThreshold: 10 },
    { name: "Butter Cookies Tin (500g)", description: "Classic Danish-style butter cookies, 500g tin", price: "28.90", categoryId: cookies.id, sku: "BK-001", stock: 30, taxable: true, lowStockThreshold: 10 },
    { name: "Coconut Macaroons", description: "Chewy coconut macaroons, pack of 8", price: "12.00", categoryId: cookies.id, sku: "BK-002", stock: 25, taxable: true, lowStockThreshold: 10 },
    { name: "Almond Biscotti", description: "Crunchy Italian-style biscotti with toasted almonds, 10 pieces", price: "16.90", categoryId: cookies.id, sku: "BK-003", stock: 19, taxable: true, lowStockThreshold: 10 },
    { name: "Peanut Butter Cookies (6 pcs)", description: "Homestyle peanut butter cookies, pack of 6", price: "10.50", categoryId: cookies.id, sku: "BK-004", stock: 30, taxable: true, lowStockThreshold: 10 },
    { name: "Oat Raisin Cookies (6 pcs)", description: "Hearty oat and raisin cookies, pack of 6", price: "9.90", categoryId: cookies.id, sku: "BK-005", stock: 28, taxable: true, lowStockThreshold: 10 },
    { name: "Teh Tarik (Hot)", description: "Traditional Malaysian pulled milk tea, freshly made", price: "4.50", categoryId: drinks.id, sku: "DK-001", stock: 100, taxable: false, lowStockThreshold: 10 },
    { name: "Kopi O (Hot)", description: "Strong black Malaysian coffee with sugar", price: "3.50", categoryId: drinks.id, sku: "DK-002", stock: 100, taxable: false, lowStockThreshold: 10 },
    { name: "Bandung Rose Milk", description: "Sweet rose-flavored milk drink, chilled", price: "5.00", categoryId: drinks.id, sku: "DK-003", stock: 50, taxable: false, lowStockThreshold: 10 },
    { name: "Iced Milo Dinosaur", description: "Classic Malaysian iced Milo with extra Milo powder on top", price: "6.50", categoryId: drinks.id, sku: "DK-004", stock: 60, taxable: false, lowStockThreshold: 10 },
    { name: "Cendol (Bowl)", description: "Traditional Malaysian dessert with green pandan jelly, coconut milk and palm sugar", price: "7.00", categoryId: drinks.id, sku: "DK-005", stock: 40, taxable: false, lowStockThreshold: 10 },
    { name: "Pocky Strawberry", description: "Japanese biscuit sticks dipped in strawberry chocolate", price: "8.90", categoryId: imported.id, sku: "IS-001", stock: 45, taxable: true, lowStockThreshold: 10 },
    { name: "Meiji Melty Kiss", description: "Premium Japanese melt-in-mouth chocolate, seasonal", price: "14.90", categoryId: imported.id, sku: "IS-002", stock: 30, taxable: true, lowStockThreshold: 10 },
    { name: "Pepero Chocolate", description: "Korean biscuit stick with chocolate, 1 box", price: "9.90", categoryId: imported.id, sku: "IS-003", stock: 40, taxable: true, lowStockThreshold: 10 },
    { name: "Hi-Chew Fruit Candy", description: "Japanese chewy fruit candy, assorted flavors, 100g", price: "12.50", categoryId: imported.id, sku: "IS-004", stock: 35, taxable: true, lowStockThreshold: 10 },
    { name: "Morinaga Caramel", description: "Classic Japanese caramel candies, 115g box", price: "11.90", categoryId: imported.id, sku: "IS-005", stock: 28, taxable: true, lowStockThreshold: 10 },
  ]);

  await db.insert(consumablesTable).values([
    { name: "Plastic Bag (S)", unit: "pieces", stock: 200, lowStockThreshold: 50 },
    { name: "Plastic Bag (M)", unit: "pieces", stock: 150, lowStockThreshold: 50 },
    { name: "Plastic Bag (L)", unit: "pieces", stock: 100, lowStockThreshold: 30 },
    { name: "Paper Box (Small)", unit: "pieces", stock: 80, lowStockThreshold: 20 },
  ]);

  await db.insert(settingsTable).values([
    { key: "shop_name", value: "SweetPOS" },
    { key: "shop_address", value: "Kuala Lumpur, Malaysia" },
    { key: "sst_number", value: "" },
    { key: "receipt_footer", value: "Thank you for your purchase!" },
    { key: "sst_enabled_global", value: "true" },
    { key: "payment_methods", value: JSON.stringify(["cash", "card", "tng", "duitnow"]) },
  ]).onConflictDoNothing();

  console.log("[seed] Database seeded successfully.");
}
