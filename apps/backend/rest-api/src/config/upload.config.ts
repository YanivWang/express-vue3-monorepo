import { randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import multer from "multer";

import { projectRoot } from "../utils/projectRoot.js";

/** 上传根目录：monorepo 根 `uploads/` */
export const uploadsRoot = path.join(projectRoot, "uploads");

/** 帖子插图：`POST /api/uploads` → `<uploadsRoot>/posts/<年>/<月>/` → `/uploads/posts/…` */
export const postUploadDiskSegment = "posts";

/** 用户头像等：`POST /api/uploads/profiles` → `<uploadsRoot>/profiles/<年>/<月>/` → `/uploads/profiles/…` */
export const profileUploadDiskSegment = "profiles";

export function ensureUploadsRoot() {
  fs.mkdirSync(uploadsRoot, { recursive: true });
}

const fileFilter: multer.Options["fileFilter"] = (_req, file, cb) => {
  const ok = /^image\/(jpeg|png|gif|webp)$/i.test(file.mimetype);
  if (!ok) {
    cb(new Error("仅支持 jpeg、png、gif、webp 图片"));
    return;
  }
  cb(null, true);
};

function createYmDiskStorage(diskSegment: string): multer.StorageEngine {
  return multer.diskStorage({
    destination(_req, _file, cb) {
      const now = new Date();
      const y = String(now.getFullYear());
      const m = String(now.getMonth() + 1).padStart(2, "0");
      const dir = path.join(uploadsRoot, diskSegment, y, m);
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename(_req, file, cb) {
      const ext = path.extname(file.originalname || "").toLowerCase();
      const allowed = [".jpg", ".jpeg", ".png", ".gif", ".webp"];
      const suffix = allowed.includes(ext) ? ext : "";
      cb(null, `${Date.now()}-${randomBytes(8).toString("hex")}${suffix}`);
    },
  });
}

const postStorage = createYmDiskStorage(postUploadDiskSegment);
const profileStorage = createYmDiskStorage(profileUploadDiskSegment);

/** 表单字段名 `files`，富文本插图最多 9 个，单文件最大 8MB */
export const uploadImagesMiddleware = multer({
  storage: postStorage,
  limits: { fileSize: 8 * 1024 * 1024, files: 9 },
  fileFilter,
}).array("files", 9);

/** 头像等：`POST /api/uploads/profiles` → `profiles/`，单次仅 1 个文件，单文件最大 8MB */
export const uploadProfileImagesMiddleware = multer({
  storage: profileStorage,
  limits: { fileSize: 8 * 1024 * 1024, files: 1 },
  fileFilter,
}).array("files", 1);

export function filePathToPublicUrl(absPath: string) {
  const rel = path.relative(uploadsRoot, absPath).split(path.sep).join("/");
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new Error("非法上传路径");
  }
  return `/uploads/${rel}`;
}
