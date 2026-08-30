import { DataTypes, type Model, type ModelStatic, type Optional, type Sequelize } from "sequelize";

import type { DefinedColumns } from "./model-helpers.js";
import type { PostModel } from "./post.model.js";
import type { UserModel } from "./user.model.js";

/** PostFavorites 表的完整列，与 migrations/0001-initial-schema + 0003 保持一致 */
export interface PostFavoriteAttributes {
  id: number;
  /** 迁移 0003 起为 NOT NULL */
  postId: number;
  /** 迁移 0003 起为 NOT NULL */
  userId: number;
  createdAt: Date;
  updatedAt: Date;
}

export type PostFavoriteCreationAttributes = Optional<
  PostFavoriteAttributes,
  "id" | "createdAt" | "updatedAt"
>;

export type PostFavoriteModel = Model<PostFavoriteAttributes, PostFavoriteCreationAttributes> &
  PostFavoriteAttributes & {
    post?: PostModel;
    user?: UserModel;
  };

export function definePostFavoriteModel(
  sequelize: Sequelize,
  User: ModelStatic<UserModel>,
  Post: ModelStatic<PostModel>,
) {
  const PostFavorite = sequelize.define<PostFavoriteModel, DefinedColumns<PostFavoriteAttributes>>(
    "PostFavorite",
    {
      // 显式声明而非交给 belongsTo 隐式创建
      postId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        comment: "文章 Posts.id",
      },
      userId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        comment: "收藏用户 Users.id",
      },
    },
    {
      indexes: [{ unique: true, fields: ["postId", "userId"] }],
    },
  );

  // 与迁移 0003 一致：收藏必然同时归属某文章与某用户，库层已是 NOT NULL
  PostFavorite.belongsTo(Post, {
    foreignKey: { name: "postId", allowNull: false },
    as: "post",
    onDelete: "CASCADE",
  });
  PostFavorite.belongsTo(User, {
    foreignKey: { name: "userId", allowNull: false },
    as: "user",
    onDelete: "CASCADE",
  });
  Post.hasMany(PostFavorite, { foreignKey: "postId", as: "postFavorites" });
  User.hasMany(PostFavorite, { foreignKey: "userId", as: "postFavorites" });

  return PostFavorite;
}
