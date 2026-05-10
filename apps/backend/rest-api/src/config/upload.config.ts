//crypto 模块：Node 原生密码学工具，负责加密、解密、哈希、安全随机数等所有安全操作
//randomBytes 专门生成不可预测的安全随机数
import { randomBytes } from "node:crypto"; //加密模块
import fs from "node:fs"; //文件系统模块
import path from "node:path"; //引入路径工具

import multer from "multer"; //处理表单文件上传工具(multipart/form-data)

import { projectRoot } from "../utils/projectRoot.js";

//从项目里的工具模块导入“项目根目录”的绝对路径，这样无论从哪里启动进程，上传目录都指向项目根下的固定位置。
export const uploadsRoot = path.join(projectRoot, "uploads");

//如果目标文件夹已经存在：
//正常执行，不抛出任何错误
//不覆盖、不修改已存在的文件夹
//保留文件夹内的原有内容
//直接静默跳过创建逻辑，继续执行后续代码
//{ recursive: true } 时，目录已存在则不报错，等价于“有则跳过”。
export function ensureUploadsRoot() {
  fs.mkdirSync(uploadsRoot, { recursive: true });

  //recursive: true 是这个方法的安全创建开关：
  // ❌ 错误写法：文件夹已存在时会抛错
  // 父目录不存在时也会失败
  // fs.mkdirSync(uploadsRoot);
}

const fileFilter: multer.Options["fileFilter"] = (_req, file, cb) => {
  const ok = /^image\/(jpeg|png|gif|webp)$/i.test(file.mimetype);
  if (!ok) {
    cb(new Error("仅支持 jpeg、png、gif、webp 图片"));
    return;
  }
  cb(null, true);
};

//在 JS 里，函数也是对象，可以在上面挂属性。
//定义上传的文件在磁盘上的存储策略
const storage = multer.diskStorage({
  //当前文件存储路径到目录
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
    //randomBytes(8)
    cb(null, `${Date.now()}-${randomBytes(8).toString("hex")}${suffix}`);
  },
});

/** 表单字段名 `files`，最多 12 个文件，单文件最大 5MB */
export const uploadImagesMiddleware = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024, files: 12 },
  fileFilter,
}).array("files", 12);

export function filePathToPublicUrl(absPath: string) {
  const rel = path.relative(uploadsRoot, absPath).split(path.sep).join("/");
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new Error("非法上传路径");
  }
  return `/uploads/${rel}`;
}
