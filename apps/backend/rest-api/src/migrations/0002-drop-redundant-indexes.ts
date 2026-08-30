/**
 * 清除 `sequelize.sync()` 遗留的冗余索引。
 *
 * 这些索引不是 `alter: true` 的产物——即便对空库执行一次干净的 sync()，下面五个索引也照样会被建出来：
 * 模型上同时写了属性级 `unique: true` 与 `indexes: [...]` 会生成两条等价唯一索引；
 * 复合唯一索引与它的最左前缀单列索引也会同时存在。
 *
 * 每条冗余索引都要额外占用写入开销与存储，且长期依赖 scripts/dedupe-mysql-redundant-indexes.ts
 * 在数据层「事后擦除」，属于用脚本掩盖问题。改由本迁移一次性、可审计、可回滚地处理。
 *
 * 安全性说明：被删的三条单列索引都能被现存复合索引的最左前缀覆盖，
 * 因此相关外键约束所需的索引依然成立，MySQL 不会拒绝删除。
 */
import type { QueryInterface } from "sequelize";

interface RedundantIndex {
  table: string;
  /** 待删除的冗余索引名 */
  index: string;
  /** 使其冗余的那条索引（回滚时需要它仍然存在） */
  supersededBy: string;
  /** 回滚用的重建语句 */
  recreate: string;
}

const REDUNDANT_INDEXES: RedundantIndex[] = [
  {
    table: "Roles",
    index: "slug",
    supersededBy: "roles_slug_uidx",
    recreate: "ALTER TABLE `Roles` ADD UNIQUE KEY `slug` (`slug`)",
  },
  {
    table: "RolePermissions",
    index: "RolePermissions_permissionId_roleId_unique",
    supersededBy: "PRIMARY",
    recreate:
      "ALTER TABLE `RolePermissions` ADD UNIQUE KEY `RolePermissions_permissionId_roleId_unique` (`roleId`,`permissionId`)",
  },
  {
    table: "PostVotes",
    index: "post_votes_post_id",
    supersededBy: "post_votes_post_id_user_id",
    recreate: "ALTER TABLE `PostVotes` ADD KEY `post_votes_post_id` (`postId`)",
  },
  {
    table: "PostFavorites",
    index: "post_favorites_post_id",
    supersededBy: "post_favorites_post_id_user_id",
    recreate: "ALTER TABLE `PostFavorites` ADD KEY `post_favorites_post_id` (`postId`)",
  },
  {
    table: "Comments",
    index: "comments_post_id",
    supersededBy: "comments_post_id_root_id",
    recreate: "ALTER TABLE `Comments` ADD KEY `comments_post_id` (`postId`)",
  },
];

/** 历史库可能已被 scripts/dedupe-mysql-redundant-indexes.ts 清理过，故须逐条判断存在性 */
async function indexExists(
  queryInterface: QueryInterface,
  table: string,
  index: string,
): Promise<boolean> {
  const rows = await queryInterface.sequelize.query<{ cnt: number | string }>(
    `SELECT COUNT(*) AS cnt FROM information_schema.statistics
      WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ?`,
    { replacements: [table, index], type: "SELECT" as never },
  );
  return Number(rows[0]?.cnt ?? 0) > 0;
}

export async function up(queryInterface: QueryInterface): Promise<void> {
  for (const { table, index } of REDUNDANT_INDEXES) {
    if (!(await indexExists(queryInterface, table, index))) continue;
    await queryInterface.sequelize.query(`ALTER TABLE \`${table}\` DROP INDEX \`${index}\``);
  }
}

export async function down(queryInterface: QueryInterface): Promise<void> {
  for (const { table, index, recreate } of REDUNDANT_INDEXES) {
    if (await indexExists(queryInterface, table, index)) continue;
    await queryInterface.sequelize.query(recreate);
  }
}
