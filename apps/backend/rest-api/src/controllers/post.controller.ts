import { createHttpError } from "../middlewares/error.middleware.js";
import {
  createPost,
  findMyPostsPage,
  findPostByIdPublic,
  findPostsPagePublic,
  removePostById,
  updatePostById,
} from "../services/post.service.js";
import { success } from "../utils/response.js";

import type { Request, Response } from "express";

export async function getPosts(req: Request, res: Response) {
  const { page, limit, parentId, categoryId } = req.query as unknown as {
    page: number;
    limit: number;
    parentId?: number;
    categoryId?: number;
  };
  const { posts, total, totalPages } = await findPostsPagePublic(page, limit, {
    parentId,
    categoryId,
  });
  const hasNext = totalPages > 0 && page < totalPages;
  return success(res, "获取文章列表成功", {
    posts,
    pagination: { page, limit, total, totalPages, hasNext },
  });
}

export async function getMyPosts(req: Request, res: Response) {
  const { page, limit, parentId, categoryId } = req.query as unknown as {
    page: number;
    limit: number;
    parentId?: number;
    categoryId?: number;
  };
  const uid = req.user?.id;
  if (uid === undefined) {
    throw createHttpError(401, "未登录或登录已过期");
  }
  const { posts, total, totalPages } = await findMyPostsPage(uid, page, limit, {
    parentId,
    categoryId,
  });
  const hasNext = totalPages > 0 && page < totalPages;
  return success(res, "获取我的文章成功", {
    posts,
    pagination: { page, limit, total, totalPages, hasNext },
  });
}

export async function getPost(req: Request, res: Response) {
  const post = await findPostByIdPublic(req.params.id, req.user?.id ?? null);
  return success(res, "获取文章成功", { post });
}

export async function addPost(req: Request, res: Response) {
  const uid = req.user?.id;
  if (uid === undefined) {
    throw createHttpError(401, "未登录或登录已过期");
  }
  const post = await createPost(uid, req.body);
  return success(res, "创建文章成功", { post });
}

export async function patchPost(req: Request, res: Response) {
  const user = req.user;
  if (!user) {
    throw createHttpError(401, "未登录或登录已过期");
  }
  const post = await updatePostById(req.params.id, user, req.body);
  return success(res, "更新文章成功", { post });
}

export async function deletePost(req: Request, res: Response) {
  const user = req.user;
  if (!user) {
    throw createHttpError(401, "未登录或登录已过期");
  }
  await removePostById(req.params.id, user);
  return success(res, "删除文章成功");
}
