import { DataTypes, type Model, type Optional, type Sequelize } from "sequelize";

import type { DefinedColumns } from "./model-helpers.js";
import type { PermissionModel } from "./permission.model.js";

/** Roles 表的完整列，与 migrations/0001-initial-schema 保持一致 */
export interface RoleAttributes {
  id: number;
  name: string;
  slug: string;
  isSystem: boolean;
  isStaff: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type RoleCreationAttributes = Optional<
  RoleAttributes,
  "id" | "isSystem" | "isStaff" | "createdAt" | "updatedAt"
>;

export type RoleModel = Model<RoleAttributes, RoleCreationAttributes> &
  RoleAttributes & {
    /** 仅在 include: { as: "permissions" } 时存在 */
    permissions?: PermissionModel[];
    /** belongsToMany 生成的关联方法未进入 Model 类型，在此显式声明 */
    setPermissions(permissions: PermissionModel[]): Promise<void>;
    getPermissions(): Promise<PermissionModel[]>;
  };

export function defineRoleModel(sequelize: Sequelize) {
  return sequelize.define<RoleModel, DefinedColumns<RoleAttributes>>(
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
