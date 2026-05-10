import { createHttpError } from "../middlewares/error.middleware.js";
import {
  createComment,
  findCommentsPageByPost,
  removeComment,
} from "../services/comment.service.js";
import { getValidated } from "../utils/getValidated.js";
import { success } from "../utils/response.js";

import type {
  ValidatedCreateCommentSchema,
  ValidatedDeleteCommentSchema,
  ValidatedListCommentsSchema,
} from "../schema/comment.schema.js";
import type { Request, Response } from "express";

export async function getComments(req: Request, res: Response) {
  const { params, query } = getValidated<ValidatedListCommentsSchema>(req);
  const { postId } = params;
  const { page, limit } = query;
  const viewerUserId = req.user?.id ?? null;
  const { comments, total, totalPages } = await findCommentsPageByPost(
    postId,
    viewerUserId,
    page,
    limit,
  );
  const hasNext = totalPages > 0 && page < totalPages;
  return success(res, "获取评论列表成功", {
    comments,
    pagination: { page, limit, total, totalPages, hasNext },
  });
}

export async function addComment(req: Request, res: Response) {
  const { params, body } = getValidated<ValidatedCreateCommentSchema>(req);
  const uid = req.user?.id;
  if (uid === undefined) {
    throw createHttpError(401, "未登录或登录已过期");
  }
  const comment = await createComment(params.postId, uid, body);
  return success(res, "发表评论成功", { comment });
}

export async function deleteComment(req: Request, res: Response) {
  const { params } = getValidated<ValidatedDeleteCommentSchema>(req);
  const user = req.user;
  if (!user) {
    throw createHttpError(401, "未登录或登录已过期");
  }
  await removeComment(params.postId, params.commentId, user);
  return success(res, "删除评论成功");
}
