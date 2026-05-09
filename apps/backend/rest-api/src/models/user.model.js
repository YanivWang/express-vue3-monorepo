import { DataTypes } from "sequelize";

//完善 User 模型的字段
export function defineUserModel(sequelize) {
  return sequelize.define("User", {
    username: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      comment: "用户名, 唯一登录标识",
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: "密码",
    },
    avatar: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: "头像",
    },
    role: {
      type: DataTypes.TINYINT,
      allowNull: false,
      defaultValue: 0,
      comment: "0: user, 1: admin",
    },
  });
}
