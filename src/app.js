// 应用文件: 创建 Express 服务 + 注册中间件 + 注册路由

import express from "express";
import cors from "cors";
import { setupSwagger } from "./swagger.js";
import authRoutes from "./routes/auth.routes.js";
import userRoutes from "./routes/user.routes.js";
import { createHttpError, errorMiddleware } from "./middlewares/error.middleware.js";

//创建express服务
const app = express();

//注册 / 挂载中间件=====(全局中间件，对所有路由都生效)
//之后进来的每个请求（在匹配规则下）会按 app.use 的先后顺序依次经过这些中间件。
//cors 解决跨域问题
app.use(cors());
//express.json() 解析请求体中的json数据
app.use(express.json());

// Swagger UI：/api-docs ；契约文件：docs/openapi.yaml ，运行时可 GET /openapi.yaml 给 Apifox 导入
setupSwagger(app);

// 业务路由 ======================================
// 往往是「路由里最靠后的那个处理函数」（例如 controller）在响应，而不是 app.js 里最后那一行 app.use

//"/api"：挂载路径前缀，所有路由都会以"/api"开头

// authRoutes / userRoutes：都是 express.Router()，当成一整块中间件挂在 /api 下面

// app.use("/api", xxx) = 把 xxx 这套路由表接到 /api 后面；真实路径 = /api + 子路由里的 path。
app.use("/api", authRoutes);
app.use("/api", userRoutes);

// 专门的 404 not found 兜底中间件，
// 所以访问不存在的接口时可能还是 Express 默认 404，不一定走统一响应格式
// 做法就是：在所有业务路由之后、errorMiddleware 之前，加一个兜底中间件：
// 这样就会走统一的响应
app.use((req, res, next) => {
  next(createHttpError(404, "接口不存在"));
});

// 注册全局错误处理中间件
//它在所有路由后面，所以能作为最后兜底。
app.use(errorMiddleware);

export default app;
