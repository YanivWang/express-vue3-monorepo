import { DataTypes, type Sequelize } from "sequelize";

//完善 User 模型的字段
export function defineUserModel(sequelize: Sequelize) {
  return sequelize.define(
    "User",
    {
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
      /** 兼容旧逻辑：0 前台用户 1 管理员；新逻辑以 roleId + RBAC 为准（DB 列名仍为 role） */
      legacyRole: {
        type: DataTypes.TINYINT,
        allowNull: false,
        defaultValue: 0,
        field: "role",
        comment: "0: user, 1: admin（兼容列，以 roleId 为准）",
      },
      roleId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: "RBAC 角色 id",
      },
    },
    {
      indexes: [{ name: "users_role_id_idx", fields: ["roleId"] }],
    },
  );
}
