import {
  createRootCategory,
  ensureLeafCategoryUnderRoot,
  removeCategoryAdmin,
  updateCategoryAdmin,
} from "../services/category.service.js";
import { getValidated } from "../utils/getValidated.js";
import { success } from "../utils/response.js";

import type {
  ValidatedAdminCreateCategoryLeafSchema,
  ValidatedAdminCreateCategoryRootSchema,
  ValidatedAdminDeleteCategorySchema,
  ValidatedAdminPatchCategorySchema,
} from "../schema/admin.schema.js";
import type { Request, Response } from "express";

export async function postAdminCategoryRoot(req: Request, res: Response) {
  const { body } = getValidated<ValidatedAdminCreateCategoryRootSchema>(req);
  const cat = await createRootCategory({ name: body.name, sortOrder: body.sortOrder });
  return success(res, "创建一级分类成功", { category: cat.get({ plain: true }) });
}

export async function postAdminCategoryLeaf(req: Request, res: Response) {
  const { body } = getValidated<ValidatedAdminCreateCategoryLeafSchema>(req);
  const { category, reused } = await ensureLeafCategoryUnderRoot({
    parentId: body.parentId,
    name: body.name,
    sortOrder: body.sortOrder,
  });
  return success(res, reused ? "分类已存在" : "创建二级分类成功", {
    category: category.get({ plain: true }),
    reused,
  });
}

export async function patchAdminCategory(req: Request, res: Response) {
  const { params, body } = getValidated<ValidatedAdminPatchCategorySchema>(req);
  const cat = await updateCategoryAdmin(params.id, body);
  return success(res, "更新分类成功", { category: cat.get({ plain: true }) });
}

export async function deleteAdminCategory(req: Request, res: Response) {
  const { params } = getValidated<ValidatedAdminDeleteCategorySchema>(req);
  await removeCategoryAdmin(params.id);
  return success(res, "删除分类成功");
}
