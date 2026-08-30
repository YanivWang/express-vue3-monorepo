import { DataTypes, type Model, type Sequelize } from "sequelize";

/** Role — Permission 多对多中间表 */
export interface RolePermissionAttributes {
  roleId: number;
  permissionId: number;
}

export type RolePermissionModel = Model<RolePermissionAttributes, RolePermissionAttributes> &
  RolePermissionAttributes;

export function defineRolePermissionModel(sequelize: Sequelize) {
  return sequelize.define<RolePermissionModel, RolePermissionAttributes>(
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
