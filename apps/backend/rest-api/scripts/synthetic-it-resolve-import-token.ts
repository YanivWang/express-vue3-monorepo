import { loginForAdminJwt } from "./synthetic-it-api-client.js";

/**
 * 优先 `REST_API_IMPORT_TOKEN`；否则用账号密码调 `POST /login`。
 * 账号：`REST_API_IMPORT_*` → `ENSURE_SUPER_ADMIN_*` → 默认 root / 123456。
 */
export async function resolveAdminImportToken(apiBase: string): Promise<string> {
  const existing = (process.env.REST_API_IMPORT_TOKEN ?? "").trim();
  if (existing) return existing;

  const username = (
    process.env.REST_API_IMPORT_USERNAME?.trim() ||
    process.env.ENSURE_SUPER_ADMIN_USERNAME?.trim() ||
    "root"
  ).trim();
  const password = (
    process.env.REST_API_IMPORT_PASSWORD ??
    process.env.ENSURE_SUPER_ADMIN_PASSWORD ??
    "123456"
  ).trim();

  if (!username) {
    console.error(
      "未设置 REST_API_IMPORT_TOKEN：请配置 REST_API_IMPORT_USERNAME + 密码，或 ENSURE_SUPER_ADMIN_*，或直接配置 REST_API_IMPORT_TOKEN",
    );
    process.exit(1);
  }

  console.warn(
    `[synthetic-it] 未设置 REST_API_IMPORT_TOKEN：正以用户 «${username}» 调用 POST /login（请确保其为管理员；本地默认可先用 pnpm ensure-super-admin）`,
  );
  return loginForAdminJwt(apiBase, username, password);
}
