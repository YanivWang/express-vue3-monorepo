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
