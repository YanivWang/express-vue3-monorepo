import { defineUserModel } from "./user.model.js";
import { definePostModel } from "./post.model.js";

export function initModels(sequelize) {
  const User = defineUserModel(sequelize);
  const Post = definePostModel(sequelize, User);

  return {
    User,
    Post,
  };
}
