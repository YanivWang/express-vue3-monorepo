import express from "express";
import { getCategories } from "../controllers/category.controller.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";

const router = express.Router();

router.get("/categories", asyncHandler(getCategories, "获取分类失败"));

export default router;
