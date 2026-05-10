import express from "express";

import {
  addPost,
  deletePost,
  getFavoritePosts,
  getMyPosts,
  getPost,
  getPosts,
  patchPost,
  putPostFavorite,
  putPostVote,
} from "../controllers/post.controller.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { optionalAuthMiddleware } from "../middlewares/optionalAuth.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import {
  createPostSchema,
  deletePostSchema,
  favoritePostSchema,
  getPostSchema,
  listFavoritesSchema,
  listMyPostsSchema,
  listPostsSchema,
  updatePostSchema,
  votePostSchema,
} from "../schema/post.schema.js";

const router = express.Router();

router.get(
  "/posts",
  optionalAuthMiddleware,
  validate(listPostsSchema),
  asyncHandler(getPosts, "获取文章列表失败"),
);

router.get(
  "/posts/favorites",
  authMiddleware,
  validate(listFavoritesSchema),
  asyncHandler(getFavoritePosts, "获取收藏列表失败"),
);

router.get(
  "/posts/mine/list",
  authMiddleware,
  validate(listMyPostsSchema),
  asyncHandler(getMyPosts, "获取我的文章失败"),
);

router.get(
  "/posts/:id",
  optionalAuthMiddleware,
  validate(getPostSchema),
  asyncHandler(getPost, "获取文章失败"),
);

router.post(
  "/posts",
  authMiddleware,
  validate(createPostSchema),
  asyncHandler(addPost, "创建文章失败"),
);
router.put(
  "/posts/:id/vote",
  authMiddleware,
  validate(votePostSchema),
  asyncHandler(putPostVote, "投票失败"),
);
router.put(
  "/posts/:id/favorite",
  authMiddleware,
  validate(favoritePostSchema),
  asyncHandler(putPostFavorite, "更新收藏失败"),
);
router.put(
  "/posts/:id",
  authMiddleware,
  validate(updatePostSchema),
  asyncHandler(patchPost, "更新文章失败"),
);
router.delete(
  "/posts/:id",
  authMiddleware,
  validate(deletePostSchema),
  asyncHandler(deletePost, "删除文章失败"),
);

export default router;
