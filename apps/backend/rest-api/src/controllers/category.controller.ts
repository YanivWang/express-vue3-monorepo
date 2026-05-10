import { createHttpError } from "../middlewares/error.middleware.js";
import { ensureLeafCategoryUnderRoot, findCategoryTree } from "../services/category.service.js";
import { getValidated } from "../utils/getValidated.js";
import { success } from "../utils/response.js";

import type { ValidatedCreateCategorySchema } from "../schema/category.schema.js";
import type { Request, Response } from "express";

export async function getCategories(_req: Request, res: Response) {
  const categories = await findCategoryTree();
  return success(res, "获取分类成功", { categories });
}

export async function createCategory(req: Request, res: Response) {
  const uid = req.user?.id;
  if (uid === undefined) {
    throw createHttpError(401, "未登录或登录已过期");
  }
  const { body } = getValidated<ValidatedCreateCategorySchema>(req);
  const { category, reused } = await ensureLeafCategoryUnderRoot(uid, {
    parentId: body.parentId,
    name: body.name,
    sortOrder: body.sortOrder,
  });
  return success(res, reused ? "分类已存在，返回现有分类" : "创建分类成功", {
    category,
    reused,
  });
}
