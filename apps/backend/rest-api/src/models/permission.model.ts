import { DataTypes, type Model, type Optional, type Sequelize } from "sequelize";

import type { DefinedColumns } from "./model-helpers.js";

/** Permissions 表的完整列，与 migrations/0001-initial-schema 保持一致 */
export interface PermissionAttributes {
  id: number;
  code: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export type PermissionCreationAttributes = Optional<
  PermissionAttributes,
  "id" | "description" | "createdAt" | "updatedAt"
>;

export type PermissionModel = Model<PermissionAttributes, PermissionCreationAttributes> &
  PermissionAttributes;

export function definePermissionModel(sequelize: Sequelize) {
  return sequelize.define<PermissionModel, DefinedColumns<PermissionAttributes>>(
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
    {},
  );
}
