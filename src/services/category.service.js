import { Category } from "../db.js";
import { createHttpError } from "../middlewares/error.middleware.js";

const treeInclude = {
  model: Category,
  as: "children",
  required: false,
  separate: true,
  order: [
    ["sortOrder", "ASC"],
    ["id", "ASC"],
  ],
  attributes: ["id", "name", "parentId", "sortOrder"],
};

export async function findCategoryTree() {
  const roots = await Category.findAll({
    where: { parentId: null },
    order: [
      ["sortOrder", "ASC"],
      ["id", "ASC"],
    ],
    attributes: ["id", "name", "parentId", "sortOrder"],
    include: [treeInclude],
  });
  return roots;
}

/** 文章只能挂在「二级叶子」上：有父且父为一级；自身不能再有子节点 */
export async function assertPostCategoryLeaf(categoryId) {
  const leaf = await Category.findByPk(categoryId, {
    include: [{ model: Category, as: "parent", attributes: ["id", "parentId"] }],
  });
  if (!leaf) {
    throw createHttpError(400, "分类不存在");
  }
  if (leaf.parentId == null) {
    throw createHttpError(400, "请选择二级分类，不能仅选一级分类");
  }
  if (!leaf.parent || leaf.parent.parentId != null) {
    throw createHttpError(400, "仅支持两层分类");
  }
  const childCount = await Category.count({ where: { parentId: categoryId } });
  if (childCount > 0) {
    throw createHttpError(400, "请选择叶子分类");
  }
}

/** 列表筛选：parentId 为一级分类 id，解析为其下全部二级 id */
export async function resolveLeafIdsUnderParentOrEmpty(parentId) {
  const parent = await Category.findByPk(parentId);
  if (!parent) {
    throw createHttpError(400, "一级分类不存在");
  }
  if (parent.parentId != null) {
    throw createHttpError(400, "parentId 须为一级分类");
  }
  const rows = await Category.findAll({
    attributes: ["id"],
    where: { parentId },
    order: [
      ["sortOrder", "ASC"],
      ["id", "ASC"],
    ],
  });
  return rows.map((r) => r.id);
}
