import { Op } from "sequelize";

import { Comment, Post, User } from "../db.js";
import { createHttpError } from "../middlewares/error.middleware.js";
import { trimmedStringFromUnknown } from "../utils/trimmedStringFromUnknown.js";

import { findPostByIdPublic } from "./post.service.js";

import type { AppJwtUser } from "../types/jwt-user.js";
import type { Model } from "sequelize";

const authorAttributes = ["id", "username", "avatar"];

/** 是否与 post.service 的 canEdit 语义一致：作者或 admin */
function canModeratePost(post: Model, operator: { id: number; role?: number }) {
  const uid = operator.id;
  if (Number(post.get("authorId")) === uid) return true;
  return Number(operator.role) === 1;
}

async function syncCommentCountForPost(postId: string | number) {
  const total = await Comment.count({ where: { postId } });
  await Post.update({ commentCount: total }, { where: { id: postId } });
}

function canDeleteComment(comment: Model, post: Model, operator: { id: number; role?: number }) {
  const uid = operator.id;
  if (Number(comment.get("authorId")) === uid) return true;
  if (canModeratePost(post, operator)) return true;
  return false;
}

type PostAuthorDto = { id: number; username: string; avatar?: string | null };

function toAuthorDto(user: Model | null | undefined): PostAuthorDto | undefined {
  if (!user) return undefined;
  return {
    id: Number(user.get("id")),
    username: String(user.get("username")),
    avatar: user.get("avatar") as string | null | undefined,
  };
}

/** API 普通对象；回复行带 replyToUser（被直接回复一方的作者快照） */
function commentRowToJson(
  row: Model,
  replyToUser: PostAuthorDto | null = null,
): Record<string, unknown> {
  const rootRaw = row.get("rootId");
  return {
    id: Number(row.get("id")),
    postId: Number(row.get("postId")),
    authorId: Number(row.get("authorId")),
    parentId: row.get("parentId") == null ? null : Number(row.get("parentId")),
    rootId: rootRaw == null ? null : Number(rootRaw),
    content: String(row.get("content")),
    createdAt: row.get("createdAt"),
    updatedAt: row.get("updatedAt"),
    author: toAuthorDto(row.get("author") as Model | undefined),
    replyToUser,
  };
}

/**
 * 历史数据：由 parentId 推导 rootId；单轮无进展时停止（可能成环或缺父行）。
 */
export async function backfillCommentRootIds(): Promise<void> {
  const maxPasses = 500;
  for (let pass = 0; pass < maxPasses; pass++) {
    const pending = await Comment.findAll({
      where: { rootId: { [Op.is]: null } },
      order: [["id", "ASC"]],
      limit: 1000,
    });
    if (pending.length === 0) return;

    let progressed = false;
    for (const row of pending) {
      const id = Number(row.get("id"));
      const parentId = row.get("parentId") as number | null;

      if (parentId == null) {
        await row.update({ rootId: id });
        progressed = true;
        continue;
      }

      const parent = await Comment.findByPk(parentId, {
        attributes: ["id", "parentId", "rootId"],
      });
      if (!parent) {
        await row.update({ rootId: id });
        progressed = true;
        continue;
      }

      const pRoot = parent.get("rootId") as number | null;
      if (pRoot != null) {
        await row.update({ rootId: pRoot });
        progressed = true;
        continue;
      }

      const ppid = parent.get("parentId") as number | null;
      if (ppid == null) {
        const pid = Number(parent.get("id"));
        await parent.update({ rootId: pid });
        await row.update({ rootId: pid });
        progressed = true;
      }
    }

    if (!progressed) {
      console.warn(
        "[comment] backfillCommentRootIds: no progress in one pass; possible cycles or missing parents",
      );
      return;
    }
  }
  console.warn("[comment] backfillCommentRootIds: stopped after maxPasses");
}

export async function findCommentsPageByPost(
  postId: string | number,
  viewerUserId: number | null,
  page: number,
  limit: number,
) {
  await findPostByIdPublic(postId, viewerUserId);

  const offset = (page - 1) * limit;
  const rootWhere = { postId, parentId: null };

  const [threadTotal, commentTotal, rows] = await Promise.all([
    Comment.count({ where: rootWhere }),
    Comment.count({ where: { postId } }),
    Comment.findAll({
      where: rootWhere,
      limit,
      offset,
      order: [["id", "DESC"]],
      include: [{ model: User, as: "author", attributes: authorAttributes }],
    }),
  ]);

  const totalPages = threadTotal === 0 ? 0 : Math.ceil(threadTotal / limit);
  const rootIds = rows.map((r) => Number(r.get("id")));

  if (rootIds.length === 0) {
    return {
      comments: [] as Record<string, unknown>[],
      threadTotal,
      commentTotal,
      totalPages,
    };
  }

  const flatRows = await Comment.findAll({
    where: {
      postId,
      rootId: { [Op.in]: rootIds },
      parentId: { [Op.ne]: null },
    },
    order: [
      ["createdAt", "ASC"],
      ["id", "ASC"],
    ],
    include: [{ model: User, as: "author", attributes: authorAttributes }],
  });

  const parentIds = [...new Set(flatRows.map((r) => Number(r.get("parentId"))))];
  const parents = parentIds.length
    ? await Comment.findAll({
        where: { id: { [Op.in]: parentIds } },
        include: [{ model: User, as: "author", attributes: authorAttributes }],
      })
    : [];

  const parentById = new Map<number, Model>();
  for (const p of parents) {
    parentById.set(Number(p.get("id")), p);
  }

  const replyToByParentId = new Map<number, PostAuthorDto | null>();
  for (const pid of parentIds) {
    const pRow = parentById.get(pid);
    replyToByParentId.set(pid, toAuthorDto(pRow?.get("author") as Model | undefined) ?? null);
  }

  const byRoot = new Map<number, Record<string, unknown>[]>();
  for (const rid of rootIds) {
    byRoot.set(rid, []);
  }
  for (const replyRow of flatRows) {
    const rid = Number(replyRow.get("rootId"));
    const list = byRoot.get(rid);
    if (!list) continue;
    const pid = Number(replyRow.get("parentId"));
    const replyToUser = replyToByParentId.get(pid) ?? null;
    list.push(commentRowToJson(replyRow, replyToUser));
  }

  const comments = rows.map((root) => {
    const rid = Number(root.get("id"));
    const rootJson = commentRowToJson(root, null);
    rootJson.replies = byRoot.get(rid) ?? [];
    return rootJson;
  });

  return { comments, threadTotal, commentTotal, totalPages };
}

export async function createComment(
  postId: string | number,
  authorId: number,
  payload: Record<string, unknown>,
) {
  await findPostByIdPublic(postId, authorId);

  const content = trimmedStringFromUnknown(payload.content);
  if (!content) {
    throw createHttpError(400, "评论内容不能为空");
  }

  let parentId: number | null = null;
  let rootId: number | null = null;

  if (payload.parentId != null) {
    const parent = await Comment.findByPk(payload.parentId as number);
    if (!parent || Number(parent.get("postId")) !== Number(postId)) {
      throw createHttpError(400, "父评论不存在或不属于该文章");
    }
    parentId = Number(parent.get("id"));
    const pParentId = parent.get("parentId") as number | null;
    if (pParentId == null) {
      rootId = parentId;
    } else {
      const pRoot = parent.get("rootId") as number | null;
      if (pRoot == null) {
        throw createHttpError(400, "父评论数据不完整，请联系管理员执行数据修复");
      }
      rootId = pRoot;
    }
  }

  const comment = await Comment.create({
    postId,
    authorId,
    parentId,
    content,
    rootId,
  });

  if (parentId == null) {
    const cid = Number(comment.get("id"));
    await comment.update({ rootId: cid });
  }

  await syncCommentCountForPost(postId);

  const fresh = await Comment.findByPk(comment.get("id") as number, {
    include: [{ model: User, as: "author", attributes: authorAttributes }],
  });
  if (!fresh) {
    throw createHttpError(500, "评论创建后读取失败");
  }

  let replyToUser: PostAuthorDto | null = null;
  if (parentId != null) {
    const parentRow = await Comment.findByPk(parentId, {
      include: [{ model: User, as: "author", attributes: authorAttributes }],
    });
    replyToUser = toAuthorDto(parentRow?.get("author") as Model | undefined) ?? null;
  }

  return commentRowToJson(fresh, replyToUser);
}

export async function removeComment(
  postId: string | number,
  commentId: string | number,
  operator: AppJwtUser | undefined,
) {
  const post = await Post.findByPk(postId);
  if (!post) {
    throw createHttpError(404, "文章不存在");
  }

  const user = await User.findByPk(operator?.id);
  if (!user) {
    throw createHttpError(401, "未登录或登录已过期");
  }

  const comment = await Comment.findByPk(commentId);
  if (!comment || Number(comment.get("postId")) !== Number(postId)) {
    throw createHttpError(404, "评论不存在");
  }

  if (
    !canDeleteComment(comment, post, {
      id: user.get("id") as number,
      role: user.get("role") as number,
    })
  ) {
    throw createHttpError(403, "无权删除该评论");
  }

  await comment.destroy();
  await syncCommentCountForPost(postId);
}
