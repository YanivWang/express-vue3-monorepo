import express from "express";
import { postUploadImages } from "../controllers/upload.controller.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { uploadImagesMiddleware } from "../config/upload.config.js";

const router = express.Router();

router.post(
  "/uploads",
  authMiddleware,
  uploadImagesMiddleware,
  asyncHandler(postUploadImages, "上传失败"),
);

export default router;
