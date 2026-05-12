/**
 * 删除并重建 DB_NAME 指向的 MySQL 库（utf8mb4），不启动 HTTP。
 * **前提**：仅要求 MySQL 在本机配置（DB_HOST:DB_PORT）下可达；不要求 rest-api / 前端已启动。
 * 下次启动 rest-api（仓库根如 `pnpm rest-api:dev` 或 `pnpm docker:dev`）会跑 Sequelize sync + RBAC bootstrap 建表与权限；
 * 示例类目请执行 `pnpm db:seed-categories`；合成帖子在 API 已启动后执行 `pnpm db:seed-post`（**不**含类目种子）。
 */
import path from "node:path";
import { fileURLToPath } from "node:url";

import mysql from "mysql2/promise";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(root);

const { DB_HOST, DB_PORT, DB_USER, DB_PWD, DB_NAME } = await import("../src/env.js");

function quoteIdent(name: string) {
  return "`" + name.replace(/`/g, "``") + "`";
}

function printMysqlConnectHint(host: string, port: number, err: unknown) {
  const e = err as NodeJS.ErrnoException & { errno?: number; sqlMessage?: string };
  console.error(
    `[db:drop-create] 无法连接 MySQL（${host}:${port}）。本脚本不要求 rest-api 已启动，但需要数据库服务已运行且当前环境可连通。`,
  );
  const code = e.code ?? "";
  if (code === "ER_ACCESS_DENIED_ERROR" || e.errno === 1045) {
    console.error(`[db:drop-create] 可能是 DB_USER / DB_PWD 与 MySQL 账号不一致。`);
  } else if (code === "ECONNREFUSED" || code === "ETIMEDOUT" || code === "ENOTFOUND") {
    console.error(
      `[db:drop-create] 请确认 MySQL 已在 ${host}:${port} 可达（进程已监听、地址与端口正确）。`,
    );
    console.error(
      `[db:drop-create] 若按本仓库默认 Docker 开发栈，可在仓库根执行 pnpm docker:dev；从宿主连容器内 MySQL 时通常需映射 3306 且在 .env 中将 DB_HOST 设为 127.0.0.1。独立安装的 MySQL 或其它拓扑请自行保证与当前 DB_* 一致。`,
    );
  } else {
    console.error(
      `[db:drop-create] 请检查：库是否监听、DB_HOST/DB_PORT、防火墙、Docker 网络下主机名是否可达；使用本仓库 Docker 栈时可尝试在仓库根执行 pnpm docker:dev。`,
    );
  }
  const detail = e.sqlMessage ?? e.message ?? String(err);
  console.error(`[db:drop-create] 详情: ${detail}`);
}

let conn: Awaited<ReturnType<typeof mysql.createConnection>> | undefined;
try {
  conn = await mysql.createConnection({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PWD,
    connectTimeout: 15_000,
  });
} catch (err) {
  printMysqlConnectHint(DB_HOST, DB_PORT, err);
  process.exit(1);
}

const dbQuoted = quoteIdent(DB_NAME);
try {
  await conn.query(`DROP DATABASE IF EXISTS ${dbQuoted}`);
  await conn.query(`CREATE DATABASE ${dbQuoted} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
} catch (err) {
  const e = err as { sqlMessage?: string; message?: string };
  console.error(`[db:drop-create] 执行 DROP/CREATE DATABASE 失败。`);
  console.error(`[db:drop-create] 详情: ${e.sqlMessage ?? e.message ?? String(err)}`);
  try {
    await conn.end();
  } catch {
    /* ignore */
  }
  process.exit(1);
}

await conn.end();

console.log(
  `[db:drop-create] 已重建库 ${DB_NAME}（请启动 rest-api 一次以触发 Sequelize sync：仓库根可执行 pnpm docker:dev 或 pnpm rest-api:dev）`,
);
