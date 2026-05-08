import { DataTypes } from "sequelize";

//sequelize 已初始化的 Sequelize 实例
export function definePostModel(sequelize, User, Category) {
  //定义数据库一张表对应的 ORM 模型
  //后续通过这模型 Post 在路由对应的服务层，来操作数据库中对应的表
  const Post = sequelize.define(
    "Post",
    //定义字段的配置对象
    {
      title: {
        //列名
        type: DataTypes.STRING, // DataTypes 用于声明列类型 => 对应数据库 VARCHAR
        allowNull: false, // 插入/更新时 不能为 null
        comment: "标题", //数据库层面的字段注释
      },
      content: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: "内容",
      },
      published: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        comment: "是否已发送",
      },
      categoryId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        comment: "所属叶子分类（二级）id",
      },
      images: {
        type: DataTypes.JSON,
        allowNull: false,
        defaultValue: [],
        comment: "正文配图 URL 列表（本站 /uploads/... 路径）",
      },
    },
    // 模型级选项
    // indexes 在字段 published 列上建索引，加快按 “是否发布” 筛选的查询
    {
      indexes: [{ fields: ["published"] }, { fields: ["categoryId"] }],
    },
  );

  //声明 多 对 一: 多篇Post属于一个User
  //按 Sequelize 的约定，外键写在「多」的这一边，也就是 Post 表。
  //foreignKey: "authorId"：Post 表上的外键列明，指定这张表的外键列的名字叫 authorId(（通常对应 User 表的主键 id）)
  //预加载时用 include: { model: User, as: "author" } 时的别名
  Post.belongsTo(User, { foreignKey: "authorId", as: "author" });
  Post.belongsTo(Category, { foreignKey: "categoryId", as: "category" });

  //声明 一 对 多，一个User有多个Post，外键仍是Post上的 authorId
  //as: "posts" =>  从 User 查关联 Post 集合时的别名（如 user.getPosts() 或 include as: 'posts'）。

  //User 表不会因为这个关系多一个 authorId 列；一对多只是声明「User 有很多 Post，外键还是 Post 上的 authorId」：
  User.hasMany(Post, { foreignKey: "authorId", as: "posts" });

  Category.hasMany(Post, { foreignKey: "categoryId", as: "posts" });

  //返回定义好的Post模型类
  return Post;
}
