import { Category } from "../db.js";
import { createHttpError } from "../middlewares/error.middleware.js";

import type { Model, Order } from "sequelize";

const treeChildrenOrder: Order = [
  ["sortOrder", "ASC"],
  ["id", "ASC"],
];

const treeInclude = {
  model: Category,
  as: "children" as const,
  required: false,
  separate: true,
  order: treeChildrenOrder,
  attributes: ["id", "name", "parentId", "sortOrder"],
};

const rootsOrder: Order = [
  ["sortOrder", "ASC"],
  ["id", "ASC"],
];

export async function findCategoryTree() {
  const roots = await Category.findAll({
    where: { parentId: null },
    order: rootsOrder,
    attributes: ["id", "name", "parentId", "sortOrder"],
    include: [treeInclude],
  });
  return roots;
}

/** 文章只能挂在「二级叶子」上：有父且父为一级；自身不能再有子节点 */
export async function assertPostCategoryLeaf(categoryId: number) {
  const leaf = await Category.findByPk(categoryId, {
    include: [{ model: Category, as: "parent", attributes: ["id", "parentId"] }],
  });
  if (!leaf) {
    throw createHttpError(400, "分类不存在");
  }
  if (leaf.get("parentId") == null) {
    throw createHttpError(400, "请选择二级分类，不能仅选一级分类");
  }
  const parent = leaf.get("parent") as Model | null | undefined;
  if (!parent || parent.get("parentId") != null) {
    throw createHttpError(400, "仅支持两层分类");
  }
  const childCount = await Category.count({ where: { parentId: categoryId } });
  if (childCount > 0) {
    throw createHttpError(400, "请选择叶子分类");
  }
}

/** 列表筛选：parentId 为一级分类 id，解析为其下全部二级 id */
export async function resolveLeafIdsUnderParentOrEmpty(parentId: number) {
  const parent = await Category.findByPk(parentId);
  if (!parent) {
    throw createHttpError(400, "一级分类不存在");
  }
  if (parent.get("parentId") != null) {
    throw createHttpError(400, "parentId 须为一级分类");
  }
  const rows = await Category.findAll({
    attributes: ["id"],
    where: { parentId },
    order: [
      ["sortOrder", "ASC"],
      ["id", "ASC"],
    ] satisfies Order,
  });
  return rows.map((r) => r.get("id") as number);
}
