import { defineUserModel } from "./user.model.js";
import { definePostModel } from "./post.model.js";
import { defineCommentModel } from "./comment.model.js";

//sequelize 的 models 的入口文件，统一导入所有定义的model
//通过initModels方法，来聚合调用各个模型的 definexxxModel方法，实现模型定义

//sequelize 是 Sequelize 实例
export function initModels(sequelize) {
  const User = defineUserModel(sequelize);
  //注册Post模型类
  const Post = definePostModel(sequelize, User);
  const Comment = defineCommentModel(sequelize, User, Post);

  return {
    User,
    Post, //导出Post模型类
    Comment,
  };
}
