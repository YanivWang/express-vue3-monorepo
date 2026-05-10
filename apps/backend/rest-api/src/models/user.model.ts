import { DataTypes, type Sequelize } from "sequelize";

//完善 User 模型的字段
export function defineUserModel(sequelize: Sequelize) {
  // username 唯一约束用显式索引名，避免 dev 下 sync({ alter: true }) 反复 ALTER 时
  // MySQL 不断新建 UNIQUE（username_2、username_3…）直至 ER_TOO_MANY_KEYS
  return sequelize.define(
    "User",
    {
      username: {
        type: DataTypes.STRING,
        allowNull: false,
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
      indexes: [
        { name: "users_username_uidx", unique: true, fields: ["username"] },
        { name: "users_role_id_idx", fields: ["roleId"] },
      ],
    },
  );
}
