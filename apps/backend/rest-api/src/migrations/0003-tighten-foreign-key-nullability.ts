/**
 * 收紧隐式外键列的可空性。
 *
 * 根因：`Post.belongsTo(User, { foreignKey: "authorId" })` 这类关联会**隐式**创建外键列，
 * 而 Sequelize 对隐式列的默认约束是 `allowNull: true`。于是数据库层允许出现
 * 「没有作者的文章」「不属于任何文章的评论」「没有用户的投票」这类孤儿行——
 * 业务代码从不写出这种数据，但约束的缺失意味着任何一次脚本失误或并发缺陷都能把脏数据落库，
 * 且此后所有 JOIN 与统计都要为这个不可能发生的 NULL 分支买单。
 *
 * `Comments.parentId`、`Comments.rootId` 保持可空：顶层评论本就没有父评论，
 * 而 rootId 在插入后才回填（见 comment.service.ts 的事务），二者的 NULL 是有业务含义的。
 */
import type { QueryInterface } from "sequelize";

interface ColumnTightening {
  table: string;
  column: string;
  /** 收紧后的完整列定义（MySQL MODIFY COLUMN 需要重述类型） */
  notNullDefinition: string;
  /** 回滚用的可空定义 */
  nullableDefinition: string;
}

const TIGHTENINGS: ColumnTightening[] = [
  {
    table: "Posts",
    column: "authorId",
    notNullDefinition: "INT NOT NULL",
    nullableDefinition: "INT NULL",
  },
  {
    table: "Comments",
    column: "postId",
    notNullDefinition: "INT NOT NULL",
    nullableDefinition: "INT NULL",
  },
  {
    table: "Comments",
    column: "authorId",
    notNullDefinition: "INT NOT NULL",
    nullableDefinition: "INT NULL",
  },
  {
    table: "PostVotes",
    column: "postId",
    notNullDefinition: "INT NOT NULL",
    nullableDefinition: "INT NULL",
  },
  {
    table: "PostVotes",
    column: "userId",
    notNullDefinition: "INT NOT NULL",
    nullableDefinition: "INT NULL",
  },
  {
    table: "PostFavorites",
    column: "postId",
    notNullDefinition: "INT NOT NULL",
    nullableDefinition: "INT NULL",
  },
  {
    table: "PostFavorites",
    column: "userId",
    notNullDefinition: "INT NOT NULL",
    nullableDefinition: "INT NULL",
  },
];

/**
 * 先体检再改结构：直接 MODIFY 会在存量 NULL 上抛出难以定位的 MySQL 错误，
 * 这里主动把「哪张表哪一列有多少行为 NULL」讲清楚，让运维知道该先清理什么。
 */
async function assertNoNullRows(queryInterface: QueryInterface): Promise<void> {
  const offenders: string[] = [];

  for (const { table, column } of TIGHTENINGS) {
    const rows = await queryInterface.sequelize.query<{ cnt: number | string }>(
      `SELECT COUNT(*) AS cnt FROM \`${table}\` WHERE \`${column}\` IS NULL`,
      { type: "SELECT" as never },
    );
    const count = Number(rows[0]?.cnt ?? 0);
    if (count > 0) {
      offenders.push(`${table}.${column} 存在 ${String(count)} 行 NULL`);
    }
  }

  if (offenders.length > 0) {
    throw new Error(
      `[migrate:0003] 存在孤儿数据，无法收紧外键列：\n  ${offenders.join("\n  ")}\n` +
        "请先清理或回填这些行（它们本就不应存在），再重新执行迁移。",
    );
  }
}

export async function up(queryInterface: QueryInterface): Promise<void> {
  await assertNoNullRows(queryInterface);

  for (const { table, column, notNullDefinition } of TIGHTENINGS) {
    await queryInterface.sequelize.query(
      `ALTER TABLE \`${table}\` MODIFY COLUMN \`${column}\` ${notNullDefinition}`,
    );
  }
}

export async function down(queryInterface: QueryInterface): Promise<void> {
  for (const { table, column, nullableDefinition } of TIGHTENINGS) {
    await queryInterface.sequelize.query(
      `ALTER TABLE \`${table}\` MODIFY COLUMN \`${column}\` ${nullableDefinition}`,
    );
  }
}
