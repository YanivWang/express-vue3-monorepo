import { Op, Sequelize, type Model, type Order } from "sequelize";

import { Category, Post, PostFavorite, PostVote, User } from "../db.js";
import { createHttpError } from "../middlewares/error.middleware.js";
import {
  assertNoSensitiveText,
  sanitizeHtmlContentForStorage,
  sanitizeTitleForStorage,
} from "../utils/content-safety.js";
import { escapeMysqlLikePattern } from "../utils/escapeMysqlLike.js";
import { trimmedStringFromUnknown } from "../utils/trimmedStringFromUnknown.js";

import { assertPostCategoryLeaf, resolveLeafIdsUnderParentOrEmpty } from "./category.service.js";
import { voteValueToMyVote } from "./post-vote.service.js";
import { assertUserPermission, userHasPermissions } from "./rbac.service.js";

import type {
  CategoryAttributes,
  PostAttributes,
  PostModel,
  UserAttributes,
} from "../models/index.js";
import type { AppJwtUser } from "../types/jwt-user.js";

const authorAttributes = ["id", "username", "avatar"];

/**
 * `get({ plain: true })` 的运行时形态：表列 + 被 include 的关联。
 * 关联不属于表列，因而不在 PostAttributes 里，这里显式补齐，
 * 使响应体有真实类型，而不是退化成 Record<string, unknown> 这种不透明的袋子。
 */
export type PlainPost = PostAttributes & {
  author?: Pick<UserAttributes, "id" | "username" | "avatar">;
  category?: Pick<CategoryAttributes, "id" | "name">;
};

/** 叠加「当前访问者视角」后的文章响应体；未登录访问时后两个字段不下发 */
export type PostForViewer = PlainPost & {
  myVote?: "like" | "dislike" | null;
  myFavorited?: boolean;
};
const categoryAttributes = ["id", "name"];

const postIncludeAuthor = { model: User, as: "author" as const, attributes: authorAttributes };
const postIncludeCategory = {
  model: Category,
  as: "category" as const,
  attributes: categoryAttributes,
};

async function findPostOrThrow(
  id: string | number,
  {
    allowUnpublished = false,
    viewerUserId = null,
  }: { allowUnpublished?: boolean; viewerUserId?: number | null } = {},
) {
  const post = await Post.findByPk(id, {
    include: [postIncludeAuthor, postIncludeCategory],
  });

  if (!post) {
    throw createHttpError(404, "文章不存在");
  }

  if (!allowUnpublished && !post.published) {
    const isAuthor = viewerUserId != null && post.authorId === viewerUserId;
    if (!isAuthor) {
      throw createHttpError(404, "文章不存在");
    }
  }

  return post;
}

async function canUpdatePost(post: PostModel, operatorId: number): Promise<boolean> {
  if (post.authorId === operatorId) return true;
  return userHasPermissions(operatorId, ["admin.posts.write"], "all");
}

async function canDeletePost(post: PostModel, operatorId: number): Promise<boolean> {
  if (post.authorId === operatorId) return true;
  return userHasPermissions(operatorId, ["admin.posts.delete"], "all");
}

async function buildPublishedCategoryWhere(parentId?: number | null, categoryId?: number | null) {
  const base: Record<string, unknown> = { published: true };
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

async function buildMyPostsCategoryWhere(
  userId: number,
  parentId?: number | null,
  categoryId?: number | null,
) {
  const base: Record<string, unknown> = { authorId: userId };
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

function effectiveListSort(hasSearchQuery: boolean, sort: "latest" | "hot"): "latest" | "hot" {
  if (hasSearchQuery) return "latest";
  return sort;
}

function listOrder(sort: "latest" | "hot") {
  // ORDER BY 须与 Sequelize 在主查询里使用的别名一致：表名为 Posts（tableName），别名为模型名 Post（name）。
  const mainAliasQuoted = `\`${Post.name}\``;
  if (sort === "hot") {
    return [
      Sequelize.literal(
        `(COALESCE(${mainAliasQuoted}.\`commentCount\`,0)+COALESCE(${mainAliasQuoted}.\`favoriteCount\`,0)+COALESCE(${mainAliasQuoted}.\`likeCount\`,0)) DESC`,
      ),
      ["id", "DESC"],
    ] as Order;
  }
  return [
    ["createdAt", "DESC"],
    ["id", "DESC"],
  ] as Order;
}

export async function incrementPostViewIfEligible(post: PostModel, viewerUserId: number | null) {
  if (!post.published) return;
  const authorId = post.authorId;
  if (viewerUserId != null && viewerUserId === authorId) return;
  const id = post.id;
  await Post.increment("viewCount", { by: 1, where: { id } });
  await post.reload({
    include: [postIncludeAuthor, postIncludeCategory],
  });
}

export async function enrichPublicPostForResponse(
  post: PostModel,
  viewerUserId: number | null,
  options?: { bumpView?: boolean },
): Promise<PostForViewer> {
  const bumpView = options?.bumpView ?? true;
  if (bumpView) {
    await incrementPostViewIfEligible(post, viewerUserId);
  }
  const plain: PostForViewer = post.get({ plain: true });
  if (viewerUserId != null) {
    const pid = post.id;
    const [vote, fav] = await Promise.all([
      PostVote.findOne({ where: { postId: pid, userId: viewerUserId } }),
      PostFavorite.findOne({ where: { postId: pid, userId: viewerUserId } }),
    ]);
    plain.myVote = voteValueToMyVote(vote == null ? null : vote.value);
    plain.myFavorited = Boolean(fav);
  }
  return plain;
}

export async function decoratePostsListForViewer(
  rows: PostModel[],
  viewerUserId: number | null,
): Promise<PostForViewer[]> {
  const base: PostForViewer[] = rows.map((r) => r.get({ plain: true }));
  if (viewerUserId == null) return base;
  const ids = rows.map((r) => r.id);
  if (ids.length === 0) return base;
  const [votes, favs] = await Promise.all([
    PostVote.findAll({ where: { userId: viewerUserId, postId: { [Op.in]: ids } } }),
    PostFavorite.findAll({ where: { userId: viewerUserId, postId: { [Op.in]: ids } } }),
  ]);
  const voteByPost = new Map<number, "like" | "dislike" | null>();
  for (const v of votes) {
    voteByPost.set(v.postId, voteValueToMyVote(v.value));
  }
  const favSet = new Set(favs.map((f) => f.postId));
  return base.map((o) => {
    const id = o.id;
    return {
      ...o,
      myVote: voteByPost.get(id) ?? null,
      myFavorited: favSet.has(id),
    };
  });
}

export async function findPostsPagePublic(
  page: number,
  limit: number,
  {
    parentId,
    categoryId,
    q,
    sort = "latest",
  }: {
    parentId?: number | null;
    categoryId?: number | null;
    q?: string | null;
    sort?: "latest" | "hot";
  } = {},
) {
  const offset = (page - 1) * limit;
  const kw = q?.trim();
  const resolvedSort = effectiveListSort(Boolean(kw), sort);
  const order = listOrder(resolvedSort);
  if (kw) {
    const pattern = `%${escapeMysqlLikePattern(kw)}%`;
    const where = {
      published: true,
      [Op.or]: [{ title: { [Op.like]: pattern } }, { content: { [Op.like]: pattern } }],
    };
    const [rows, total] = await Promise.all([
      Post.findAll({
        where,
        limit,
        offset,
        order,
        include: [postIncludeAuthor, postIncludeCategory],
      }),
      Post.count({ where }),
    ]);
    const totalPages = total === 0 ? 0 : Math.ceil(total / limit);
    return { posts: rows, total, totalPages };
  }

  if (categoryId != null) {
    await assertPostCategoryLeaf(categoryId);
  }
  const where = await buildPublishedCategoryWhere(parentId, categoryId);
  if (where === null) {
    return { posts: [], total: 0, totalPages: 0 };
  }
  const [rows, total] = await Promise.all([
    Post.findAll({
      where,
      limit,
      offset,
      order,
      include: [postIncludeAuthor, postIncludeCategory],
    }),
    Post.count({ where }),
  ]);
  const totalPages = total === 0 ? 0 : Math.ceil(total / limit);
  return { posts: rows, total, totalPages };
}

export async function findPostByIdPublic(id: string | number, viewerUserId: number | null) {
  return findPostOrThrow(id, { allowUnpublished: false, viewerUserId });
}

export async function findMyPostsPage(
  userId: number,
  page: number,
  limit: number,
  { parentId, categoryId }: { parentId?: number | null; categoryId?: number | null } = {},
) {
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

export async function findPostsPageAdmin(
  page: number,
  limit: number,
  {
    published,
    authorId,
    categoryId,
    parentId,
    q,
  }: {
    published?: boolean | null;
    authorId?: number | null;
    categoryId?: number | null;
    parentId?: number | null;
    q?: string | null;
  } = {},
) {
  const offset = (page - 1) * limit;
  const parts: object[] = [];
  if (published != null) {
    parts.push({ published });
  }
  if (authorId != null) {
    parts.push({ authorId });
  }

  const kw = q?.trim();
  if (kw) {
    const pattern = `%${escapeMysqlLikePattern(kw)}%`;
    parts.push({
      [Op.or]: [{ title: { [Op.like]: pattern } }, { content: { [Op.like]: pattern } }],
    });
  }

  if (categoryId != null) {
    await assertPostCategoryLeaf(categoryId);
    parts.push({ categoryId });
  } else if (parentId != null) {
    const leafIds = await resolveLeafIdsUnderParentOrEmpty(parentId);
    if (leafIds.length === 0) {
      return { posts: [], total: 0, totalPages: 0 };
    }
    parts.push({ categoryId: { [Op.in]: leafIds } });
  }

  const where: Record<string, unknown> =
    parts.length === 0
      ? {}
      : parts.length === 1
        ? (parts[0] as Record<string, unknown>)
        : { [Op.and]: parts };

  const [rows, total] = await Promise.all([
    Post.findAll({
      where,
      limit,
      offset,
      order: [
        ["createdAt", "DESC"],
        ["id", "DESC"],
      ],
      include: [postIncludeAuthor, postIncludeCategory],
    }),
    Post.count({ where }),
  ]);
  const totalPages = total === 0 ? 0 : Math.ceil(total / limit);
  return { posts: rows, total, totalPages };
}

export async function findPostByIdAdmin(id: string | number) {
  return findPostOrThrow(id, { allowUnpublished: true, viewerUserId: null });
}

export async function createPost(authorId: number, payload: Record<string, unknown>) {
  const titleRaw = trimmedStringFromUnknown(payload.title);
  const contentRaw = trimmedStringFromUnknown(payload.content);
  if (!titleRaw || !contentRaw) {
    throw createHttpError(400, "标题或正文不能为空");
  }
  assertNoSensitiveText(titleRaw, contentRaw);
  const title = sanitizeTitleForStorage(titleRaw);
  const content = sanitizeHtmlContentForStorage(contentRaw);
  if (!title || !content) {
    throw createHttpError(400, "标题或正文不能为空");
  }

  const categoryId = payload.categoryId;
  if (categoryId == null || Number.isNaN(Number(categoryId))) {
    throw createHttpError(400, "请选择叶子分类 categoryId");
  }
  await assertPostCategoryLeaf(Number(categoryId));

  const extSource = trimmedStringFromUnknown(payload.externalSource);
  const extKey = trimmedStringFromUnknown(payload.externalKey);
  if (!!extSource !== !!extKey) {
    throw createHttpError(400, "externalSource 与 externalKey 须同时提供或同时省略");
  }
  if (extSource && extKey) {
    await assertUserPermission(authorId, "admin.posts.write");
    const existing = await Post.findOne({
      where: { externalSource: extSource, externalKey: extKey },
      include: [postIncludeAuthor, postIncludeCategory],
    });
    if (existing) {
      return existing;
    }
  }

  const post = await Post.create({
    title,
    content,
    published: Boolean(payload.published),
    authorId,
    categoryId: Number(categoryId),
    ...(extSource && extKey ? { externalSource: extSource, externalKey: extKey } : {}),
  });

  return Post.findByPk(post.id, {
    include: [postIncludeAuthor, postIncludeCategory],
  });
}

export async function updatePostById(
  postId: string | number,
  operator: AppJwtUser | undefined,
  payload: Record<string, unknown>,
) {
  const post = await Post.findByPk(postId);
  if (!post) {
    throw createHttpError(404, "文章不存在");
  }

  const user = await User.findByPk(operator?.id);
  if (!user) {
    throw createHttpError(401, "未登录或登录已过期");
  }

  if (!(await canUpdatePost(post, user.id))) {
    throw createHttpError(403, "无权修改该文章");
  }

  const next: Record<string, unknown> = {};
  if (payload.title !== undefined) {
    const raw = trimmedStringFromUnknown(payload.title);
    assertNoSensitiveText(raw);
    const t = sanitizeTitleForStorage(raw);
    if (!t) throw createHttpError(400, "标题不能为空");
    next.title = t;
  }
  if (payload.content !== undefined) {
    const raw = trimmedStringFromUnknown(payload.content);
    assertNoSensitiveText(raw);
    const c = sanitizeHtmlContentForStorage(raw);
    if (!c) throw createHttpError(400, "正文不能为空");
    next.content = c;
  }
  if (payload.published !== undefined) {
    next.published = Boolean(payload.published);
  }

  if (payload.categoryId !== undefined) {
    await assertPostCategoryLeaf(Number(payload.categoryId));
    next.categoryId = Number(payload.categoryId);
  }

  if (Object.keys(next).length === 0) {
    throw createHttpError(400, "没有要更新的字段");
  }

  await post.update(next);

  return Post.findByPk(post.id, {
    include: [postIncludeAuthor, postIncludeCategory],
  });
}

export async function removePostById(postId: string | number, operator: AppJwtUser | undefined) {
  const post = await Post.findByPk(postId);
  if (!post) {
    throw createHttpError(404, "文章不存在");
  }

  const user = await User.findByPk(operator?.id);
  if (!user) {
    throw createHttpError(401, "未登录或登录已过期");
  }

  if (!(await canDeletePost(post, user.id))) {
    throw createHttpError(403, "无权删除该文章");
  }

  await post.destroy();
}
