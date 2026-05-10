// 应用文件: 创建 Express 服务 + 注册中间件 + 注册路由

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
import authRoutes from "./routes/auth.routes.js";
import categoryRoutes from "./routes/category.routes.js";
import commentRoutes from "./routes/comment.routes.js";
import healthRoutes from "./routes/health.routes.js";
import postRoutes from "./routes/post.routes.js";
import uploadRoutes from "./routes/upload.routes.js";
import userRoutes from "./routes/user.routes.js";
import { setupSwagger } from "./swagger.js";

//创建express服务
const app = express();

// 位于 Nginx/Ingress 之后时设置 TRUST_PROXY（1 或 true = 信任一层代理；纯数字 = hop 数）
const tp = TRUST_PROXY;
if (tp === "1" || tp?.toLowerCase() === "true") {
  app.set("trust proxy", 1);
} else if (tp && /^\d+$/.test(tp)) {
  app.set("trust proxy", Number(tp));
}

//注册 / 挂载中间件 ======================================
// (全局中间件，对所有路由都生效)
//之后进来的每个请求（在匹配规则下）会按 app.use 的先后顺序依次经过这些中间件。

// helmet 是 Express 里的安全中间件，用来自动设置一组常见的 HTTP 安全响应头，降低一些 Web 攻击风险
// 使用helmet中间件来增强安全性
// Helmet 默认会启用 Content-Security-Policy，有时会影响 Swagger UI，所以只对 Swagger 文档页关闭 CSP
const defaultHelmet = helmet();
const swaggerHelmet = helmet({
  contentSecurityPolicy: false,
});
const helmetPick: RequestHandler = (req, res, next) => {
  if (req.path.startsWith("/api-docs")) {
    return swaggerHelmet(req, res, next);
  }
  return defaultHelmet(req, res, next);
};
app.use(helmetPick);

// CORS：开发/测试未配置 CORS_ORIGINS 时允许任意 Origin；生产须配置逗号分隔列表，未配置则关闭跨域
app.use(cors({ origin: getCorsOriginOption() }));

// 请求追踪：入站 X-Request-Id 透传，否则生成并写入响应头
app.use(requestIdMiddleware);

// 记录每次 HTTP 请求的基础信息和耗时（用于监控）
// 放在限流、body 解析之前，以便访问日志覆盖 429、JSON 解析失败等仍会正常结束响应的请求
app.use(httpRequestLogMiddleware);

// 使用express内置中间件函数提供静态资源服务
// 用户上传的图片静态资源，不参与 API 全局限流
// 现在可以访问具有/uploads路径前缀的 uploadsRoot 目录下的文件
app.use("/uploads", express.static(uploadsRoot));

// 存活/就绪（限流中间件已跳过 /health、/ready）
app.use(healthRoutes);

//全局请求频率限制（对所有路由都生效）
app.use(globalRateLimitMiddleware);

// 仅压缩较大的 API JSON（阈值见 compression 中间件）；HTML/CSS/JS 等由 CDN/Nginx 处理
app.use(compressionMiddleware);

//express.json() 解析请求体中的json数据
app.use(express.json());

// 配置 Swagger UI 和契约文件
// Swagger UI：/api-docs ；契约文件：docs/openapi.yaml ，运行时可 GET /openapi.yaml 给 Apifox 导入
setupSwagger(app);

// 业务路由 ======================================
// 往往是「路由里最靠后的那个处理函数」（例如 controller）在响应，而不是 app.js 里最后那一行 app.use
//"/api"：挂载路径前缀，所有路由都会以"/api"开头
// authRoutes / userRoutes：都是 express.Router()，当成一整块中间件挂在 /api 下面
// app.use("/api", xxx) = 把 xxx 这套路由表接到 /api 后面；真实路径 = /api + 子路由里的 path。
app.use("/api", authRoutes);
app.use("/api", userRoutes);
app.use("/api", postRoutes);
app.use("/api", commentRoutes);
app.use("/api", categoryRoutes);
app.use("/api", uploadRoutes);
// 404 兜底：未匹配任何已注册路由时进入此处，交给 errorMiddleware 输出统一错误格式
//（若去掉本段，则会落到 Express 默认 404，响应格式与业务错误不一致）
app.use((_req, _res, next) => {
  next(createHttpError(404, "接口不存在"));
});

// 全局错误处理（含上一步传入的 404），放在所有路由与 404 兜底之后
app.use(errorMiddleware);

export default app;
