import { randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import multer from "multer";
import { projectRoot } from "../utils/projectRoot.js";

export const uploadsRoot = path.join(projectRoot, "uploads");

export function ensureUploadsRoot() {
  fs.mkdirSync(uploadsRoot, { recursive: true });
}

function fileFilter(_req, file, cb) {
  const ok = /^image\/(jpeg|png|gif|webp)$/i.test(file.mimetype);
  if (!ok) {
    cb(new Error("仅支持 jpeg、png、gif、webp 图片"));
    return;
  }
  cb(null, true);
}

const storage = multer.diskStorage({
  destination(_req, _file, cb) {
    const now = new Date();
    const y = String(now.getFullYear());
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const dir = path.join(uploadsRoot, y, m);
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

/** 表单字段名 `files`，最多 12 个文件，单文件最大 5MB */
export const uploadImagesMiddleware = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024, files: 12 },
  fileFilter,
}).array("files", 12);

export function filePathToPublicUrl(absPath) {
  const rel = path.relative(uploadsRoot, absPath).split(path.sep).join("/");
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new Error("非法上传路径");
  }
  return `/uploads/${rel}`;
}
