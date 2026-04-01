import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, categoriesTable } from "@workspace/db";
import {
  CreateCategoryBody,
  UpdateCategoryBody,
  UpdateCategoryParams,
  DeleteCategoryParams,
  ListCategoriesResponse,
  UpdateCategoryResponse,
  DeleteCategoryResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/categories", async (_req, res): Promise<void> => {
  const categories = await db
    .select()
    .from(categoriesTable)
    .orderBy(categoriesTable.name);

  const data = categories.map((c) => ({
    ...c,
    createdAt: c.createdAt.toISOString(),
  }));

  res.json(ListCategoriesResponse.parse(data));
});

router.post("/categories", async (req, res): Promise<void> => {
  const parsed = CreateCategoryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [category] = await db
    .insert(categoriesTable)
    .values(parsed.data)
    .returning();

  res.status(201).json({
    ...category,
    createdAt: category.createdAt.toISOString(),
  });
});

router.patch("/categories/:id", async (req, res): Promise<void> => {
  const params = UpdateCategoryParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const parsed = UpdateCategoryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [category] = await db
    .update(categoriesTable)
    .set(parsed.data)
    .where(eq(categoriesTable.id, params.data.id))
    .returning();

  if (!category) {
    res.status(404).json({ error: "Category not found" });
    return;
  }

  res.json(UpdateCategoryResponse.parse({ ...category, createdAt: category.createdAt.toISOString() }));
});

router.delete("/categories/:id", async (req, res): Promise<void> => {
  const params = DeleteCategoryParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const [category] = await db
    .delete(categoriesTable)
    .where(eq(categoriesTable.id, params.data.id))
    .returning();

  if (!category) {
    res.status(404).json({ error: "Category not found" });
    return;
  }

  res.json(DeleteCategoryResponse.parse({ message: "Category deleted" }));
});

export default router;
