import { findCommentsPageAdmin } from "../services/comment.service.js";
import { getValidated } from "../utils/getValidated.js";
import { success } from "../utils/response.js";

import type { ValidatedAdminCommentsListSchema } from "../schema/admin.schema.js";
import type { Request, Response } from "express";

export async function listAdminComments(req: Request, res: Response) {
  const { query } = getValidated<ValidatedAdminCommentsListSchema>(req);
  const { page, limit, postId, authorId, q } = query;
  const { comments, total, totalPages } = await findCommentsPageAdmin(page, limit, {
    postId: postId ?? null,
    authorId: authorId ?? null,
    q: q ?? null,
  });
  const hasNext = totalPages > 0 && page < totalPages;
  return success(res, "评论列表成功", {
    comments,
    pagination: { page, limit, total, totalPages, hasNext },
  });
}
