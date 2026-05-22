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

app.use(cors({ origin: getCorsOriginOption() }));
app.use(requestIdMiddleware);
app.use(httpRequestLogMiddleware);
app.use("/uploads", express.static(uploadsRoot));
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
