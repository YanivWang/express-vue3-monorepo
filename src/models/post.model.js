import { DataTypes } from "sequelize";

export function definePostModel(sequelize, User) {
  //定义一个数据库模型
  const Post = sequelize.define(
    "Post",
    {
      title: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: "标题",
      },
      content: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: "内容",
      },
      published: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        comment: "是否发送不",
      },
    },
    {
      indexes: [{ fields: ["published"] }],
    },
  );

  Post.belongsTo(User, { foreignKey: "authorId", as: "author" });
  User.hasMany(Post, { foreignKey: "authorId", as: "posts" });

  return Post;
}
