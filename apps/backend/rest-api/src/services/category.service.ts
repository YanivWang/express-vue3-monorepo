import { Category, Post } from "../db.js";
import { createHttpError } from "../middlewares/error.middleware.js";
import { trimmedStringFromUnknown } from "../utils/trimmedStringFromUnknown.js";

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

/** 在一级分类下创建（或复用同名）叶子分类；须在路由层以 `requirePermission('admin.categories.write')` 等保护 */
export async function ensureLeafCategoryUnderRoot(input: {
  parentId: number;
  name: unknown;
  sortOrder: number;
}): Promise<{ category: Model; reused: boolean }> {
  const name = trimmedStringFromUnknown(input.name);
  if (!name) {
    throw createHttpError(400, "名称不能为空");
  }
  const parent = await Category.findByPk(input.parentId);
  if (!parent) {
    throw createHttpError(400, "父分类不存在");
  }
  if (parent.get("parentId") != null) {
    throw createHttpError(400, "仅允许在一级分类下新建叶子分类");
  }

  const existing = await Category.findOne({
    where: { parentId: input.parentId, name },
  });
  if (existing) {
    await assertPostCategoryLeaf(existing.get("id") as number);
    return { category: existing, reused: true };
  }

  const row = await Category.create({
    name,
    parentId: input.parentId,
    sortOrder: input.sortOrder,
  });
  await assertPostCategoryLeaf(row.get("id") as number);
  return { category: row, reused: false };
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
  return rows.map((r: Model) => r.get("id") as number);
}

export async function createRootCategory(input: { name: unknown; sortOrder?: unknown }) {
  const name = trimmedStringFromUnknown(input.name);
  if (!name) {
    throw createHttpError(400, "分类名称不能为空");
  }
  const sortOrder = Number(input.sortOrder ?? 0);
  const dup = await Category.findOne({ where: { parentId: null, name } });
  if (dup) {
    throw createHttpError(400, "一级分类下已存在同名分类");
  }
  return Category.create({ name, parentId: null, sortOrder });
}

export async function updateCategoryAdmin(
  categoryId: number,
  payload: { name?: unknown; sortOrder?: unknown },
) {
  if (payload.name === undefined && payload.sortOrder === undefined) {
    throw createHttpError(400, "至少提供 name 或 sortOrder");
  }
  const row = await Category.findByPk(categoryId);
  if (!row) {
    throw createHttpError(404, "分类不存在");
  }
  const next: Record<string, unknown> = {};
  if (payload.name !== undefined) {
    const n = trimmedStringFromUnknown(payload.name);
    if (!n) {
      throw createHttpError(400, "名称不能为空");
    }
    next.name = n;
  }
  if (payload.sortOrder !== undefined) {
    next.sortOrder = Number(payload.sortOrder);
  }
  await row.update(next);
  return row;
}

export async function removeCategoryAdmin(categoryId: number) {
  const row = await Category.findByPk(categoryId);
  if (!row) {
    throw createHttpError(404, "分类不存在");
  }
  const nPosts = await Post.count({ where: { categoryId } });
  if (nPosts > 0) {
    throw createHttpError(400, "仍有文章使用该分类，无法删除");
  }
  const children = await Category.count({ where: { parentId: categoryId } });
  if (children > 0) {
    throw createHttpError(400, "请先删除子分类");
  }
  await row.destroy();
}
