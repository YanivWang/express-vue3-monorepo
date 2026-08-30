import { type Model, type ModelStatic, type Sequelize } from "sequelize";

export function definePostFavoriteModel(
  sequelize: Sequelize,
  User: ModelStatic<Model>,
  Post: ModelStatic<Model>,
) {
  const PostFavorite = sequelize.define(
    "PostFavorite",
    {},
    {
      indexes: [{ unique: true, fields: ["postId", "userId"] }, { fields: ["postId"] }],
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
