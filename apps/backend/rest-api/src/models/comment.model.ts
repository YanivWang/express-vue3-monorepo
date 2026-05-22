import { DataTypes, type Model, type ModelStatic, type Sequelize } from "sequelize";

export function defineCommentModel(
  sequelize: Sequelize,
  User: ModelStatic<Model>,
  Post: ModelStatic<Model>,
) {
  const Comment = sequelize.define(
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
    },
    {
      indexes: [
        { fields: ["postId"] },
        { fields: ["authorId"] },
        { fields: ["parentId"] },
        { fields: ["rootId"] },
        { fields: ["postId", "rootId"] },
      ],
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
