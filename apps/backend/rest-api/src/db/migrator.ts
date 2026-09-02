/**
 * 数据库迁移运行器。
 *
 * 为什么自建而不是 umzug / sequelize-cli：
 * 1. 需求本身只有「按序执行、记录已执行、可回滚、并发安全」四件事，实现成本远低于引入配置约定；
 * 2. sequelize-cli 的 .sequelizerc / config.json 与本仓 ESM + tsx + src/env.ts 的环境装配方式相冲突；
 * 3. 不新增供应链依赖。
 *
 * 关键取舍——MySQL 的 DDL 不是事务性的：
 * ALTER/CREATE TABLE 会触发隐式提交，因此「把一个迁移包进事务、失败整体回滚」在 MySQL 上是做不到的。
 * 这里不假装能做到：单个迁移执行失败时立即停止并如实报出失败位置，由人工介入修复，
 * 而不是留下「事务已回滚」的错误印象。所以每个迁移都应尽量小而独立。
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { QueryTypes } from "sequelize";

import { logger } from "../utils/logger.js";

import type { QueryInterface, Sequelize } from "sequelize";

/** 迁移文件需要导出的形状 */
export interface Migration {
  up(queryInterface: QueryInterface, sequelize: Sequelize): Promise<void>;
  down(queryInterface: QueryInterface, sequelize: Sequelize): Promise<void>;
}

/** 已执行迁移的记录表（与 sequelize-cli 同名，便于未来迁移工具互换） */
const META_TABLE = "SequelizeMeta";

/** 多副本同时启动时的互斥锁名 */
const MIGRATION_LOCK = "express_vue3_monorepo:migrate";

/** 获取锁的最长等待秒数：慢迁移期间其余副本应等待而不是直接失败 */
const MIGRATION_LOCK_TIMEOUT_SECONDS = 120;

/**
 * 迁移文件目录。
 * 开发经 tsx 从 `src/` 运行，生产经 node 从 `dist/` 运行；两种情况下都取「当前模块所在目录的同级 migrations」，
 * 因此同一份代码无需分支即可分别命中 `src/migrations/*.ts` 与 `dist/migrations/*.js`。
 */
const migrationsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "migrations");

/** 仅取可执行的迁移源码，排除 .d.ts 与 sourcemap */
function isMigrationFile(name: string): boolean {
  if (name.endsWith(".d.ts") || name.endsWith(".map")) return false;
  return name.endsWith(".ts") || name.endsWith(".js");
}

/** 迁移标识去掉扩展名，使同一迁移在 src(.ts) 与 dist(.js) 下记录到同一个名字 */
function migrationName(fileName: string): string {
  return fileName.replace(/\.(ts|js)$/, "");
}

async function listMigrations(): Promise<{ name: string; file: string }[]> {
  const entries = await fs.readdir(migrationsDir);
  return entries
    .filter(isMigrationFile)
    .map((file) => ({ name: migrationName(file), file }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

async function ensureMetaTable(sequelize: Sequelize): Promise<void> {
  await sequelize.query(
    `CREATE TABLE IF NOT EXISTS \`${META_TABLE}\` (
       \`name\` VARCHAR(255) NOT NULL,
       \`appliedAt\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
       PRIMARY KEY (\`name\`)
     ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  );
}

async function getAppliedNames(sequelize: Sequelize): Promise<Set<string>> {
  const rows = await sequelize.query<{ name: string }>(`SELECT \`name\` FROM \`${META_TABLE}\``, {
    type: QueryTypes.SELECT,
  });
  return new Set(rows.map((r) => r.name));
}

async function markApplied(sequelize: Sequelize, name: string): Promise<void> {
  await sequelize.query(`INSERT INTO \`${META_TABLE}\` (\`name\`) VALUES (?)`, {
    replacements: [name],
  });
}

async function markReverted(sequelize: Sequelize, name: string): Promise<void> {
  await sequelize.query(`DELETE FROM \`${META_TABLE}\` WHERE \`name\` = ?`, {
    replacements: [name],
  });
}

async function loadMigration(file: string): Promise<Migration> {
  const modulePath = path.join(migrationsDir, file);
  const mod: unknown = await import(/* @vite-ignore */ modulePath);
  const candidate = mod as Partial<Migration>;
  if (typeof candidate.up !== "function" || typeof candidate.down !== "function") {
    throw new Error(`[migrate] ${file} 必须同时导出 up 与 down 函数`);
  }
  return candidate as Migration;
}

/**
 * 跨副本互斥：MySQL 的 GET_LOCK 是**连接级**命名锁，同一时刻只有一个连接能持有。
 * 没有这层保护时，多副本同时启动会并发执行同一批 DDL，轻则报重复建表，重则把表改坏。
 *
 * 为什么要额外开一个事务来"钉住"连接：
 * `sequelize.query()` 每次都从连接池里另取一条连接，GET_LOCK 与 RELEASE_LOCK 因此可能落在
 * 两条不同的连接上。而 RELEASE_LOCK 在非持有连接上执行会返回 0、**并不会真的释放锁**，
 * 于是锁一直挂在池里那条闲置连接上，直到它被回收——下一次发布的所有副本都会先干等
 * 120 秒再报「未取得迁移锁」而启动失败。单进程顺序执行时池子往往复用同一条连接，
 * 所以这个错误平时看不出来，偏偏在多副本、连接池被占满时才发作。
 *
 * Sequelize 里能稳定拿到「同一条连接」的公开手段就是事务：加锁、解锁都挂在它上面。
 * 迁移本身仍走各自的连接（MySQL 的 DDL 会隐式提交，本来就不可能包在事务里），
 * 这个事务只负责持有锁，不写任何数据，故最后 rollback 即可。
 */
async function withMigrationLock<T>(sequelize: Sequelize, fn: () => Promise<T>): Promise<T> {
  const lockTx = await sequelize.transaction();

  try {
    const [acquired] = await sequelize.query<{ got: number | null }>(
      "SELECT GET_LOCK(?, ?) AS got",
      {
        replacements: [MIGRATION_LOCK, MIGRATION_LOCK_TIMEOUT_SECONDS],
        type: QueryTypes.SELECT,
        transaction: lockTx,
      },
    );

    if (acquired?.got !== 1) {
      throw new Error(
        `[migrate] ${MIGRATION_LOCK_TIMEOUT_SECONDS}s 内未取得迁移锁，疑似另一副本正在执行迁移且耗时过长`,
      );
    }

    try {
      return await fn();
    } finally {
      // 命名锁不随事务回滚释放，必须显式 RELEASE_LOCK，且同样要落在持锁的那条连接上
      await sequelize.query("SELECT RELEASE_LOCK(?)", {
        replacements: [MIGRATION_LOCK],
        transaction: lockTx,
      });
    }
  } finally {
    // 只用于钉住连接、未写入任何数据，rollback 与 commit 等价，取语义更弱的那个
    await lockTx.rollback();
  }
}

/**
 * 兼容历史库：迁移体系上线前，表是由 `sequelize.sync()` 建出来的，这些库没有 SequelizeMeta。
 * 此时若直接执行基线迁移会撞上已存在的表。因此当「无迁移记录 且 业务表已存在」时，
 * 把基线登记为已执行（不重复建表），后续增量迁移照常推进。
 *
 * 之所以只认基线一条：0002 起的迁移都是对既有结构的修改，历史库同样需要真正执行它们。
 */
async function adoptLegacySchemaIfNeeded(
  sequelize: Sequelize,
  baselineName: string,
  applied: Set<string>,
): Promise<boolean> {
  if (applied.size > 0) return false;

  const [existing] = await sequelize.query<{ cnt: number | string }>(
    `SELECT COUNT(*) AS cnt FROM information_schema.tables
      WHERE table_schema = DATABASE() AND table_name = 'Users'`,
    { type: QueryTypes.SELECT },
  );

  if (!existing || Number(existing.cnt) === 0) return false;

  logger.warn("migration_adopt_legacy_schema", {
    message:
      "检测到由 sequelize.sync() 建立的历史库（无 SequelizeMeta 但业务表已存在）：" +
      "将基线迁移登记为已执行，不重复建表。请核对历史库结构与基线迁移是否一致。",
    baseline: baselineName,
  });

  await markApplied(sequelize, baselineName);
  applied.add(baselineName);
  return true;
}

/** 执行全部未执行的迁移；返回本次实际执行的迁移名 */
export async function runMigrations(sequelize: Sequelize): Promise<string[]> {
  const queryInterface = sequelize.getQueryInterface();

  return withMigrationLock(sequelize, async () => {
    await ensureMetaTable(sequelize);

    const all = await listMigrations();
    if (all.length === 0) {
      throw new Error(`[migrate] ${migrationsDir} 下没有任何迁移文件`);
    }

    const applied = await getAppliedNames(sequelize);
    await adoptLegacySchemaIfNeeded(sequelize, all[0].name, applied);

    const pending = all.filter((m) => !applied.has(m.name));
    if (pending.length === 0) {
      logger.info("migration_up_to_date", { applied: applied.size });
      return [];
    }

    const executed: string[] = [];
    for (const { name, file } of pending) {
      const startedAt = Date.now();
      const migration = await loadMigration(file);
      try {
        await migration.up(queryInterface, sequelize);
      } catch (error) {
        logger.error("migration_failed", {
          migration: name,
          executedBefore: executed,
          message:
            "MySQL 的 DDL 会隐式提交，本次迁移可能已部分生效，无法自动回滚；请人工核对该迁移涉及的表后再重试。",
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
      await markApplied(sequelize, name);
      executed.push(name);
      logger.info("migration_applied", { migration: name, durationMs: Date.now() - startedAt });
    }

    return executed;
  });
}

/** 回滚最近一次迁移（仅供开发与人工运维使用） */
export async function rollbackLastMigration(sequelize: Sequelize): Promise<string | null> {
  const queryInterface = sequelize.getQueryInterface();

  return withMigrationLock(sequelize, async () => {
    await ensureMetaTable(sequelize);
    const applied = await getAppliedNames(sequelize);
    const all = await listMigrations();
    const lastApplied = [...all].reverse().find((m) => applied.has(m.name));

    if (!lastApplied) {
      logger.info("migration_nothing_to_rollback", {});
      return null;
    }

    const migration = await loadMigration(lastApplied.file);
    await migration.down(queryInterface, sequelize);
    await markReverted(sequelize, lastApplied.name);
    logger.info("migration_reverted", { migration: lastApplied.name });
    return lastApplied.name;
  });
}

/** 迁移状态：已执行与待执行 */
export async function migrationStatus(
  sequelize: Sequelize,
): Promise<{ applied: string[]; pending: string[] }> {
  await ensureMetaTable(sequelize);
  const appliedSet = await getAppliedNames(sequelize);
  const all = await listMigrations();
  return {
    applied: all.filter((m) => appliedSet.has(m.name)).map((m) => m.name),
    pending: all.filter((m) => !appliedSet.has(m.name)).map((m) => m.name),
  };
}
