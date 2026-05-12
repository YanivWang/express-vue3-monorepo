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
        comment: "头像 URL（本站经 POST /api/uploads/profiles 为 /uploads/profiles/…）",
      },
      roleId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        comment: "RBAC 角色 id",
      },
    },
    {
      indexes: [{ name: "users_role_id_idx", fields: ["roleId"] }],
    },
  );
}
