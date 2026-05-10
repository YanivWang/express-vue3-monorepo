import { findCategoryTree } from "../services/category.service.js";
import { success } from "../utils/response.js";

import type { Request, Response } from "express";

export async function getCategories(_req: Request, res: Response) {
  const categories = await findCategoryTree();
  return success(res, "获取分类成功", { categories });
}
