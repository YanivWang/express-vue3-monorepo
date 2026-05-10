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

  PostFavorite.belongsTo(Post, {
    foreignKey: "postId",
    as: "post",
    onDelete: "CASCADE",
  });
  PostFavorite.belongsTo(User, {
    foreignKey: "userId",
    as: "user",
    onDelete: "CASCADE",
  });
  Post.hasMany(PostFavorite, { foreignKey: "postId", as: "postFavorites" });
  User.hasMany(PostFavorite, { foreignKey: "userId", as: "postFavorites" });

  return PostFavorite;
}
