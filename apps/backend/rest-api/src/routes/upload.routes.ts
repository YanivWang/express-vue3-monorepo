import express from "express";

import { uploadImagesMiddleware, uploadProfileImagesMiddleware } from "../config/upload.config.js";
import { postUploadImages } from "../controllers/upload.controller.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.post(
  "/uploads",
  authMiddleware,
  uploadImagesMiddleware,
  asyncHandler(postUploadImages, "上传失败"),
);

router.post(
  "/uploads/profiles",
  authMiddleware,
  uploadProfileImagesMiddleware,
  asyncHandler(postUploadImages, "上传失败"),
);

export default router;
