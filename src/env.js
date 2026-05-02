// 启动前集中校验环境变量，避免 JWT / 监听端口 / 数据库在运行期才暴露问题。
// 任一必填项缺失或 PORT 非法时：打印错误后 process.exit(1) 立即终止进程（非 0 表示异常退出），不会启动 Express。

import dotenv from "dotenv";

dotenv.config();

/** @param {string} name */
function requireEnv(name) {
  const raw = process.env[name];
  if (raw === undefined || String(raw).trim() === "") {
    console.error(`[env] 缺少或未配置环境变量: ${name}`);
    process.exit(1); // 环境变量不存在：直接终止进程
  }
  return String(raw).trim();
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
  return secret;
})();
export const DB_HOST = requireEnv("DB_HOST");
export const DB_USER = requireEnv("DB_USER");
export const DB_PWD = requireEnv("DB_PWD");
export const DB_NAME = requireEnv("DB_NAME");

const portRaw = requireEnv("PORT");
const port = Number.parseInt(portRaw, 10);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  console.error("[env] PORT 必须是 1～65535 的整数");
  process.exit(1); // PORT 非法：直接终止进程
}
export const PORT = port;
