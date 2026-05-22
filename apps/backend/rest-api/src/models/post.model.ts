import { DataTypes, type Model, type ModelStatic, type Sequelize } from "sequelize";

export function definePostModel(
  sequelize: Sequelize,
  User: ModelStatic<Model>,
  Category: ModelStatic<Model>,
) {
  const Post = sequelize.define(
    "Post",
    {
      title: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: "标题",
      },
      content: {
        type: DataTypes.TEXT,
        allowNull: false,
        comment: "内容",
      },
      published: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        comment: "是否已发布",
      },
      categoryId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        comment: "所属叶子分类（二级）id",
      },
      externalSource: {
        type: DataTypes.STRING(64),
        allowNull: true,
        comment: "外部数据来源标识，与 externalKey 成对用于导入幂等",
      },
      externalKey: {
        type: DataTypes.STRING(128),
        allowNull: true,
        comment: "外部实体键（如 note slug），与 externalSource 成对唯一",
      },
      likeCount: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: "点赞数",
      },
      dislikeCount: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: "踩数",
      },
      favoriteCount: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: "收藏数",
      },
      viewCount: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: "阅读次数(PV)",
      },
      commentCount: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: "评论总条数(含回复)",
      },
    },
    {
      indexes: [
        { fields: ["published"] },
        { fields: ["categoryId"] },
        {
          name: "posts_external_source_key_uidx",
          unique: true,
          fields: ["externalSource", "externalKey"],
        },
      ],
    },
  );

  Post.belongsTo(User, {
    foreignKey: "authorId",
    as: "author",
    onDelete: "RESTRICT",
  });
  Post.belongsTo(Category, {
    foreignKey: "categoryId",
    as: "category",
    onDelete: "RESTRICT",
  });

  User.hasMany(Post, { foreignKey: "authorId", as: "posts" });
  Category.hasMany(Post, { foreignKey: "categoryId", as: "posts" });

  return Post;
}
