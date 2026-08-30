// 启动前集中校验环境变量。
// Twelve-Factor：进程启动时已在环境中的变量优先级最高，不会被磁盘 .env.* 覆盖；
// `.env.${环境}` 之后再读 `.env.${环境}.local`（仍可覆盖第一份文件在非注入键上的赋值）。

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";

import { findMonorepoRoot } from "./utils/monorepoRoot.js";

const validEnvs = new Set(["development", "test", "production"]);

function trimUnset(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const t = value.trim();
  return t === "" ? undefined : t;
}

const restApiRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const rootDir = findMonorepoRoot(restApiRoot);
const injectedKeys = new Set(Object.keys(process.env));

const envBundle =
  trimUnset(process.env.APP_ENV) ?? trimUnset(process.env.NODE_ENV) ?? "development";

for (const envFile of [`.env.${envBundle}`, `.env.${envBundle}.local`]) {
  const envPath = path.join(rootDir, envFile);
  if (!fs.existsSync(envPath)) {
    continue;
  }

  const parsed = dotenv.parse(fs.readFileSync(envPath));
  for (const [key, value] of Object.entries(parsed)) {
    if (!injectedKeys.has(key)) {
      process.env[key] = value;
    }
  }
}

const mergedApp = trimUnset(process.env.APP_ENV);
const mergedNode = trimUnset(process.env.NODE_ENV);

if (mergedApp !== undefined && mergedNode !== undefined && mergedApp !== mergedNode) {
  console.error("[env] 同时设置了 APP_ENV 与 NODE_ENV 时二者必须一致（含磁盘 .env 合并后）");
  console.error(
    `[env] 当前 APP_ENV=${JSON.stringify(mergedApp)}，NODE_ENV=${JSON.stringify(mergedNode)}`,
  );
  process.exit(1);
}

const appEnv = mergedApp ?? mergedNode ?? "development";

if (!validEnvs.has(appEnv)) {
  console.error(
    `[env] APP_ENV/NODE_ENV 只能是: ${Array.from(validEnvs).join(", ")}（当前: ${appEnv}）`,
  );
  process.exit(1);
}

process.env.APP_ENV = appEnv;
if (!process.env.NODE_ENV) process.env.NODE_ENV = appEnv;

function requireEnv(name: string): string {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === "") {
    console.error(`[env] 缺少或未配置环境变量: ${name}`);
    process.exit(1);
  }
  return raw.trim();
}

function requirePortLike(name: string, fallback: number): number {
  const raw = trimUnset(process.env[name]);
  if (raw === undefined) return fallback;
  const n = Number.parseInt(raw, 10);
  if (!Number.isInteger(n) || n < 1 || n > 65535) {
    console.error(`[env] ${name} 必须是 1～65535 的整数`);
    process.exit(1);
  }
  return n;
}

function rejectProductionPlaceholder(name: string, value: string) {
  if (appEnv !== "production") {
    return;
  }

  const lower = value.toLowerCase();
  if (lower.includes("replace_with") || lower.includes("change_me")) {
    console.error(`[env] 生产环境 ${name} 不能使用模板占位值，请配置真实密钥/密码`);
    process.exit(1);
  }
}

export const JWT_SECRET = (() => {
  const secret = requireEnv("JWT_SECRET");
  const minLen = 32;
  if (secret.length < minLen) {
    console.error(
      `[env] JWT_SECRET 长度至少 ${minLen} 字符（当前 ${secret.length}），请使用足够长的随机串`,
    );
    process.exit(1);
  }
  const weak = new Set([
    "secret",
    "jwt_secret",
    "jwtsecret",
    "changeme",
    "password",
    "123456",
    "your-secret-key",
    "your_secret_key",
    "supersecret",
    "please_change_me",
  ]);
  if (weak.has(secret.toLowerCase())) {
    console.error("[env] JWT_SECRET 不能使用常见弱默认值，请换成随机生成的密钥");
    process.exit(1);
  }
  rejectProductionPlaceholder("JWT_SECRET", secret);
  return secret;
})();
export const PORT = requirePortLike("PORT", 3000);
export const DB_PORT = requirePortLike("DB_PORT", 3306);

export const REDIS_URL = requireEnv("REDIS_URL"); // 读取 Redis 连接地址；没有配置时启动直接失败，避免运行到一半才报错

export const DB_HOST = requireEnv("DB_HOST");
export const DB_USER = requireEnv("DB_USER");
export const DB_PWD = (() => {
  const password = requireEnv("DB_PWD");
  rejectProductionPlaceholder("DB_PWD", password);
  return password;
})();
export const DB_NAME = requireEnv("DB_NAME");
export const APP_ENV = appEnv;

/** 读取正整数环境变量；未设置或非法时回退到默认值并给出提示 */
function positiveIntEnv(name: string, fallback: number): number {
  const raw = trimUnset(process.env[name]);
  if (raw === undefined) return fallback;
  const n = Number.parseInt(raw, 10);
  if (!Number.isInteger(n) || n <= 0) {
    console.error(`[env] ${name} 必须是正整数（当前: ${raw}）`);
    process.exit(1);
  }
  return n;
}

/**
 * 认证令牌与 Cookie 策略。
 *
 * 改造前的问题：登录签发一枚 **7 天** 有效的 JWT，前端用 js-cookie 存进一个
 * **JS 可读、且没有 Secure / SameSite** 的 Cookie。于是一次 XSS 就等于账号被接管一周，
 * 明文 HTTP 下 Cookie 还会裸奔，而除了用户主动登出（黑名单）之外没有任何撤销手段。
 *
 * 现在拆成两段凭证：
 * - 访问令牌（JWT）短时效、由前端保存在内存中，随 Authorization 头发送；
 * - 刷新令牌不透明、服务端可撤销，放在 HttpOnly + Secure + SameSite=Strict 的 Cookie 里，
 *   且 Path 限定在刷新接口，既取不到也带不出去。
 */
export const ACCESS_TOKEN_TTL_SECONDS = positiveIntEnv("ACCESS_TOKEN_TTL_SECONDS", 15 * 60);
export const REFRESH_TOKEN_TTL_SECONDS = positiveIntEnv(
  "REFRESH_TOKEN_TTL_SECONDS",
  7 * 24 * 60 * 60,
);

/**
 * 刷新令牌 Cookie 名与作用路径。
 *
 * Path 取 `/api` 而非更窄的 `/api/auth`：登出（`POST /api/logout`）同样需要读到这枚 Cookie
 * 才能真正撤销刷新令牌家族。把 Path 收窄就必须把登出挪到 `/api/auth/logout`，
 * 那会破坏既有前端与 OpenAPI 契约。
 * 权衡后选择保持契约：Cookie 虽然会随所有 /api 请求发送，但它是 HttpOnly + Secure +
 * SameSite=Strict 的，JS 读不到、跨站也带不出去，相较改造前的「JS 可读且无任何属性」
 * 已是数量级的差别。若将来愿意调整契约，把 Path 收窄到 `/api/auth` 是进一步的加固方向。
 */
export const REFRESH_COOKIE_NAME = "evm_refresh_token";
export const REFRESH_COOKIE_PATH = "/api";

/**
 * 生产默认要求 HTTPS；本地 http://localhost 调试时浏览器不会回传 Secure Cookie，
 * 故非生产环境默认关闭，可用 AUTH_COOKIE_SECURE=1 显式打开。
 */
export const AUTH_COOKIE_SECURE = (() => {
  const raw = trimUnset(process.env.AUTH_COOKIE_SECURE);
  if (raw === undefined) return appEnv === "production";
  return raw === "1" || raw.toLowerCase() === "true";
})();

/**
 * 限流阈值。默认值面向生产：
 * - 全局 15 分钟 1000 次：足够正常浏览与交互，又能挡住脚本化抓取；
 * - 认证接口 1 分钟 10 次：抑制账号枚举与暴力破解。
 * 本地压测、集成测试或数据导入等需要放宽时，通过环境变量覆盖，不要改代码默认值。
 */
export const RATE_LIMIT = {
  globalWindowMs: positiveIntEnv("RATE_LIMIT_GLOBAL_WINDOW_MS", 15 * 60 * 1000),
  globalMax: positiveIntEnv("RATE_LIMIT_GLOBAL_MAX", 1000),
  authWindowMs: positiveIntEnv("RATE_LIMIT_AUTH_WINDOW_MS", 60 * 1000),
  authMax: positiveIntEnv("RATE_LIMIT_AUTH_MAX", 10),
} as const;

/**
 * 反向代理：`1` / `true` 表示信任一层代理（X-Forwarded-*）；纯数字表示 hop 数。
 * 未设置时不启用 trust proxy。
 */
export const TRUST_PROXY = trimUnset(process.env.TRUST_PROXY);

/**
 * 允许的浏览器跨域 Origin，逗号分隔。生产环境未设置时关闭 CORS（仅同源或非浏览器客户端）。
 * 开发/测试未设置时等价于 `cors({ origin: true })`。
 */
export const CORS_ORIGINS = (() => {
  const raw = trimUnset(process.env.CORS_ORIGINS);
  if (raw === undefined) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
})();

/** 供 `cors({ origin })` 使用 */
export function getCorsOriginOption(): boolean | string | string[] {
  if (appEnv === "development" || appEnv === "test") {
    if (CORS_ORIGINS.length === 0) return true;
    if (CORS_ORIGINS.length === 1) return CORS_ORIGINS[0];
    return CORS_ORIGINS;
  }
  if (CORS_ORIGINS.length === 0) return false;
  if (CORS_ORIGINS.length === 1) return CORS_ORIGINS[0];
  return CORS_ORIGINS;
}
