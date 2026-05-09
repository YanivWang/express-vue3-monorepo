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

//1.先鉴权(看有么有权限访问这个接口)
//2.校验入参，看参数对不对
//3.调用controller中对应的方法来处理当前路由(a.先取清洗后的参数 b.传递service方法)
//4.controller调用service方法来进行数据库操作获取最终结果
//5.controller负责把结果响应给客户端
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
