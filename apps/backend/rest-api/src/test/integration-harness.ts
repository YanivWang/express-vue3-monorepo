/**
 * 集成测试基座：把「真实 Express 应用 + 真实 MySQL + 真实 Redis」拉起来打真实 HTTP。
 *
 * 为什么不用 supertest：Node 22 内置 fetch 已足够，且本仓当前无法从私有 registry 拉新依赖。
 * 更重要的是，走真实端口能一并覆盖监听、中间件顺序、JSON 解析、错误中间件等
 * 「只在完整 HTTP 栈里才会暴露」的问题——这正是原先 5 个纯函数单测覆盖不到的部分。
 *
 * 隔离策略：每个测试文件独占一个数据库（名字带文件标识），通过迁移建表，
 * 因此集成测试跑的是与生产同一套 DDL，而不是另建一套「测试专用 schema」。
 */
import { createServer, type Server } from "node:http";
import { AddressInfo } from "node:net";

import mysql from "mysql2/promise";

/** 必须在 import 应用代码之前设置好环境，因为 src/env.ts 在模块加载时即固化配置 */
export function prepareTestEnv(databaseName: string): void {
  process.env.APP_ENV = "test";
  process.env.NODE_ENV = "test";
  process.env.DB_NAME = databaseName;
  process.env.LOG_LEVEL = process.env.LOG_LEVEL ?? "error";
  // 集成测试会在极短时间内密集调用登录/注册，生产阈值会误伤；此处放宽的是测试进程自身的环境
  process.env.RATE_LIMIT_GLOBAL_MAX = "100000";
  process.env.RATE_LIMIT_AUTH_MAX = "100000";
  process.env.JWT_SECRET =
    process.env.JWT_SECRET ?? "integration_test_secret_at_least_32_chars_long";
  // 迁移由基座显式驱动，避免与应用启动期迁移重复执行
  process.env.DB_AUTO_MIGRATE = "0";
}

interface DbConnectionEnv {
  host: string;
  port: number;
  user: string;
  password: string;
}

function dbConnectionEnv(): DbConnectionEnv {
  const missing = ["DB_HOST", "DB_USER", "DB_PWD"].filter((k) => !process.env[k]);
  if (missing.length > 0) {
    throw new Error(
      `[integration] 缺少数据库环境变量: ${missing.join(", ")}。\n` +
        "集成测试需要真实 MySQL 与 Redis；本地可执行 pnpm docker:dev 起依赖，CI 由 service containers 提供。",
    );
  }
  return {
    host: process.env.DB_HOST ?? "127.0.0.1",
    port: Number(process.env.DB_PORT ?? 3306),
    user: process.env.DB_USER ?? "root",
    password: process.env.DB_PWD ?? "",
  };
}

/** 重建测试库：每个测试文件从确定的空库开始，避免用例间互相污染 */
export async function recreateTestDatabase(databaseName: string): Promise<void> {
  const conn = await mysql.createConnection(dbConnectionEnv());
  const quoted = `\`${databaseName.replace(/`/g, "``")}\``;
  try {
    await conn.query(`DROP DATABASE IF EXISTS ${quoted}`);
    await conn.query(`CREATE DATABASE ${quoted} CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci`);
  } finally {
    await conn.end();
  }
}

export async function dropTestDatabase(databaseName: string): Promise<void> {
  const conn = await mysql.createConnection(dbConnectionEnv());
  try {
    await conn.query(`DROP DATABASE IF EXISTS \`${databaseName.replace(/`/g, "``")}\``);
  } finally {
    await conn.end();
  }
}

export interface ApiResponse<T = Record<string, unknown>> {
  status: number;
  body: T & { code?: number; msg?: string };
}

export interface TestApi {
  baseUrl: string;
  request<T = Record<string, unknown>>(
    method: string,
    path: string,
    options?: { body?: unknown; token?: string },
  ): Promise<ApiResponse<T>>;
  /**
   * 模型句柄，仅用于「接口无法表达的数据准备」。
   * 例如一级分类：REST 只提供「在已有一级分类下建叶子」，没有建根的接口，
   * 而根分类本属于运维种子数据（scripts/it-seed-categories.ts）。
   * 断言仍应走 HTTP，不要用它绕过被测逻辑。
   */
  models: typeof import("../db.js");
  close(): Promise<void>;
}

/**
 * 启动被测应用。端口用 0 由内核分配，使并行的测试文件不会争抢固定端口。
 * 应用模块在此处才被动态 import：确保 prepareTestEnv 已经生效。
 */
export async function startTestApi(): Promise<TestApi> {
  const [{ default: app }, models, { runMigrations }, { connectRedis, disconnectRedis }] =
    await Promise.all([
      import("../app.js"),
      import("../db.js"),
      import("../db/migrator.js"),
      import("../redis.js"),
    ]);
  const { sequelize } = models;

  await sequelize.authenticate();
  await runMigrations(sequelize);

  const { bootstrapRbacIfNeeded } = await import("../services/rbac-bootstrap.service.js");
  await bootstrapRbacIfNeeded();

  await connectRedis();

  const server: Server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${String(port)}`;

  return {
    baseUrl,
    models,
    async request(method, path, options = {}) {
      const headers: Record<string, string> = {};
      if (options.body !== undefined) headers["Content-Type"] = "application/json";
      if (options.token) headers.Authorization = `Bearer ${options.token}`;

      const res = await fetch(`${baseUrl}${path}`, {
        method,
        headers,
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
      });

      const text = await res.text();
      let parsed: unknown = {};
      if (text) {
        try {
          parsed = JSON.parse(text);
        } catch {
          parsed = { raw: text };
        }
      }
      return { status: res.status, body: parsed as never };
    },
    async close() {
      await new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      });
      await disconnectRedis();
      await sequelize.close();
    },
  };
}

/**
 * 读取 JWT payload 里的用户 id。
 * `POST /api/login` 的契约只回传 token 本身（不含 user 对象），因此测试侧从 token 解出 id；
 * 这里只做 base64 解码、不校验签名——签名有效性由服务端在后续每个受保护请求上真实验证。
 */
function userIdFromToken(token: string): number {
  const payloadSegment = token.split(".")[1];
  if (!payloadSegment) {
    throw new Error("token 格式异常，无法解析 payload");
  }
  const json = Buffer.from(payloadSegment, "base64url").toString("utf8");
  const payload = JSON.parse(json) as { id?: number };
  if (typeof payload.id !== "number") {
    throw new Error("token payload 中缺少数值型 id");
  }
  return payload.id;
}

/** 注册并登录一个门户用户，返回其 token 与 id */
export async function registerAndLogin(
  api: TestApi,
  username: string,
  password = "test_password_123",
): Promise<{ token: string; userId: number }> {
  const registered = await api.request("POST", "/api/register", {
    body: { username, password },
  });
  if (registered.status !== 200) {
    throw new Error(`注册失败(${String(registered.status)}): ${registered.body.msg ?? ""}`);
  }

  const loggedIn = await api.request<{ token: string }>("POST", "/api/login", {
    body: { username, password },
  });
  if (loggedIn.status !== 200 || !loggedIn.body.token) {
    throw new Error(`登录失败(${String(loggedIn.status)}): ${loggedIn.body.msg ?? ""}`);
  }

  return { token: loggedIn.body.token, userId: userIdFromToken(loggedIn.body.token) };
}
