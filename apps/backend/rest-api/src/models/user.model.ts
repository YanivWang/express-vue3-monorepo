import { DataTypes, type Model, type Optional, type Sequelize } from "sequelize";

import type { DefinedColumns } from "./model-helpers.js";
import type { RoleModel } from "./role.model.js";
import type { UserProfileModel } from "./user-profile.model.js";

/** Users 表的完整列，与 migrations/0001-initial-schema 保持一致 */
export interface UserAttributes {
  id: number;
  username: string;
  password: string;
  avatar: string | null;
  roleId: number;
  createdAt: Date;
  updatedAt: Date;
}

/** 创建时可省略的列：自增主键、可空列与时间戳 */
export type UserCreationAttributes = Optional<
  UserAttributes,
  "id" | "avatar" | "createdAt" | "updatedAt"
>;

/**
 * `Model<A, C> & A` 让实例可以直接按属性访问列（`user.username`），
 * 取代此前遍布服务层的 `user.get("username") as string`——后者以字符串索引列名，
 * 改字段名时 tsc 完全沉默，等于在 strict 项目里挖了一个运行时才会爆的洞。
 *
 * 关联数据只在 include 了对应 as 时才存在，因此声明为可选，强制调用方处理缺省情况。
 */
export type UserModel = Model<UserAttributes, UserCreationAttributes> &
  UserAttributes & {
    role?: RoleModel;
    userProfile?: UserProfileModel;
  };

export function defineUserModel(sequelize: Sequelize) {
  return sequelize.define<UserModel, DefinedColumns<UserAttributes>>(
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
