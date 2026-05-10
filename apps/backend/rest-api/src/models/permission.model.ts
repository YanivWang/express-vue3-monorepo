import { DataTypes, type Sequelize } from "sequelize";

export function definePermissionModel(sequelize: Sequelize) {
  return sequelize.define(
    "Permission",
    {
      code: {
        type: DataTypes.STRING(128),
        allowNull: false,
        unique: true,
        comment: "权限码，如 admin.posts.read",
      },
      description: {
        type: DataTypes.STRING(255),
        allowNull: true,
        comment: "说明",
      },
    },
    {
      indexes: [{ name: "permissions_code_uidx", unique: true, fields: ["code"] }],
    },
  );
}
