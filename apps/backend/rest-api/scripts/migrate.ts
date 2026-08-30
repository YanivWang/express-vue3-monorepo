/**
 * 迁移 CLI。
 *
 *   pnpm db:migrate           执行全部未执行的迁移
 *   pnpm db:migrate:status    查看已执行 / 待执行
 *   pnpm db:migrate:undo      回滚最近一次迁移
 *
 * 与应用启动期的自动迁移共用同一套实现与同一把 MySQL 命名锁，
 * 因此「发布流水线里先跑 db:migrate」与「应用启动时自动迁移」不会互相踩踏。
 */
import { migrationStatus, rollbackLastMigration, runMigrations } from "../src/db/migrator.js";
import { sequelize } from "../src/db.js";

type Command = "up" | "down" | "status";

function parseCommand(argv: string[]): Command {
  const raw = argv[2] ?? "up";
  if (raw === "up" || raw === "down" || raw === "status") {
    return raw;
  }
  console.error(`未知子命令: ${raw}（可用：up | down | status）`);
  process.exit(1);
}

async function main() {
  const command = parseCommand(process.argv);
  await sequelize.authenticate();

  if (command === "status") {
    const { applied, pending } = await migrationStatus(sequelize);
    console.log(`已执行 (${String(applied.length)}):`);
    for (const name of applied) console.log(`  ✓ ${name}`);
    console.log(`待执行 (${String(pending.length)}):`);
    for (const name of pending) console.log(`  · ${name}`);
    return;
  }

  if (command === "down") {
    const reverted = await rollbackLastMigration(sequelize);
    console.log(reverted ? `已回滚: ${reverted}` : "没有可回滚的迁移");
    return;
  }

  const executed = await runMigrations(sequelize);
  console.log(executed.length > 0 ? `已执行: ${executed.join(", ")}` : "迁移已是最新，无需执行");
}

try {
  await main();
  await sequelize.close();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  await sequelize.close();
  process.exit(1);
}
