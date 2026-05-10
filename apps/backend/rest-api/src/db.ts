// 数据库文件: 连接 mysql + 初始化 Sequelize 模型

import { Sequelize } from "sequelize";

import { APP_ENV, DB_HOST, DB_PORT, DB_USER, DB_PWD, DB_NAME } from "./env.js";
import { initModels } from "./models/index.js";

// 创建 sequelize 实例
// 并没有立即连接数据库

// 配置对象：存储数据库连接参数（host、port、user、password 等）
// 连接池管理器：初始化连接池（但池为空）
// 查询执行引擎：准备执行 SQL 的基础设施
// 模型注册中心：为后续模型定义做准备
const sequelize = new Sequelize(DB_NAME, DB_USER, DB_PWD, {
  host: DB_HOST,
  port: DB_PORT,
  dialect: "mysql",
});

const { User, Category, Post, PostVote, PostFavorite, Comment } = initModels(sequelize);

async function backfillPostAggregatesFromRelations() {
  try {
    const p = `\`${Post.tableName}\``;
    const c = `\`${Comment.tableName}\``;
    const f = `\`${PostFavorite.tableName}\``;
    const v = `\`${PostVote.tableName}\``;
    await sequelize.query(`
      UPDATE ${p} AS o
      SET
        commentCount = (SELECT COUNT(*) FROM ${c} cc WHERE cc.postId = o.id),
        favoriteCount = (SELECT COUNT(*) FROM ${f} ff WHERE ff.postId = o.id),
        likeCount = (SELECT COUNT(*) FROM ${v} vv WHERE vv.postId = o.id AND vv.value = 1),
        dislikeCount = (SELECT COUNT(*) FROM ${v} vv WHERE vv.postId = o.id AND vv.value = -1)
    `);
  } catch (err) {
    console.warn("[db] backfillPostAggregatesFromRelations skipped:", err);
  }
}

/** Categories 表为空时写入示例两级类目（与新库 / reset-db 配合） */
async function seedDefaultCategoriesIfEmpty() {
  const n = await Category.count();
  if (n > 0) return;

  const root = await Category.create({
    name: "IT技术",
    parentId: null,
    sortOrder: 0,
  });

  const children: [string, number][] = [
    ["后端", 0],
    ["前端", 1],
    ["Android", 2],
    ["iOS", 3],
    ["人工智能", 4],
    ["数据库", 5],
    ["程序开发", 6],
  ];

  await Category.bulkCreate(
    children.map(([name, sortOrder]) => ({
      name,
      parentId: root.get("id") as number,
      sortOrder,
    })),
  );
}

/**
 * 启动时 `authenticate()` 校验连通性（账号、库名、网络等）；失败则抛错，避免拖到首条业务 SQL 才暴露。
 * development：默认 `sync({ alter: true })`；`DB_SYNC_ALTER=0` 时不 alter（仅建缺表）。
 * test / production：仅 `sync()`，不 alter。
 */
export async function connectDatabase() {
  await sequelize.authenticate();
  if (APP_ENV === "development") {
    const alter = process.env.DB_SYNC_ALTER !== "0";
    await sequelize.sync(alter ? { alter: true } : {});
    await backfillPostAggregatesFromRelations();
    try {
      const { backfillCommentRootIds } = await import("./services/comment.service.js");
      await backfillCommentRootIds();
    } catch (err) {
      console.warn("[db] backfillCommentRootIds skipped:", err);
    }
  } else {
    await sequelize.sync();
    try {
      const { backfillCommentRootIds } = await import("./services/comment.service.js");
      await backfillCommentRootIds();
    } catch (err) {
      console.warn("[db] backfillCommentRootIds skipped:", err);
    }
  }
  await seedDefaultCategoriesIfEmpty();
}

export { sequelize, User, Category, Post, PostVote, PostFavorite, Comment };
