import { DataTypes, type Model, type ModelStatic, type Sequelize } from "sequelize";

export function definePostVoteModel(
  sequelize: Sequelize,
  User: ModelStatic<Model>,
  Post: ModelStatic<Model>,
) {
  const PostVote = sequelize.define(
    "PostVote",
    {
      value: {
        type: DataTypes.TINYINT,
        allowNull: false,
        comment: "1=赞 -1=踩",
      },
    },
    {
      indexes: [{ unique: true, fields: ["postId", "userId"] }, { fields: ["postId"] }],
    },
  );

  PostVote.belongsTo(Post, {
    foreignKey: "postId",
    as: "post",
    onDelete: "CASCADE",
  });
  PostVote.belongsTo(User, {
    foreignKey: "userId",
    as: "user",
    onDelete: "CASCADE",
  });
  Post.hasMany(PostVote, { foreignKey: "postId", as: "postVotes" });
  User.hasMany(PostVote, { foreignKey: "userId", as: "postVotes" });

  return PostVote;
}
