import path from "node:path";

import cors from "cors";
import express, { type RequestHandler } from "express";
import helmet from "helmet";

import { uploadsRoot } from "./config/upload.config.js";
import { TRUST_PROXY, getCorsOriginOption } from "./env.js";
import { compressionMiddleware } from "./middlewares/compression.middleware.js";
import { createHttpError, errorMiddleware } from "./middlewares/error.middleware.js";
import { httpRequestLogMiddleware } from "./middlewares/httpRequestLog.middleware.js";
import { globalRateLimitMiddleware } from "./middlewares/rateLimit.middleware.js";
import { requestIdMiddleware } from "./middlewares/requestId.middleware.js";
import adminRoutes from "./routes/admin.routes.js";
import authRoutes from "./routes/auth.routes.js";
import categoryRoutes from "./routes/category.routes.js";
import commentRoutes from "./routes/comment.routes.js";
import healthRoutes from "./routes/health.routes.js";
import postRoutes from "./routes/post.routes.js";
import uploadRoutes from "./routes/upload.routes.js";
import userRoutes from "./routes/user.routes.js";
import { setupSwagger } from "./swagger.js";

const app = express();

// Nginx/Ingress 后：TRUST_PROXY=1|true 信任一层；纯数字为 hop 数
const tp = TRUST_PROXY;
if (tp === "1" || tp?.toLowerCase() === "true") {
  app.set("trust proxy", 1);
} else if (tp && /^\d+$/.test(tp)) {
  app.set("trust proxy", Number(tp));
}

// Swagger 页关闭 CSP，避免 Helmet 影响 UI
const defaultHelmet = helmet();
const swaggerHelmet = helmet({ contentSecurityPolicy: false });
const helmetPick: RequestHandler = (req, res, next) => {
  if (req.path.startsWith("/api-docs")) {
    return swaggerHelmet(req, res, next);
  }
  return defaultHelmet(req, res, next);
};
app.use(helmetPick);

// credentials 必须开启：刷新令牌走 Cookie，跨域场景（Vite 5173 → API 3000）下
// 浏览器只有在 Access-Control-Allow-Credentials 为 true 且 Origin 非通配时才会收发它。
// 生产环境 CORS_ORIGINS 未配置时 getCorsOriginOption() 返回 false，即不开放跨域。
app.use(cors({ origin: getCorsOriginOption(), credentials: true }));
app.use(requestIdMiddleware);
app.use(httpRequestLogMiddleware);
/**
 * 用户上传物与前端**同源**，因此这里必须假定「万一有文件带着危险扩展名落了盘」。
 *
 * 第一道防线在 large-upload.service.ts（成品扩展名只能取自白名单）；这里是第二道：
 * 凡不属于「需要被浏览器内嵌渲染」的类型，一律带 `Content-Disposition: attachment` 下发，
 * 于是即便真有 `.html` 落盘，直接访问它也只会触发下载而不是渲染成同源文档。
 *
 * 内嵌白名单只放图片与视频：它们是正文里 `<img>` / `<video>` 的引用目标。
 * 子资源加载（img/video/audio）本就不理会 Content-Disposition，把它们列出来是为了让意图显式，
 * 而不是依赖浏览器的这条实现细节。
 */
const INLINE_SAFE_UPLOAD_EXT = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".webp",
  ".mp4",
  ".webm",
  ".mov",
]);

app.use(
  "/uploads",
  express.static(uploadsRoot, {
    setHeaders(res, filePath) {
      if (!INLINE_SAFE_UPLOAD_EXT.has(path.extname(filePath).toLowerCase())) {
        res.setHeader("Content-Disposition", "attachment");
      }
    },
  }),
);
app.use(healthRoutes);
app.use(globalRateLimitMiddleware);
app.use(compressionMiddleware);
app.use(express.json());
setupSwagger(app);

app.use("/api", authRoutes);
app.use("/api", userRoutes);
app.use("/api", postRoutes);
app.use("/api", commentRoutes);
app.use("/api", categoryRoutes);
app.use("/api", uploadRoutes);
app.use("/api/admin", adminRoutes);

app.use((_req, _res, next) => {
  next(createHttpError(404, "接口不存在"));
});

app.use(errorMiddleware);

export default app;
