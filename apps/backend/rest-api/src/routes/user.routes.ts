import express from "express";

import { getMe } from "../controllers/user.controller.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import { getMeSchema } from "../schema/user.schema.js";

const router = express.Router();

router.get("/me", authMiddleware, validate(getMeSchema), asyncHandler(getMe, "获取当前用户失败"));
router.get(
  "/users/me",
  authMiddleware,
  validate(getMeSchema),
  asyncHandler(getMe, "获取当前用户失败"),
);

export default router;
