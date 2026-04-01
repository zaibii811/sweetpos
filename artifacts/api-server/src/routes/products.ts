import { Router, type IRouter } from "express";
import { eq, ilike, and, SQL } from "drizzle-orm";
import { db, productsTable, categoriesTable } from "@workspace/db";
import { z } from "zod";

const router: IRouter = Router();

const CreateProductBody = z.object({
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  productType: z.enum(["fixed", "weight"]).default("fixed"),
  price: z.number().positive(),
  costPrice: z.number().optional().nullable(),
  categoryId: z.number().int().optional().nullable(),
  sku: z.string().optional().nullable(),
  stock: z.number().int().default(0),
  lowStockThreshold: z.number().int().default(10),
  taxable: z.boolean().default(true),
  active: z.boolean().default(true),
  imageUrl: z.string().optional().nullable(),
  expiryDate: z.string().optional().nullable(),
});

const UpdateProductBody = CreateProductBody.partial();

const ListProductsQueryParams = z.object({
  categoryId: z.coerce.number().int().optional(),
  search: z.string().optional(),
  active: z.coerce.boolean().optional(),
  productType: z.enum(["fixed", "weight"]).optional(),
});

function formatProduct(
  p: typeof productsTable.$inferSelect,
  categoryName?: string | null,
) {
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    productType: p.productType,
    price: parseFloat(p.price),
    costPrice: p.costPrice ? parseFloat(p.costPrice) : null,
    categoryId: p.categoryId,
    categoryName: categoryName ?? null,
    sku: p.sku,
    stock: p.stock,
    lowStockThreshold: p.lowStockThreshold,
    taxable: p.taxable,
    active: p.active,
    imageUrl: p.imageUrl,
    expiryDate: p.expiryDate,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

router.get("/products", async (req, res): Promise<void> => {
  const queryParams = ListProductsQueryParams.safeParse(req.query);
  if (!queryParams.success) {
    res.status(400).json({ error: queryParams.error.message });
    return;
  }

  const { categoryId, search, active, productType } = queryParams.data;

  const conditions: SQL[] = [];
  if (categoryId !== undefined) conditions.push(eq(productsTable.categoryId, categoryId));
  if (search) conditions.push(ilike(productsTable.name, `%${search}%`));
  if (active !== undefined) conditions.push(eq(productsTable.active, active));
  if (productType !== undefined) conditions.push(eq(productsTable.productType, productType));

  const rows = await db
    .select({ product: productsTable, categoryName: categoriesTable.name })
    .from(productsTable)
    .leftJoin(categoriesTable, eq(productsTable.categoryId, categoriesTable.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(productsTable.name);

  res.json(rows.map((r) => formatProduct(r.product, r.categoryName)));
});

router.post("/products", async (req, res): Promise<void> => {
  const parsed = CreateProductBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [product] = await db.insert(productsTable).values({
    ...parsed.data,
    price: String(parsed.data.price),
    costPrice: parsed.data.costPrice != null ? String(parsed.data.costPrice) : null,
    stock: parsed.data.stock ?? 0,
  }).returning();

  res.status(201).json(formatProduct(product));
});

router.get("/products/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const [row] = await db
    .select({ product: productsTable, categoryName: categoriesTable.name })
    .from(productsTable)
    .leftJoin(categoriesTable, eq(productsTable.categoryId, categoriesTable.id))
    .where(eq(productsTable.id, id));

  if (!row) { res.status(404).json({ error: "Product not found" }); return; }
  res.json(formatProduct(row.product, row.categoryName));
});

router.patch("/products/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const parsed = UpdateProductBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updateData: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.price !== undefined) updateData.price = String(parsed.data.price);
  if (parsed.data.costPrice !== undefined) {
    updateData.costPrice = parsed.data.costPrice != null ? String(parsed.data.costPrice) : null;
  }

  const [product] = await db
    .update(productsTable)
    .set(updateData)
    .where(eq(productsTable.id, id))
    .returning();

  if (!product) { res.status(404).json({ error: "Product not found" }); return; }

  const [row] = await db
    .select({ product: productsTable, categoryName: categoriesTable.name })
    .from(productsTable)
    .leftJoin(categoriesTable, eq(productsTable.categoryId, categoriesTable.id))
    .where(eq(productsTable.id, product.id));

  res.json(formatProduct(row.product, row.categoryName));
});

router.delete("/products/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const [product] = await db.delete(productsTable).where(eq(productsTable.id, id)).returning();
  if (!product) { res.status(404).json({ error: "Product not found" }); return; }
  res.json({ message: "Product deleted" });
});

export default router;
