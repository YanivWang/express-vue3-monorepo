import express from "express";

import { createCategory, getCategories } from "../controllers/category.controller.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import { createCategorySchema } from "../schema/category.schema.js";

const router = express.Router();

router.post(
  "/categories",
  authMiddleware,
  validate(createCategorySchema),
  asyncHandler(createCategory, "创建分类失败"),
);
router.get("/categories", asyncHandler(getCategories, "获取分类失败"));

export default router;
