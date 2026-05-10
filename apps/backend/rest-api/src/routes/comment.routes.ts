import express from "express";

import { addComment, deleteComment, getComments } from "../controllers/comment.controller.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { optionalAuthMiddleware } from "../middlewares/optionalAuth.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import {
  createCommentSchema,
  deleteCommentSchema,
  listCommentsSchema,
} from "../schema/comment.schema.js";

const router = express.Router();

router.get(
  "/posts/:postId/comments",
  optionalAuthMiddleware,
  validate(listCommentsSchema),
  asyncHandler(getComments, "获取评论列表失败"),
);

router.post(
  "/posts/:postId/comments",
  authMiddleware,
  validate(createCommentSchema),
  asyncHandler(addComment, "发表评论失败"),
);

router.delete(
  "/posts/:postId/comments/:commentId",
  authMiddleware,
  validate(deleteCommentSchema),
  asyncHandler(deleteComment, "删除评论失败"),
);

export default router;
