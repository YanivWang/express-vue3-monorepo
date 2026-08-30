import { DataTypes, type Model, type ModelStatic, type Optional, type Sequelize } from "sequelize";

import type { DefinedColumns } from "./model-helpers.js";
import type { PostModel } from "./post.model.js";
import type { UserModel } from "./user.model.js";

/** Comments 表的完整列，与 migrations/0001-initial-schema + 0003 保持一致 */
export interface CommentAttributes {
  id: number;
  content: string;
  /** 楼主评 id（与顶层评论自身 id 相同）；插入后回填，故可空 */
  rootId: number | null;
  /** 迁移 0003 起为 NOT NULL */
  postId: number;
  /** 迁移 0003 起为 NOT NULL */
  authorId: number;
  /** 顶层评论没有父评论，保持可空 */
  parentId: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export type CommentCreationAttributes = Optional<
  CommentAttributes,
  "id" | "rootId" | "parentId" | "createdAt" | "updatedAt"
>;

export type CommentModel = Model<CommentAttributes, CommentCreationAttributes> &
  CommentAttributes & {
    /** 仅在 include 了对应 as 时存在 */
    post?: PostModel;
    author?: UserModel;
    parent?: CommentModel;
    replies?: CommentModel[];
  };

export function defineCommentModel(
  sequelize: Sequelize,
  User: ModelStatic<UserModel>,
  Post: ModelStatic<PostModel>,
) {
  const Comment = sequelize.define<CommentModel, DefinedColumns<CommentAttributes>>(
    "Comment",
    {
      content: {
        type: DataTypes.TEXT,
        allowNull: false,
        comment: "评论正文",
      },
      rootId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: "楼主评 id（与顶层评论自身 id 相同）；楼层内回复均指向该 id",
      },
      // 以下三列此前由 belongsTo 隐式创建，模型因此无法完整描述表结构；现显式声明
      postId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        comment: "所属文章 Posts.id",
      },
      authorId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        comment: "评论作者 Users.id",
      },
      parentId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: "父评论 id；顶层评论为 null",
      },
    },
    {
      // 与迁移保持一致：单列 postId 索引已由 0002 删除，(postId, rootId) 的最左前缀即可覆盖
      indexes: [
        { fields: ["authorId"] },
        { fields: ["parentId"] },
        { fields: ["rootId"] },
        { fields: ["postId", "rootId"] },
      ],
    },
  );

  // 与迁移 0003 一致：评论必须挂在某篇文章下，库层已是 NOT NULL
  Comment.belongsTo(Post, {
    foreignKey: { name: "postId", allowNull: false },
    as: "post",
    onDelete: "CASCADE",
  });
  Post.hasMany(Comment, { foreignKey: "postId", as: "comments" });

  Comment.belongsTo(User, {
    // 与迁移 0003 一致：评论必须有作者，库层已是 NOT NULL
    foreignKey: { name: "authorId", allowNull: false },
    as: "author",
    onDelete: "RESTRICT",
  });
  User.hasMany(Comment, { foreignKey: "authorId", as: "comments" });

  Comment.belongsTo(Comment, {
    foreignKey: "parentId",
    as: "parent",
    onDelete: "CASCADE",
  });
  Comment.hasMany(Comment, { foreignKey: "parentId", as: "replies" });

  return Comment;
}
