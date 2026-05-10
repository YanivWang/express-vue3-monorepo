import { findPostByIdAdmin, findPostsPageAdmin } from "../services/post.service.js";
import { getValidated } from "../utils/getValidated.js";
import { success } from "../utils/response.js";

import type {
  ValidatedAdminGetPostSchema,
  ValidatedAdminListPostsSchema,
} from "../schema/admin.schema.js";
import type { Request, Response } from "express";
import type { Model } from "sequelize";

export async function listAdminPosts(req: Request, res: Response) {
  const { query } = getValidated<ValidatedAdminListPostsSchema>(req);

  const { page, limit, published, authorId, categoryId, parentId, q } = query;
  const { posts, total, totalPages } = await findPostsPageAdmin(page, limit, {
    published: published ?? null,
    authorId: authorId ?? null,
    categoryId: categoryId ?? null,
    parentId: parentId ?? null,
    q: q ?? null,
  });

  const hasNext = totalPages > 0 && page < totalPages;
  const payload = posts.map((p: Model) => p.get({ plain: true }) as Record<string, unknown>);
  return success(res, "获取管理端文章列表成功", {
    posts: payload,
    pagination: { page, limit, total, totalPages, hasNext },
  });
}

export async function getAdminPost(req: Request, res: Response) {
  const { params } = getValidated<ValidatedAdminGetPostSchema>(req);
  const model = await findPostByIdAdmin(params.id);
  const post = model.get({ plain: true }) as Record<string, unknown>;
  return success(res, "获取文章详情成功", { post });
}
