/**
 * 删除并重建 DB_NAME 指向的 MySQL 库（utf8mb4），不启动 HTTP。
 * 下次 `node src/server.js` 时由 sequelize.sync + seed 建表并写入示例分类。
 *
 * 运行：在项目根目录 `pnpm db:reset`；需本机/网络能连上 env 中的 DB_HOST:DB_PORT。
 */
import mysql from "mysql2/promise";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(root);

const { DB_HOST, DB_PORT, DB_USER, DB_PWD, DB_NAME } = await import("../src/env.js");

function quoteIdent(name) {
  return "`" + String(name).replace(/`/g, "``") + "`";
}

const conn = await mysql.createConnection({
  host: DB_HOST,
  port: DB_PORT,
  user: DB_USER,
  password: DB_PWD,
});

const dbQuoted = quoteIdent(DB_NAME);
await conn.query(`DROP DATABASE IF EXISTS ${dbQuoted}`);
await conn.query(
  `CREATE DATABASE ${dbQuoted} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
);
await conn.end();

console.log(`[db:reset] 已重建库 ${DB_NAME}（表结构请在项目根执行 dev/start 由 Sequelize sync）`);
