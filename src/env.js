// 启动前集中校验环境变量。
// Twelve-Factor：进程启动时已在环境中的变量优先级最高，不会被磁盘 .env.* 覆盖；
// `.env.${环境}` 之后再读 `.env.${环境}.local`（仍可覆盖第一份文件在非注入键上的赋值）。

import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const validEnvs = new Set(["development", "test", "production"]);

/** @returns {string | undefined} */
function trimUnset(value) {
  if (value === undefined) return undefined;
  const t = String(value).trim();
  return t === "" ? undefined : t;
}

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
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
  console.error(`[env] 当前 APP_ENV=${JSON.stringify(mergedApp)}，NODE_ENV=${JSON.stringify(mergedNode)}`);
  process.exit(1);
}

const appEnv = mergedApp ?? mergedNode ?? "development";

if (!validEnvs.has(appEnv)) {
  console.error(`[env] APP_ENV/NODE_ENV 只能是: ${Array.from(validEnvs).join(", ")}（当前: ${appEnv}）`);
  process.exit(1);
}

process.env.APP_ENV = appEnv;
if (!process.env.NODE_ENV) process.env.NODE_ENV = appEnv;

/** @param {string} name */
function requireEnv(name) {
  const raw = process.env[name];
  if (raw === undefined || String(raw).trim() === "") {
    console.error(`[env] 缺少或未配置环境变量: ${name}`);
    process.exit(1);
  }
  return String(raw).trim();
}

/** @param {string} name @param {number} fallback */
function requirePortLike(name, fallback) {
  const raw = trimUnset(process.env[name]);
  if (raw === undefined) return fallback;
  const n = Number.parseInt(raw, 10);
  if (!Number.isInteger(n) || n < 1 || n > 65535) {
    console.error(`[env] ${name} 必须是 1～65535 的整数`);
    process.exit(1);
  }
  return n;
}

/** @param {string} name @param {string} value */
function rejectProductionPlaceholder(name, value) {
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
    console.error(`[env] JWT_SECRET 长度至少 ${minLen} 字符（当前 ${secret.length}），请使用足够长的随机串`);
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

export const DB_HOST = requireEnv("DB_HOST");
export const DB_USER = requireEnv("DB_USER");
export const DB_PWD = (() => {
  const password = requireEnv("DB_PWD");
  rejectProductionPlaceholder("DB_PWD", password);
  return password;
})();
export const DB_NAME = requireEnv("DB_NAME");
export const APP_ENV = appEnv;
