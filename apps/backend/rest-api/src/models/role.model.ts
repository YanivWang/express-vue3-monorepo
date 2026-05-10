import { DataTypes, type Sequelize } from "sequelize";

export function defineRoleModel(sequelize: Sequelize) {
  return sequelize.define(
    "Role",
    {
      name: {
        type: DataTypes.STRING(64),
        allowNull: false,
        comment: "展示名",
      },
      slug: {
        type: DataTypes.STRING(64),
        allowNull: false,
        unique: true,
        comment: "唯一标识，如 super_admin / user",
      },
      isSystem: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: "系统内置角色不可删除",
      },
      isStaff: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: "是否可登录后台（pc-admin）",
      },
    },
    {
      indexes: [{ name: "roles_slug_uidx", unique: true, fields: ["slug"] }],
    },
  );
}
