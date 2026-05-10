import { loginForAdminJwt } from "./synthetic-it-api-client.js";

/**
 * 优先 `REST_API_IMPORT_TOKEN`；否则用账号密码调 `POST /login`。
 * 账号：`REST_API_IMPORT_USERNAME` + `REST_API_IMPORT_PASSWORD`（须成对非空）或 `ADMIN_BOOTSTRAP_*`（须成对非空，通常 `.env.development`）。
 */
export async function resolveAdminImportToken(apiBase: string): Promise<string> {
  const existing = (process.env.REST_API_IMPORT_TOKEN ?? "").trim();
  if (existing) return existing;

  const importUser = (process.env.REST_API_IMPORT_USERNAME ?? "").trim();
  const importPwd = (process.env.REST_API_IMPORT_PASSWORD ?? "").trim();
  let username: string;
  let password: string;

  if (importUser || importPwd) {
    if (!importUser || !importPwd) {
      console.error(
        "[synthetic-it] REST_API_IMPORT_USERNAME 与 REST_API_IMPORT_PASSWORD 须同时配置（或改用 ADMIN_BOOTSTRAP_* / REST_API_IMPORT_TOKEN）",
      );
      process.exit(1);
    }
    username = importUser;
    password = importPwd;
  } else {
    username = (process.env.ADMIN_BOOTSTRAP_USERNAME ?? "").trim();
    password = (process.env.ADMIN_BOOTSTRAP_PASSWORD ?? "").trim();
    if (!username || !password) {
      console.error(
        "[synthetic-it] 请在 monorepo 根 .env.* 设置非空的 ADMIN_BOOTSTRAP_USERNAME 与 ADMIN_BOOTSTRAP_PASSWORD（或配置 REST_API_IMPORT_* / REST_API_IMPORT_TOKEN）",
      );
      process.exit(1);
    }
  }

  console.warn(
    `[synthetic-it] 未设置 REST_API_IMPORT_TOKEN：正以用户 «${username}» 调用 POST /login（请确保其为管理员；本地可在 apps/backend/rest-api 执行 pnpm ensure-super-admin）`,
  );
  return loginForAdminJwt(apiBase, username, password);
}
