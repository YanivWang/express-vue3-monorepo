/**
 * MySQL InnoDB：删除「索引列序列完全相同」的重复索引（常为 Sequelize development `sync({ alter })`
 * 在 UNIQUE 列上重复建 UNIQUE，最终触发 ER_TOO_MANY_KEYS）。
 *
 * - 仅用 mysql2 + env，不调用 `connectDatabase()`，避免在未清理前先 alter 扩索引。
 * - 按表分组：`ALTER TABLE t DROP INDEX i1, DROP INDEX i2, ...`
 * - `DEDUPE_INDEXES_DRY_RUN=1`：仅打印将删除的索引，不执行 DROP。
 *
 * 保留规则（同组内选一个 keeper）：
 * 1. 单列时优先保留 INDEX_NAME === 列名；
 * 2. 优先保留 INDEX_NAME 不以 `_数字` 结尾的名称（跳过 slug_3 等 sequelize 尾缀形式）；
 * 3. 否则按字典序最小。
 *
 * FULLTEXT / SPATIAL 等非 BTREE 索引不参与比对与删除。
 */
import path from "node:path";
import { fileURLToPath } from "node:url";

import mysql from "mysql2/promise";

const apiRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(apiRoot);

const { mergeDotenvFromMonorepoRoot } = await import("./synthetic-it-merge-monorepo-dotenv.js");
mergeDotenvFromMonorepoRoot();

const { DB_HOST, DB_PORT, DB_USER, DB_PWD, DB_NAME } = await import("../src/env.js");

function quoteIdent(name: string): string {
  return "`" + name.replace(/`/g, "``") + "`";
}

type StatRow = {
  TABLE_NAME: string;
  INDEX_NAME: string;
  NON_UNIQUE: number;
  SEQ_IN_INDEX: number;
  COLUMN_NAME: string | null;
  INDEX_TYPE: string;
};

type IndexFingerprint = {
  table: string;
  name: string;
  /** true = 可为重复键的普通索引 */
  nonUnique: boolean;
  cols: string;
};

function pickKeeper(names: string[], columnList: string[]): string {
  if (columnList.length === 1) {
    const col = columnList[0];
    if (names.includes(col)) return col;
  }

  const noNumSuffix = names.filter((n) => !_NUM_SUFFIX.test(n));
  if (noNumSuffix.length >= 1) {
    return [...noNumSuffix].sort((a, b) => a.localeCompare(b))[0];
  }

  const parsed = names.map((raw) => {
    const m = /^(.+)_(\d+)$/.exec(raw);
    if (m?.[1] !== undefined && m[2] !== undefined) {
      return { raw, prefix: m[1], num: Number(m[2]) };
    }
    return { raw, prefix: raw, num: Number.POSITIVE_INFINITY };
  });
  const p0 = parsed[0].prefix;
  if (parsed.length > 0 && parsed.every((x) => x.prefix === p0)) {
    return [...parsed].sort((a, b) => a.num - b.num)[0].raw;
  }

  return [...names].sort((a, b) => a.localeCompare(b))[0];
}

/** 形如 `slug_12` —— Sequelize 等对重复 UNIQUE 的常见命名尾缀 */
const _NUM_SUFFIX = /_\d+$/;

async function main() {
  const dryRun =
    process.env.DEDUPE_INDEXES_DRY_RUN === "1" ||
    process.env.DEDUPE_INDEXES_DRY_RUN?.toLowerCase() === "true";

  const conn = await mysql.createConnection({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PWD,
    database: DB_NAME,
  });

  const [statRows] = await conn.execute(
    `SELECT TABLE_NAME, INDEX_NAME, NON_UNIQUE, SEQ_IN_INDEX, COLUMN_NAME, INDEX_TYPE
     FROM INFORMATION_SCHEMA.STATISTICS
     WHERE TABLE_SCHEMA = ?
       AND TABLE_NAME <> 'SYSTEM'
     ORDER BY TABLE_NAME ASC, INDEX_NAME ASC, SEQ_IN_INDEX ASC`,
    [DB_NAME],
  );

  const rows = statRows as StatRow[];

  type Acc = {
    columns: { seq: number; name: string }[];
    nonUnique: boolean;
    invalid: boolean;
  };
  const byTableIndex = new Map<string, Acc>();

  for (const r of rows) {
    if (r.INDEX_NAME === "PRIMARY") continue;
    if (r.INDEX_TYPE !== "BTREE") continue;

    const key = `${r.TABLE_NAME}\0${r.INDEX_NAME}`;
    let acc = byTableIndex.get(key);
    if (!acc) {
      acc = {
        columns: [],
        nonUnique: r.NON_UNIQUE !== 0,
        invalid: false,
      };
      byTableIndex.set(key, acc);
    }
    if (r.COLUMN_NAME == null || r.COLUMN_NAME === "") {
      acc.invalid = true;
      continue;
    }
    if (!acc.invalid) acc.columns.push({ seq: r.SEQ_IN_INDEX, name: r.COLUMN_NAME });
  }

  const fingerprints: IndexFingerprint[] = [];

  for (const [compoundKey, acc] of byTableIndex) {
    if (acc.invalid || acc.columns.length === 0) continue;
    const ordered = [...acc.columns].sort((a, b) => a.seq - b.seq);
    const sep = compoundKey.indexOf("\0");
    const table = compoundKey.slice(0, sep);
    const name = compoundKey.slice(sep + 1);
    const colList = ordered.map((c) => c.name);
    fingerprints.push({
      table,
      name,
      nonUnique: acc.nonUnique,
      cols: colList.join("\0"),
    });
  }

  const groups = new Map<string, IndexFingerprint[]>();
  for (const fp of fingerprints) {
    const gKey = `${fp.table}\0${fp.nonUnique ? "1" : "0"}\0${fp.cols}`;
    const list = groups.get(gKey);
    if (list) list.push(fp);
    else groups.set(gKey, [fp]);
  }

  const dropsByTable = new Map<string, string[]>();

  for (const [, list] of groups) {
    if (list.length < 2) continue;
    const columnList = list[0].cols.split("\0");
    const names = list.map((x) => x.name);
    const keeper = pickKeeper(names, columnList);
    const table = list[0].table;
    for (const fp of list) {
      if (fp.name === keeper) continue;
      const prev = dropsByTable.get(table) ?? [];
      prev.push(fp.name);
      dropsByTable.set(table, prev);
    }
  }

  let totalDropped = 0;

  const sortedTables = [...dropsByTable.keys()].sort((a, b) => a.localeCompare(b));

  for (const table of sortedTables) {
    const indexes = [...(dropsByTable.get(table) ?? [])].sort((a, b) => a.localeCompare(b));
    if (indexes.length === 0) continue;

    const dropSql = indexes.map((idx) => `DROP INDEX ${quoteIdent(idx)}`).join(", ");
    const sql = `ALTER TABLE ${quoteIdent(table)} ${dropSql}`;

    if (dryRun) {
      console.log(`[dedupe-indexes:dry-run] ${sql}`);
      totalDropped += indexes.length;
      continue;
    }

    console.log(
      `[dedupe-indexes] ${quoteIdent(DB_NAME)}.${quoteIdent(table)}: 删除 ${indexes.length} 个重复索引 (${indexes.join(", ")})`,
    );

    await conn.execute(sql);
    totalDropped += indexes.length;
  }

  await conn.end();

  if (totalDropped === 0) {
    console.log("[dedupe-indexes] 未发现需删除的重复 BTREE 索引");
  } else if (dryRun) {
    console.log(`[dedupe-indexes:dry-run] 共将删除 ${totalDropped} 个索引（未执行 DROP）`);
  } else {
    console.log(`[dedupe-indexes] 完成，共删除 ${totalDropped} 个重复索引`);
  }
}

await main();
