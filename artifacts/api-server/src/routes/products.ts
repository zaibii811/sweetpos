import { Router, type IRouter } from "express";
import { eq, ilike, and, SQL } from "drizzle-orm";
import { db, productsTable, categoriesTable } from "@workspace/db";
import {
  CreateProductBody,
  UpdateProductBody,
  UpdateProductParams,
  DeleteProductParams,
  GetProductParams,
  ListProductsQueryParams,
  ListProductsResponse,
  GetProductResponse,
  UpdateProductResponse,
  DeleteProductResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

function formatProduct(p: {
  id: number;
  name: string;
  description: string | null;
  price: string;
  categoryId: number | null;
  sku: string | null;
  stock: number;
  taxable: boolean;
  active: boolean;
  imageUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}, categoryName?: string | null) {
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    price: parseFloat(p.price),
    categoryId: p.categoryId,
    categoryName: categoryName ?? null,
    sku: p.sku,
    stock: p.stock,
    taxable: p.taxable,
    active: p.active,
    imageUrl: p.imageUrl,
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

  const { categoryId, search, active } = queryParams.data;

  const conditions: SQL[] = [];
  if (categoryId !== undefined) {
    conditions.push(eq(productsTable.categoryId, categoryId));
  }
  if (search) {
    conditions.push(ilike(productsTable.name, `%${search}%`));
  }
  if (active !== undefined) {
    conditions.push(eq(productsTable.active, active));
  }

  const rows = await db
    .select({
      product: productsTable,
      categoryName: categoriesTable.name,
    })
    .from(productsTable)
    .leftJoin(categoriesTable, eq(productsTable.categoryId, categoriesTable.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(productsTable.name);

  const data = rows.map((r) => formatProduct(r.product, r.categoryName));
  res.json(ListProductsResponse.parse(data));
});

router.post("/products", async (req, res): Promise<void> => {
  const parsed = CreateProductBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [product] = await db
    .insert(productsTable)
    .values({
      ...parsed.data,
      price: String(parsed.data.price),
    })
    .returning();

  res.status(201).json(GetProductResponse.parse(formatProduct(product)));
});

router.get("/products/:id", async (req, res): Promise<void> => {
  const params = GetProductParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const [row] = await db
    .select({ product: productsTable, categoryName: categoriesTable.name })
    .from(productsTable)
    .leftJoin(categoriesTable, eq(productsTable.categoryId, categoriesTable.id))
    .where(eq(productsTable.id, params.data.id));

  if (!row) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  res.json(GetProductResponse.parse(formatProduct(row.product, row.categoryName)));
});

router.patch("/products/:id", async (req, res): Promise<void> => {
  const params = UpdateProductParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const parsed = UpdateProductBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updateData: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.price !== undefined) {
    updateData.price = String(parsed.data.price);
  }

  const [product] = await db
    .update(productsTable)
    .set(updateData)
    .where(eq(productsTable.id, params.data.id))
    .returning();

  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  const [row] = await db
    .select({ product: productsTable, categoryName: categoriesTable.name })
    .from(productsTable)
    .leftJoin(categoriesTable, eq(productsTable.categoryId, categoriesTable.id))
    .where(eq(productsTable.id, product.id));

  res.json(UpdateProductResponse.parse(formatProduct(row.product, row.categoryName)));
});

router.delete("/products/:id", async (req, res): Promise<void> => {
  const params = DeleteProductParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const [product] = await db
    .delete(productsTable)
    .where(eq(productsTable.id, params.data.id))
    .returning();

  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  res.json(DeleteProductResponse.parse({ message: "Product deleted" }));
});

export default router;
