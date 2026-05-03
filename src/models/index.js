import { defineUserModel } from "./user.model.js";

export function initModels(sequelize) {
  const User = defineUserModel(sequelize);

  return {
    User,
  };
}
