import { findCategoryTree } from "../services/category.service.js";
import { success } from "../utils/response.js";

export async function getCategories(req, res) {
  const categories = await findCategoryTree();
  return success(res, "获取分类成功", { categories });
}
