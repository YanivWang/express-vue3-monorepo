import { createHttpError } from "../middlewares/error.middleware.js";
import { findFavoritePostsPage, setPostFavorite } from "../services/post-favorite.service.js";
import { setPostVote } from "../services/post-vote.service.js";
import {
  createPost,
  decoratePostsListForViewer,
  enrichPublicPostForResponse,
  findMyPostsPage,
  findPostByIdPublic,
  findPostsPagePublic,
  removePostById,
  updatePostById,
} from "../services/post.service.js";
import { getValidated } from "../utils/getValidated.js";
import { success } from "../utils/response.js";

import type {
  ValidatedCreatePostSchema,
  ValidatedDeletePostSchema,
  ValidatedFavoritePostSchema,
  ValidatedGetPostSchema,
  ValidatedListFavoritesSchema,
  ValidatedListMyPostsSchema,
  ValidatedListPostsSchema,
  ValidatedUpdatePostSchema,
  ValidatedVotePostSchema,
} from "../schema/post.schema.js";
import type { Request, Response } from "express";

export async function getPosts(req: Request, res: Response) {
  const { query } = getValidated<ValidatedListPostsSchema>(req);
  const { page, limit, parentId, categoryId, q, sort } = query;
  const searchTerm = q?.trim() || undefined;
  const { posts, total, totalPages } = await findPostsPagePublic(page, limit, {
    parentId,
    categoryId,
    q: searchTerm,
    sort,
  });
  const hasNext = totalPages > 0 && page < totalPages;
  const viewerId = req.user?.id ?? null;
  const payload = await decoratePostsListForViewer(posts, viewerId);
  return success(res, "获取文章列表成功", {
    posts: payload,
    pagination: { page, limit, total, totalPages, hasNext },
  });
}

export async function getMyPosts(req: Request, res: Response) {
  const { query } = getValidated<ValidatedListMyPostsSchema>(req);
  const { page, limit, parentId, categoryId } = query;
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

export async function getFavoritePosts(req: Request, res: Response) {
  const uid = req.user?.id;
  if (uid === undefined) {
    throw createHttpError(401, "未登录或登录已过期");
  }
  const { query } = getValidated<ValidatedListFavoritesSchema>(req);
  const { page, limit } = query;
  const { posts, total, totalPages } = await findFavoritePostsPage(uid, page, limit);
  const hasNext = totalPages > 0 && page < totalPages;
  const decorated = await decoratePostsListForViewer(posts, uid);
  return success(res, "获取收藏文章成功", {
    posts: decorated,
    pagination: { page, limit, total, totalPages, hasNext },
  });
}

export async function getPost(req: Request, res: Response) {
  const { params } = getValidated<ValidatedGetPostSchema>(req);
  const postModel = await findPostByIdPublic(params.id, req.user?.id ?? null);
  const post = await enrichPublicPostForResponse(postModel, req.user?.id ?? null);
  return success(res, "获取文章成功", { post });
}

export async function putPostVote(req: Request, res: Response) {
  const uid = req.user?.id;
  if (uid === undefined) {
    throw createHttpError(401, "未登录或登录已过期");
  }
  const { params, body } = getValidated<ValidatedVotePostSchema>(req);
  await setPostVote(uid, params.id, body.vote);
  const postModel = await findPostByIdPublic(params.id, uid);
  const post = await enrichPublicPostForResponse(postModel, uid, { bumpView: false });
  return success(res, "投票成功", { post });
}

export async function putPostFavorite(req: Request, res: Response) {
  const uid = req.user?.id;
  if (uid === undefined) {
    throw createHttpError(401, "未登录或登录已过期");
  }
  const { params, body } = getValidated<ValidatedFavoritePostSchema>(req);
  await setPostFavorite(uid, params.id, body.favorited);
  const postModel = await findPostByIdPublic(params.id, uid);
  const post = await enrichPublicPostForResponse(postModel, uid, { bumpView: false });
  return success(res, "收藏已更新", { post });
}

export async function addPost(req: Request, res: Response) {
  const uid = req.user?.id;
  if (uid === undefined) {
    throw createHttpError(401, "未登录或登录已过期");
  }
  const { body } = getValidated<ValidatedCreatePostSchema>(req);
  const post = await createPost(uid, body);
  return success(res, "创建文章成功", { post });
}

export async function patchPost(req: Request, res: Response) {
  const user = req.user;
  if (!user) {
    throw createHttpError(401, "未登录或登录已过期");
  }
  const { params, body } = getValidated<ValidatedUpdatePostSchema>(req);
  const post = await updatePostById(params.id, user, body);
  return success(res, "更新文章成功", { post });
}

export async function deletePost(req: Request, res: Response) {
  const user = req.user;
  if (!user) {
    throw createHttpError(401, "未登录或登录已过期");
  }
  const { params } = getValidated<ValidatedDeletePostSchema>(req);
  await removePostById(params.id, user);
  return success(res, "删除文章成功");
}
