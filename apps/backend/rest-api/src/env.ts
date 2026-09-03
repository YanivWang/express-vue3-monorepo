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
 * 刷新令牌轮换的并发宽限（秒），`0` 表示严格模式。
 *
 * 轮换 + 重放检测的经典副作用：同一个浏览器里多个标签页（乃至门户与管理端两个前端，
 * 它们同源、共用同一枚刷新 Cookie）可能在同一瞬间拿着**同一枚**令牌去刷新。
 * 严格模式下先到的那个轮换成功，其余全被判成「重放」，于是整个家族被撤销——
 * 用户什么都没做错，却被强制重新登录。
 *
 * 因此给刚轮换掉的令牌留一段极短的宽限窗口：窗口内的重复提交视为并发竞态，
 * 原样返回**当初已经发出去的那一枚**继任令牌（幂等重放，不补发新的——补发会让一枚已用令牌
 * 在窗口内重放 N 次就铸出 N 条彼此独立的令牌链）；窗口之外仍按重放处理，家族照旧撤销。
 * 这与 Auth0 的 refresh token reuse interval 是同一取舍：用极小的检测盲区，
 * 换掉一个几乎必然发生的误杀。窗口越大越宽容、也越钝，默认 30 秒。
 */
export const REFRESH_ROTATION_GRACE_SECONDS = (() => {
  const raw = trimUnset(process.env.REFRESH_ROTATION_GRACE_SECONDS);
  if (raw === undefined) return 30;
  const n = Number.parseInt(raw, 10);
  if (!Number.isInteger(n) || n < 0) {
    console.error(`[env] REFRESH_ROTATION_GRACE_SECONDS 必须是非负整数（当前: ${raw}）`);
    process.exit(1);
  }
  return n;
})();

/**
 * 绝对会话寿命（秒），`0` 关闭。默认 30 天。
 *
 * 为什么滑动过期一个人扛不住：刷新令牌每轮换一次就重置一次有效期，
 * 所以只要保持每周至少刷新一次，同一次登录派生出的会话就能无限期活下去——
 * 包括拿着被盗令牌、且恰好一直没触发重放检测的那个人。「7 天有效期」在这种用法下
 * 从来不会真的到期。
 *
 * 绝对上限给每次登录压一条硬线：无论中间刷新过多少次，到点就必须重新做一次
 * 真正的身份认证（输密码）。这也是把「改密码 / 封号」的最坏生效时延兜住的最后一道。
 * 交互密集的产品可以调长，高敏感场景应当调短。
 */
export const REFRESH_SESSION_ABSOLUTE_TTL_SECONDS = (() => {
  const raw = trimUnset(process.env.REFRESH_SESSION_ABSOLUTE_TTL_SECONDS);
  if (raw === undefined) return 30 * 24 * 60 * 60;
  const n = Number.parseInt(raw, 10);
  if (!Number.isInteger(n) || n < 0) {
    console.error(`[env] REFRESH_SESSION_ABSOLUTE_TTL_SECONDS 必须是非负整数（当前: ${raw}）`);
    process.exit(1);
  }
  return n;
})();

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
 * 刷新令牌 Cookie 的 Secure 属性。
 *
 * 取值：`1` / `true` 恒开，`0` / `false` 恒关，`auto` 按「本次请求是否走 HTTPS」逐请求判定
 * （经 Express 的 `req.secure`，代理场景需同时配置 TRUST_PROXY，见下）。
 * 未设置时：生产 = 开，其余 = 关（本地 http://localhost 调试浏览器不会保存 Secure Cookie）。
 *
 * 为什么需要 `auto`：浏览器会**静默丢弃**由非 HTTPS 响应下发的 Secure Cookie。
 * 本仓自带的 Compose 生产栈默认只在网关上暴露明文 HTTP（`GATEWAY_HOST_PORT`，默认 2026），
 * 若前面没有再套一层 TLS 终端，恒开 Secure 的表现就是「能登录，但刷新页面即掉登录态」，
 * 而服务端日志一切正常——这类问题极难从表象反推。`auto` 让同一份镜像在
 * 「已上 HTTPS」与「内网明文」两种部署下都能正常工作，且一旦上了 TLS 就自动收紧。
 */
export type AuthCookieSecureMode = boolean | "auto";

export const AUTH_COOKIE_SECURE: AuthCookieSecureMode = (() => {
  const raw = trimUnset(process.env.AUTH_COOKIE_SECURE);
  if (raw === undefined) return appEnv === "production";
  const lower = raw.toLowerCase();
  if (lower === "auto") return "auto";
  if (lower === "1" || lower === "true") return true;
  if (lower === "0" || lower === "false") return false;
  console.error(`[env] AUTH_COOKIE_SECURE 只能是 1 / true / 0 / false / auto（当前: ${raw}）`);
  process.exit(1);
})();

/**
 * 是否对外提供 API 文档（`/api-docs` 与 `/openapi.yaml`）。
 *
 * 取值：`1` / `true` 开，`0` / `false` 关；未设置时**生产默认关闭**，其余环境默认开启。
 *
 * 为什么生产要默认关：openapi.yaml 是这套服务最完整的一份攻击面清单——每个路由、每个参数、
 * 每条权限码、连「哪些接口不需要 Bearer」都写得清清楚楚。它对开发是资产，对外网是地图。
 * 而 Swagger UI 本身还得为它单独放宽 CSP（见 app.ts 的 helmetPick），等于又多一处例外。
 * 真需要在生产查文档，就显式 `API_DOCS_ENABLED=1` 打开，并且让它只经内网/鉴权后的入口可达。
 */
export const API_DOCS_ENABLED: boolean = (() => {
  const raw = trimUnset(process.env.API_DOCS_ENABLED);
  if (raw === undefined) return appEnv !== "production";
  const lower = raw.toLowerCase();
  if (lower === "1" || lower === "true") return true;
  if (lower === "0" || lower === "false") return false;
  console.error(`[env] API_DOCS_ENABLED 只能是 1 / true / 0 / false（当前: ${raw}）`);
  process.exit(1);
})();

/**
 * 优雅退出前的「摘流量」等待（毫秒），`0` 表示不等待。
 *
 * 收到 SIGTERM 后 `/ready` 会立刻翻成 503（见 routes/health.routes.ts），但**探针是轮询的**：
 * 如果翻完就立即关掉监听，编排层根本来不及探到那个 503，也就来不及把本实例从
 * Service / 负载均衡的后端列表里摘掉——滚动更新期间因此出现零星 502，
 * 而进程日志一切正常（它确实优雅退出了，只是比 LB 的反应快）。
 *
 * 这段等待就是留给编排层「看见并摘掉」的时间，取值应当略大于一个就绪探针周期
 * （K8s readinessProbe.periodSeconds 默认 10s，实践中常配 2～5s，则本值取 5000 上下）。
 *
 * 默认 `0`：本仓自带的单机 Compose 前面只有一台 nginx、没有滚动更新，等待纯属拖慢发布；
 * 且它会挤占 SHUTDOWN_TIMEOUT_MS 的预算。上 K8s 或多副本滚动更新时**应当显式配置**，
 * 并确保 SHUTDOWN_DRAIN_MS + 在途请求收尾时间 < 编排层的宽限期。
 * （等价做法是用 K8s 的 preStop `sleep`，两者择一即可。）
 */
export const SHUTDOWN_DRAIN_MS = (() => {
  const raw = trimUnset(process.env.SHUTDOWN_DRAIN_MS);
  if (raw === undefined) return 0;
  const n = Number.parseInt(raw, 10);
  if (!Number.isInteger(n) || n < 0) {
    console.error(`[env] SHUTDOWN_DRAIN_MS 必须是非负整数（当前: ${raw}）`);
    process.exit(1);
  }
  return n;
})();

/**
 * 优雅退出的最长等待时间。
 * 需小于编排层的宽限期（`docker stop` 默认 10s、K8s terminationGracePeriodSeconds 默认 30s），
 * 否则超时兜底还没来得及执行，进程就已经被 SIGKILL 了。
 */
export const SHUTDOWN_TIMEOUT_MS = positiveIntEnv("SHUTDOWN_TIMEOUT_MS", 8000);

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
  /**
   * 刷新接口单独一档，且只统计失败的请求（见 rateLimit.middleware.ts）。
   * 与登录共用「1 分钟 10 次」是不成立的：刷新是每个登录用户每 15 分钟一次的**自动**行为，
   * 办公室 NAT 后几十号人共用一个出口 IP 时，正常使用就能把桶打满；
   * 而刷新失败 = 会话恢复失败 = 用户被判定成未登录，等于限流把自己人锁在门外。
   */
  refreshWindowMs: positiveIntEnv("RATE_LIMIT_REFRESH_WINDOW_MS", 60 * 1000),
  refreshMax: positiveIntEnv("RATE_LIMIT_REFRESH_MAX", 30),
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
