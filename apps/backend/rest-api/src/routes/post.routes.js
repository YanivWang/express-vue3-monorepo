import express from "express";
import {
  addPost,
  deletePost,
  getMyPosts,
  getPost,
  getPosts,
  patchPost,
} from "../controllers/post.controller.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import {
  createPostSchema,
  deletePostSchema,
  getPostSchema,
  listMyPostsSchema,
  listPostsSchema,
  updatePostSchema,
} from "../schema/post.schema.js";

const router = express.Router();

// —— 公开 —— //
router.get("/posts", validate(listPostsSchema), asyncHandler(getPosts, "获取文章列表失败"));

// 若实现「我的文章」，必须放在 /posts/:id 之前
router.get(
  "/posts/mine/list",
  authMiddleware,
  validate(listMyPostsSchema),
  asyncHandler(getMyPosts, "获取我的文章失败"),
);

// 公开读详情（未登录）：请使用仅校验“已发布”的 getPost 实现，或单独 getPostPublic
router.get("/posts/:id", validate(getPostSchema), asyncHandler(getPost, "获取文章失败"));

// —— 需登录 —— //
router.post(
  "/posts",
  authMiddleware,
  validate(createPostSchema),
  asyncHandler(addPost, "创建文章失败"),
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
