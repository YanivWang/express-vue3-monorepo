import { Transaction } from "sequelize";

import { Category, Post, PostFavorite, User, sequelize } from "../db.js";
import { createHttpError } from "../middlewares/error.middleware.js";

import type { Model } from "sequelize";

const authorAttributes = ["id", "username", "avatar"];
const categoryAttributes = ["id", "name"];

const postIncludeAuthor = { model: User, as: "author" as const, attributes: authorAttributes };
const postIncludeCategory = {
  model: Category,
  as: "category" as const,
  attributes: categoryAttributes,
};

export async function setPostFavorite(userId: number, postId: number, favorited: boolean) {
  const post = await Post.findByPk(postId);
  if (!post || !(post.get("published") as boolean)) {
    throw createHttpError(404, "文章不存在");
  }

  await sequelize.transaction(async (t: Transaction) => {
    const row = await PostFavorite.findOne({
      where: { postId, userId },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (favorited) {
      if (!row) {
        await PostFavorite.create({ postId, userId }, { transaction: t });
        await Post.increment("favoriteCount", { by: 1, where: { id: postId }, transaction: t });
      }
    } else if (row) {
      await row.destroy({ transaction: t });
      await Post.increment("favoriteCount", { by: -1, where: { id: postId }, transaction: t });
    }
  });
}

export async function findFavoritePostsPage(userId: number, page: number, limit: number) {
  const offset = (page - 1) * limit;
  const [total, rows] = await Promise.all([
    PostFavorite.count({ where: { userId } }),
    PostFavorite.findAll({
      where: { userId },
      order: [["createdAt", "DESC"]],
      limit,
      offset,
      include: [
        {
          model: Post,
          as: "post",
          required: true,
          include: [postIncludeAuthor, postIncludeCategory],
        },
      ],
    }),
  ]);
  const posts = rows.map((r) => r.get("post") as Model);
  const totalPages = total === 0 ? 0 : Math.ceil(total / limit);
  return { posts, total, totalPages };
}
