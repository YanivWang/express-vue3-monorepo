import { DataTypes, type Model, type ModelCtor, type Sequelize } from "sequelize";

//新建 comment 的数据库模型
export function defineCommentModel(
  sequelize: Sequelize,
  User: ModelCtor<Model>,
  Post: ModelCtor<Model>,
) {
  const Comment = sequelize.define(
    "Comment",
    {
      content: {
        type: DataTypes.TEXT,
        allowNull: false,
        comment: "评论正文",
      },
    },
    {
      indexes: [{ fields: ["postId"] }, { fields: ["authorId"] }, { fields: ["parentId"] }],
    },
  );

  Comment.belongsTo(Post, { foreignKey: "postId", as: "post", onDelete: "CASCADE" });
  Post.hasMany(Comment, { foreignKey: "postId", as: "comments" });

  Comment.belongsTo(User, {
    foreignKey: "authorId",
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
