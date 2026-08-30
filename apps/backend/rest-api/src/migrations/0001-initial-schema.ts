/**
 * 基线迁移：与迁移体系上线前 `sequelize.sync()` 产出的表结构**完全一致**。
 *
 * 为什么要「照抄 sync 的产物」而不是顺手改好：
 * 线上与各位开发的本地库都是 sync() 建出来的。基线只有和它们逐字节相同，
 * 历史库才能被安全地登记为「基线已执行」（见 src/db/migrator.ts 的 adoptLegacySchemaIfNeeded），
 * 从而与新建库汇合到同一条迁移时间线上。
 * sync() 留下的问题（重复索引、外键列可空）不在这里修，改由 0002、0003 作为可审计、可回滚的独立步骤修正。
 *
 * 这里用原始 SQL 而非 queryInterface.createTable：本项目仅支持 MySQL，
 * 原始 SQL 能精确控制列注释、索引名与外键约束名，也才可能与历史库做严格 diff 校验。
 */
import type { QueryInterface } from "sequelize";

/** 建表顺序受外键依赖约束，删除时须严格逆序 */
const CREATE_STATEMENTS: { table: string; sql: string }[] = [
  {
    table: "Permissions",
    sql: `CREATE TABLE \`Permissions\` (
      \`id\` INT NOT NULL AUTO_INCREMENT,
      \`code\` VARCHAR(128) NOT NULL COMMENT '权限码，如 admin.posts.read',
      \`description\` VARCHAR(255) DEFAULT NULL COMMENT '说明',
      \`createdAt\` DATETIME NOT NULL,
      \`updatedAt\` DATETIME NOT NULL,
      PRIMARY KEY (\`id\`),
      UNIQUE KEY \`code\` (\`code\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`,
  },
  {
    table: "Roles",
    sql: `CREATE TABLE \`Roles\` (
      \`id\` INT NOT NULL AUTO_INCREMENT,
      \`name\` VARCHAR(64) NOT NULL COMMENT '展示名',
      \`slug\` VARCHAR(64) NOT NULL COMMENT '唯一标识，如 super_admin / user',
      \`isSystem\` TINYINT(1) NOT NULL DEFAULT '0' COMMENT '系统内置角色不可删除',
      \`isStaff\` TINYINT(1) NOT NULL DEFAULT '0' COMMENT '是否可登录后台（pc-admin）',
      \`createdAt\` DATETIME NOT NULL,
      \`updatedAt\` DATETIME NOT NULL,
      PRIMARY KEY (\`id\`),
      UNIQUE KEY \`slug\` (\`slug\`),
      UNIQUE KEY \`roles_slug_uidx\` (\`slug\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`,
  },
  {
    table: "RolePermissions",
    sql: `CREATE TABLE \`RolePermissions\` (
      \`roleId\` INT NOT NULL,
      \`permissionId\` INT NOT NULL,
      PRIMARY KEY (\`roleId\`,\`permissionId\`),
      UNIQUE KEY \`RolePermissions_permissionId_roleId_unique\` (\`roleId\`,\`permissionId\`),
      KEY \`permissionId\` (\`permissionId\`),
      CONSTRAINT \`RolePermissions_ibfk_1\` FOREIGN KEY (\`roleId\`) REFERENCES \`Roles\` (\`id\`) ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT \`RolePermissions_ibfk_2\` FOREIGN KEY (\`permissionId\`) REFERENCES \`Permissions\` (\`id\`) ON DELETE CASCADE ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`,
  },
  {
    table: "Users",
    sql: `CREATE TABLE \`Users\` (
      \`id\` INT NOT NULL AUTO_INCREMENT,
      \`username\` VARCHAR(255) NOT NULL COMMENT '用户名, 唯一登录标识',
      \`password\` VARCHAR(255) NOT NULL COMMENT '密码',
      \`avatar\` VARCHAR(255) DEFAULT NULL COMMENT '头像 URL（本站经 POST /api/uploads/profiles 为 /uploads/profiles/…）',
      \`roleId\` INT NOT NULL COMMENT 'RBAC 角色 id',
      \`createdAt\` DATETIME NOT NULL,
      \`updatedAt\` DATETIME NOT NULL,
      PRIMARY KEY (\`id\`),
      UNIQUE KEY \`username\` (\`username\`),
      KEY \`users_role_id_idx\` (\`roleId\`),
      CONSTRAINT \`Users_ibfk_1\` FOREIGN KEY (\`roleId\`) REFERENCES \`Roles\` (\`id\`) ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`,
  },
  {
    table: "UserProfiles",
    sql: `CREATE TABLE \`UserProfiles\` (
      \`id\` INT NOT NULL AUTO_INCREMENT,
      \`userId\` INT NOT NULL COMMENT 'Users.id，一对一',
      \`nickname\` VARCHAR(100) DEFAULT NULL,
      \`avatar\` VARCHAR(500) DEFAULT NULL COMMENT '与 Users.avatar 双写；展示以 Users 为准',
      \`gender\` VARCHAR(20) DEFAULT NULL COMMENT 'male / female / unknown',
      \`birthday\` DATE DEFAULT NULL,
      \`bio\` TEXT,
      \`address\` VARCHAR(255) DEFAULT NULL,
      \`company\` VARCHAR(255) DEFAULT NULL,
      \`jobTitle\` VARCHAR(255) DEFAULT NULL,
      \`isMarried\` TINYINT(1) DEFAULT NULL,
      \`mom\` VARCHAR(255) DEFAULT NULL,
      \`father\` VARCHAR(255) DEFAULT NULL,
      \`university\` VARCHAR(255) DEFAULT NULL,
      \`createdAt\` DATETIME NOT NULL,
      \`updatedAt\` DATETIME NOT NULL,
      PRIMARY KEY (\`id\`),
      UNIQUE KEY \`user_profiles_user_id_unique\` (\`userId\`),
      CONSTRAINT \`UserProfiles_ibfk_1\` FOREIGN KEY (\`userId\`) REFERENCES \`Users\` (\`id\`) ON DELETE CASCADE ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`,
  },
  {
    table: "Categories",
    sql: `CREATE TABLE \`Categories\` (
      \`id\` INT NOT NULL AUTO_INCREMENT,
      \`name\` VARCHAR(255) NOT NULL COMMENT '分类名称',
      \`parentId\` INT DEFAULT NULL COMMENT '父分类 id；null 表示一级分类',
      \`sortOrder\` INT NOT NULL DEFAULT '0' COMMENT '同级排序，越小越靠前',
      \`createdAt\` DATETIME NOT NULL,
      \`updatedAt\` DATETIME NOT NULL,
      PRIMARY KEY (\`id\`),
      KEY \`categories_parent_id\` (\`parentId\`),
      CONSTRAINT \`Categories_ibfk_1\` FOREIGN KEY (\`parentId\`) REFERENCES \`Categories\` (\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`,
  },
  {
    table: "Posts",
    sql: `CREATE TABLE \`Posts\` (
      \`id\` INT NOT NULL AUTO_INCREMENT,
      \`title\` VARCHAR(255) NOT NULL COMMENT '标题',
      \`content\` TEXT NOT NULL COMMENT '内容',
      \`published\` TINYINT(1) NOT NULL COMMENT '是否已发布',
      \`categoryId\` INT NOT NULL COMMENT '所属叶子分类（二级）id',
      \`externalSource\` VARCHAR(64) DEFAULT NULL COMMENT '外部数据来源标识，与 externalKey 成对用于导入幂等',
      \`externalKey\` VARCHAR(128) DEFAULT NULL COMMENT '外部实体键（如 note slug），与 externalSource 成对唯一',
      \`likeCount\` INT NOT NULL DEFAULT '0' COMMENT '点赞数',
      \`dislikeCount\` INT NOT NULL DEFAULT '0' COMMENT '踩数',
      \`favoriteCount\` INT NOT NULL DEFAULT '0' COMMENT '收藏数',
      \`viewCount\` INT NOT NULL DEFAULT '0' COMMENT '阅读次数(PV)',
      \`commentCount\` INT NOT NULL DEFAULT '0' COMMENT '评论总条数(含回复)',
      \`createdAt\` DATETIME NOT NULL,
      \`updatedAt\` DATETIME NOT NULL,
      \`authorId\` INT DEFAULT NULL,
      PRIMARY KEY (\`id\`),
      UNIQUE KEY \`posts_external_source_key_uidx\` (\`externalSource\`,\`externalKey\`),
      KEY \`authorId\` (\`authorId\`),
      KEY \`posts_published\` (\`published\`),
      KEY \`posts_category_id\` (\`categoryId\`),
      CONSTRAINT \`Posts_ibfk_1\` FOREIGN KEY (\`categoryId\`) REFERENCES \`Categories\` (\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE,
      CONSTRAINT \`Posts_ibfk_2\` FOREIGN KEY (\`authorId\`) REFERENCES \`Users\` (\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`,
  },
  {
    table: "PostVotes",
    sql: `CREATE TABLE \`PostVotes\` (
      \`id\` INT NOT NULL AUTO_INCREMENT,
      \`value\` TINYINT NOT NULL COMMENT '1=赞 -1=踩',
      \`createdAt\` DATETIME NOT NULL,
      \`updatedAt\` DATETIME NOT NULL,
      \`postId\` INT DEFAULT NULL,
      \`userId\` INT DEFAULT NULL,
      PRIMARY KEY (\`id\`),
      UNIQUE KEY \`post_votes_post_id_user_id\` (\`postId\`,\`userId\`),
      KEY \`userId\` (\`userId\`),
      KEY \`post_votes_post_id\` (\`postId\`),
      CONSTRAINT \`PostVotes_ibfk_1\` FOREIGN KEY (\`postId\`) REFERENCES \`Posts\` (\`id\`) ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT \`PostVotes_ibfk_2\` FOREIGN KEY (\`userId\`) REFERENCES \`Users\` (\`id\`) ON DELETE CASCADE ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`,
  },
  {
    table: "PostFavorites",
    sql: `CREATE TABLE \`PostFavorites\` (
      \`id\` INT NOT NULL AUTO_INCREMENT,
      \`createdAt\` DATETIME NOT NULL,
      \`updatedAt\` DATETIME NOT NULL,
      \`postId\` INT DEFAULT NULL,
      \`userId\` INT DEFAULT NULL,
      PRIMARY KEY (\`id\`),
      UNIQUE KEY \`post_favorites_post_id_user_id\` (\`postId\`,\`userId\`),
      KEY \`userId\` (\`userId\`),
      KEY \`post_favorites_post_id\` (\`postId\`),
      CONSTRAINT \`PostFavorites_ibfk_1\` FOREIGN KEY (\`postId\`) REFERENCES \`Posts\` (\`id\`) ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT \`PostFavorites_ibfk_2\` FOREIGN KEY (\`userId\`) REFERENCES \`Users\` (\`id\`) ON DELETE CASCADE ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`,
  },
  {
    table: "Comments",
    sql: `CREATE TABLE \`Comments\` (
      \`id\` INT NOT NULL AUTO_INCREMENT,
      \`content\` TEXT NOT NULL COMMENT '评论正文',
      \`rootId\` INT DEFAULT NULL COMMENT '楼主评 id（与顶层评论自身 id 相同）；楼层内回复均指向该 id',
      \`createdAt\` DATETIME NOT NULL,
      \`updatedAt\` DATETIME NOT NULL,
      \`postId\` INT DEFAULT NULL,
      \`authorId\` INT DEFAULT NULL,
      \`parentId\` INT DEFAULT NULL,
      PRIMARY KEY (\`id\`),
      KEY \`comments_post_id\` (\`postId\`),
      KEY \`comments_author_id\` (\`authorId\`),
      KEY \`comments_parent_id\` (\`parentId\`),
      KEY \`comments_root_id\` (\`rootId\`),
      KEY \`comments_post_id_root_id\` (\`postId\`,\`rootId\`),
      CONSTRAINT \`Comments_ibfk_1\` FOREIGN KEY (\`postId\`) REFERENCES \`Posts\` (\`id\`) ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT \`Comments_ibfk_2\` FOREIGN KEY (\`authorId\`) REFERENCES \`Users\` (\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE,
      CONSTRAINT \`Comments_ibfk_3\` FOREIGN KEY (\`parentId\`) REFERENCES \`Comments\` (\`id\`) ON DELETE CASCADE ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`,
  },
];

export async function up(queryInterface: QueryInterface): Promise<void> {
  for (const { sql } of CREATE_STATEMENTS) {
    await queryInterface.sequelize.query(sql);
  }
}

export async function down(queryInterface: QueryInterface): Promise<void> {
  // 逆序删除以满足外键依赖
  for (const { table } of [...CREATE_STATEMENTS].reverse()) {
    await queryInterface.sequelize.query(`DROP TABLE IF EXISTS \`${table}\``);
  }
}
