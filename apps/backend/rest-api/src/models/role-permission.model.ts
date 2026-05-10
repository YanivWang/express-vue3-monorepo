import { DataTypes, type Sequelize } from "sequelize";

/** Role — Permission 多对多中间表 */
export function defineRolePermissionModel(sequelize: Sequelize) {
  return sequelize.define(
    "RolePermission",
    {
      roleId: { type: DataTypes.INTEGER, allowNull: false, primaryKey: true },
      permissionId: { type: DataTypes.INTEGER, allowNull: false, primaryKey: true },
    },
    {
      tableName: "RolePermissions",
      timestamps: false,
    },
  );
}
