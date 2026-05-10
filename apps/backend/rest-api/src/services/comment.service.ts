import { Comment, Post, User } from "../db.js";
import { createHttpError } from "../middlewares/error.middleware.js";

import { findPostByIdPublic } from "./post.service.js";

import type { AppJwtUser } from "../types/jwt-user.js";
import type { Model } from "sequelize";

const authorAttributes = ["id", "username", "avatar"];

/** 是否与 post.service 的 canEdit 语义一致：作者或 admin */
function canModeratePost(post: Model, operator: { id: number; role?: number }) {
  const uid = Number(operator.id);
  if (Number(post.get("authorId")) === uid) return true;
  return Number(operator.role) === 1;
}

function canDeleteComment(comment: Model, post: Model, operator: { id: number; role?: number }) {
  const uid = Number(operator.id);
  if (Number(comment.get("authorId")) === uid) return true;
  if (canModeratePost(post, operator)) return true;
  return false;
}

export async function findCommentsPageByPost(
  postId: string | number,
  viewerUserId: number | null,
  page: number,
  limit: number,
) {
  await findPostByIdPublic(postId, viewerUserId);

  const offset = (page - 1) * limit;
  const where = { postId, parentId: null };

  const [rows, total] = await Promise.all([
    Comment.findAll({
      where,
      limit,
      offset,
      order: [["id", "DESC"]],
      include: [
        { model: User, as: "author", attributes: authorAttributes },
        {
          model: Comment,
          as: "replies",
          separate: true,
          order: [["id", "ASC"]],
          include: [{ model: User, as: "author", attributes: authorAttributes }],
        },
      ],
    }),
    Comment.count({ where }),
  ]);

  const totalPages = total === 0 ? 0 : Math.ceil(total / limit);
  return { comments: rows, total, totalPages };
}

export async function createComment(
  postId: string | number,
  authorId: number,
  payload: Record<string, unknown>,
) {
  await findPostByIdPublic(postId, authorId);

  const content = String(payload.content ?? "").trim();
  if (!content) {
    throw createHttpError(400, "评论内容不能为空");
  }

  let parentId: number | null = null;
  if (payload.parentId != null) {
    const parent = await Comment.findByPk(payload.parentId as number);
    if (!parent || Number(parent.get("postId")) !== Number(postId)) {
      throw createHttpError(400, "父评论不存在或不属于该文章");
    }
    parentId = parent.get("id") as number;
  }

  const comment = await Comment.create({
    postId,
    authorId,
    parentId,
    content,
  });

  return Comment.findByPk(comment.get("id") as number, {
    include: [{ model: User, as: "author", attributes: authorAttributes }],
  });
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
}
