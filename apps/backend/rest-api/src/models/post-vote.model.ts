import { DataTypes, type Model, type ModelStatic, type Optional, type Sequelize } from "sequelize";

import type { DefinedColumns } from "./model-helpers.js";
import type { PostModel } from "./post.model.js";
import type { UserModel } from "./user.model.js";

/** PostVotes 表的完整列，与 migrations/0001-initial-schema + 0003 保持一致 */
export interface PostVoteAttributes {
  id: number;
  /** 1=赞 -1=踩 */
  value: number;
  /** 迁移 0003 起为 NOT NULL */
  postId: number;
  /** 迁移 0003 起为 NOT NULL */
  userId: number;
  createdAt: Date;
  updatedAt: Date;
}

export type PostVoteCreationAttributes = Optional<
  PostVoteAttributes,
  "id" | "createdAt" | "updatedAt"
>;

export type PostVoteModel = Model<PostVoteAttributes, PostVoteCreationAttributes> &
  PostVoteAttributes & {
    post?: PostModel;
    user?: UserModel;
  };

export function definePostVoteModel(
  sequelize: Sequelize,
  User: ModelStatic<UserModel>,
  Post: ModelStatic<PostModel>,
) {
  const PostVote = sequelize.define<PostVoteModel, DefinedColumns<PostVoteAttributes>>(
    "PostVote",
    {
      value: {
        type: DataTypes.TINYINT,
        allowNull: false,
        comment: "1=赞 -1=踩",
      },
      // 显式声明而非交给 belongsTo 隐式创建
      postId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        comment: "文章 Posts.id",
      },
      userId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        comment: "投票用户 Users.id",
      },
    },
    {
      indexes: [{ unique: true, fields: ["postId", "userId"] }],
    },
  );

  // 与迁移 0003 一致：投票必然同时归属某文章与某用户，库层已是 NOT NULL
  PostVote.belongsTo(Post, {
    foreignKey: { name: "postId", allowNull: false },
    as: "post",
    onDelete: "CASCADE",
  });
  PostVote.belongsTo(User, {
    foreignKey: { name: "userId", allowNull: false },
    as: "user",
    onDelete: "CASCADE",
  });
  Post.hasMany(PostVote, { foreignKey: "postId", as: "postVotes" });
  User.hasMany(PostVote, { foreignKey: "userId", as: "postVotes" });

  return PostVote;
}
