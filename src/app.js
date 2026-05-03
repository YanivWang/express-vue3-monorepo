// 应用文件: 创建 Express 服务 + 注册中间件 + 注册路由

import express from "express";
import cors from "cors";
import { setupSwagger } from "./swagger.js";
import authRoutes from "./routes/auth.routes.js";
import userRoutes from "./routes/user.routes.js";
import { errorMiddleware } from "./middlewares/error.middleware.js";

//创建express服务
const app = express();

//使用中间件=====
//cors 解决跨域问题
app.use(cors());
//express.json() 解析请求体中的json数据
app.use(express.json());

// Swagger UI：/api-docs ；契约文件：docs/openapi.yaml ，运行时可 GET /openapi.yaml 给 Apifox 导入
setupSwagger(app);

// 业务路由 ======================================
app.use("/api", authRoutes);
app.use("/api", userRoutes);

app.use(errorMiddleware);

export default app;
