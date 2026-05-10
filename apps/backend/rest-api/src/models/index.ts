import { defineCategoryModel } from "./category.model.js";
import { defineCommentModel } from "./comment.model.js";
import { definePostModel } from "./post.model.js";
import { defineUserModel } from "./user.model.js";

import type { Sequelize } from "sequelize";

//sequelize 的 models 的入口文件，统一导入所有定义的model
//通过initModels方法，来聚合调用各个模型的 definexxxModel方法，实现模型定义

//sequelize 是 Sequelize 实例
export function initModels(sequelize: Sequelize) {
  const User = defineUserModel(sequelize);
  const Category = defineCategoryModel(sequelize);
  const Post = definePostModel(sequelize, User, Category);
  const Comment = defineCommentModel(sequelize, User, Post);

  return {
    User,
    Category,
    Post,
    Comment,
  };
}
