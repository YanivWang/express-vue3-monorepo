import { Op } from "sequelize";
import { Category, Post, User } from "../db.js";
import { assertPostCategoryLeaf, resolveLeafIdsUnderParentOrEmpty } from "./category.service.js";
import { createHttpError } from "../middlewares/error.middleware.js";

const authorAttributes = ["id", "username", "avatar"];
const categoryAttributes = ["id", "name"];

const MAX_POST_IMAGES = 24;
const UPLOAD_PUBLIC_PATH_RE = /^\/uploads\/[a-zA-Z0-9._/-]+$/;

function normalizePostImagesInput(raw) {
  if (raw === undefined) {
    return undefined;
  }
  if (!Array.isArray(raw)) {
    throw createHttpError(400, "images 须为数组");
  }
  if (raw.length > MAX_POST_IMAGES) {
    throw createHttpError(400, `图片最多 ${MAX_POST_IMAGES} 张`);
  }
  const out = [];
  for (const item of raw) {
    const s = String(item ?? "").trim();
    if (!s) {
      throw createHttpError(400, "图片路径不能为空");
    }
    if (!UPLOAD_PUBLIC_PATH_RE.test(s) || s.includes("..")) {
      throw createHttpError(400, "图片路径须为本站 /uploads/ 下的地址");
    }
    out.push(s);
  }
  return out;
}

const postIncludeAuthor = { model: User, as: "author", attributes: authorAttributes };
const postIncludeCategory = { model: Category, as: "category", attributes: categoryAttributes };

async function findPostOrThrow(id, { allowUnpublished = false, viewerUserId = null } = {}) {
  const post = await Post.findByPk(id, {
    include: [postIncludeAuthor, postIncludeCategory],
  });

  if (!post) {
    throw createHttpError(404, "文章不存在");
  }

  if (!allowUnpublished && !post.published) {
    const isAuthor = viewerUserId != null && Number(post.authorId) === Number(viewerUserId);
    if (!isAuthor) {
      throw createHttpError(404, "文章不存在");
    }
  }

  return post;
}

function canEdit(post, operator) {
  const uid = Number(operator.id);
  if (Number(post.authorId) === uid) return true;
  return operator.role === 1;
}

async function buildPublishedCategoryWhere(parentId, categoryId) {
  const base = { published: true };
  if (categoryId != null) {
    return { ...base, categoryId };
  }
  if (parentId != null) {
    const leafIds = await resolveLeafIdsUnderParentOrEmpty(parentId);
    if (leafIds.length === 0) {
      return null;
    }
    return { ...base, categoryId: { [Op.in]: leafIds } };
  }
  return base;
}

async function buildMyPostsCategoryWhere(userId, parentId, categoryId) {
  const base = { authorId: userId };
  if (categoryId != null) {
    return { ...base, categoryId };
  }
  if (parentId != null) {
    const leafIds = await resolveLeafIdsUnderParentOrEmpty(parentId);
    if (leafIds.length === 0) {
      return null;
    }
    return { ...base, categoryId: { [Op.in]: leafIds } };
  }
  return base;
}

export async function findPostsPagePublic(page, limit, { parentId, categoryId } = {}) {
  if (categoryId != null) {
    await assertPostCategoryLeaf(categoryId);
  }
  const offset = (page - 1) * limit;
  const where = await buildPublishedCategoryWhere(parentId, categoryId);
  if (where === null) {
    return { posts: [], total: 0, totalPages: 0 };
  }
  const [rows, total] = await Promise.all([
    Post.findAll({
      where,
      limit,
      offset,
      order: [["id", "DESC"]],
      include: [postIncludeAuthor, postIncludeCategory],
    }),
    Post.count({ where }),
  ]);
  const totalPages = total === 0 ? 0 : Math.ceil(total / limit);
  return { posts: rows, total, totalPages };
}

export async function findPostByIdPublic(id, viewerUserId) {
  return findPostOrThrow(id, { allowUnpublished: false, viewerUserId });
}

export async function findMyPostsPage(userId, page, limit, { parentId, categoryId } = {}) {
  if (categoryId != null) {
    await assertPostCategoryLeaf(categoryId);
  }
  const offset = (page - 1) * limit;
  const where = await buildMyPostsCategoryWhere(userId, parentId, categoryId);
  if (where === null) {
    return { posts: [], total: 0, totalPages: 0 };
  }
  const [rows, total] = await Promise.all([
    Post.findAll({
      where,
      limit,
      offset,
      order: [["id", "DESC"]],
      include: [postIncludeAuthor, postIncludeCategory],
    }),
    Post.count({ where }),
  ]);
  const totalPages = total === 0 ? 0 : Math.ceil(total / limit);
  return { posts: rows, total, totalPages };
}

export async function createPost(authorId, payload) {
  const title = String(payload.title ?? "").trim();
  const content = String(payload.content ?? "").trim();
  if (!title || !content) {
    throw createHttpError(400, "标题或正文不能为空");
  }

  const categoryId = payload.categoryId;
  if (categoryId == null || Number.isNaN(Number(categoryId))) {
    throw createHttpError(400, "请选择叶子分类 categoryId");
  }
  await assertPostCategoryLeaf(Number(categoryId));

  const images = normalizePostImagesInput(payload.images) ?? [];

  const post = await Post.create({
    title,
    content,
    published: Boolean(payload.published),
    authorId,
    categoryId: Number(categoryId),
    images,
  });

  return Post.findByPk(post.id, {
    include: [postIncludeAuthor, postIncludeCategory],
  });
}

export async function updatePostById(postId, operator, payload) {
  const post = await Post.findByPk(postId);
  if (!post) {
    throw createHttpError(404, "文章不存在");
  }

  const user = await User.findByPk(operator.id);
  if (!user) {
    throw createHttpError(401, "未登录或登录已过期");
  }

  if (!canEdit(post, { id: user.id, role: user.role })) {
    throw createHttpError(403, "无权修改该文章");
  }

  const next = {
    ...(payload.title !== undefined ? { title: String(payload.title).trim() } : {}),
    ...(payload.content !== undefined ? { content: String(payload.content).trim() } : {}),
    ...(payload.published !== undefined ? { published: Boolean(payload.published) } : {}),
  };

  if (payload.categoryId !== undefined) {
    await assertPostCategoryLeaf(Number(payload.categoryId));
    next.categoryId = Number(payload.categoryId);
  }

  if (payload.images !== undefined) {
    next.images = normalizePostImagesInput(payload.images);
  }

  if (Object.keys(next).length === 0) {
    throw createHttpError(400, "没有要更新的字段");
  }

  await post.update(next);

  return Post.findByPk(post.id, {
    include: [postIncludeAuthor, postIncludeCategory],
  });
}

export async function removePostById(postId, operator) {
  const post = await Post.findByPk(postId);
  if (!post) {
    throw createHttpError(404, "文章不存在");
  }

  const user = await User.findByPk(operator.id);
  if (!user) {
    throw createHttpError(401, "未登录或登录已过期");
  }

  if (!canEdit(post, { id: user.id, role: user.role })) {
    throw createHttpError(403, "无权删除该文章");
  }

  await post.destroy();
}
