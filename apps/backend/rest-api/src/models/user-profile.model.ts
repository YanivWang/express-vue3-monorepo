import { DataTypes, type Model, type ModelStatic, type Optional, type Sequelize } from "sequelize";

import type { DefinedColumns } from "./model-helpers.js";
import type { UserModel } from "./user.model.js";

/** UserProfiles 表的完整列，与 migrations/0001-initial-schema 保持一致 */
export interface UserProfileAttributes {
  id: number;
  userId: number;
  nickname: string | null;
  avatar: string | null;
  /** male / female / unknown */
  gender: string | null;
  /** DATEONLY 经 Sequelize 读出为 "YYYY-MM-DD" 字符串 */
  birthday: string | null;
  bio: string | null;
  address: string | null;
  company: string | null;
  jobTitle: string | null;
  isMarried: boolean | null;
  mom: string | null;
  father: string | null;
  university: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export type UserProfileCreationAttributes = Optional<
  UserProfileAttributes,
  | "id"
  | "nickname"
  | "avatar"
  | "gender"
  | "birthday"
  | "bio"
  | "address"
  | "company"
  | "jobTitle"
  | "isMarried"
  | "mom"
  | "father"
  | "university"
  | "createdAt"
  | "updatedAt"
>;

export type UserProfileModel = Model<UserProfileAttributes, UserProfileCreationAttributes> &
  UserProfileAttributes & {
    user?: UserModel;
  };

export function defineUserProfileModel(sequelize: Sequelize, User: ModelStatic<UserModel>) {
  const UserProfile = sequelize.define<UserProfileModel, DefinedColumns<UserProfileAttributes>>(
    "UserProfile",
    {
      userId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        comment: "Users.id，一对一",
      },
      nickname: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      avatar: {
        type: DataTypes.STRING(500),
        allowNull: true,
        comment: "与 Users.avatar 双写；展示以 Users 为准",
      },
      gender: {
        type: DataTypes.STRING(20),
        allowNull: true,
        comment: "male / female / unknown",
      },
      birthday: {
        type: DataTypes.DATEONLY,
        allowNull: true,
      },
      bio: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      address: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      company: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      jobTitle: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      isMarried: {
        type: DataTypes.BOOLEAN,
        allowNull: true,
      },
      mom: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      father: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      university: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
    },
    {
      tableName: "UserProfiles",
      indexes: [{ unique: true, name: "user_profiles_user_id_unique", fields: ["userId"] }],
    },
  );

  UserProfile.belongsTo(User, { foreignKey: "userId", onDelete: "CASCADE", as: "user" });
  User.hasOne(UserProfile, { foreignKey: "userId", as: "userProfile" });

  return UserProfile;
}
