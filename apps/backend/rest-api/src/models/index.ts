import { defineCategoryModel } from "./category.model.js";
import { defineCommentModel } from "./comment.model.js";
import { definePermissionModel } from "./permission.model.js";
import { definePostFavoriteModel } from "./post-favorite.model.js";
import { definePostVoteModel } from "./post-vote.model.js";
import { definePostModel } from "./post.model.js";
import { defineRolePermissionModel } from "./role-permission.model.js";
import { defineRoleModel } from "./role.model.js";
import { defineUserProfileModel } from "./user-profile.model.js";
import { defineUserModel } from "./user.model.js";

import type { Sequelize } from "sequelize";

export function initModels(sequelize: Sequelize) {
  const Permission = definePermissionModel(sequelize);
  const Role = defineRoleModel(sequelize);
  const RolePermission = defineRolePermissionModel(sequelize);
  const User = defineUserModel(sequelize);
  const UserProfile = defineUserProfileModel(sequelize, User);
  const Category = defineCategoryModel(sequelize);
  const Post = definePostModel(sequelize, User, Category);
  const PostVote = definePostVoteModel(sequelize, User, Post);
  const PostFavorite = definePostFavoriteModel(sequelize, User, Post);
  const Comment = defineCommentModel(sequelize, User, Post);

  Role.belongsToMany(Permission, {
    through: RolePermission,
    foreignKey: "roleId",
    otherKey: "permissionId",
    as: "permissions",
  });
  Permission.belongsToMany(Role, {
    through: RolePermission,
    foreignKey: "permissionId",
    otherKey: "roleId",
    as: "roles",
  });

  User.belongsTo(Role, { foreignKey: "roleId", as: "role" });
  Role.hasMany(User, { foreignKey: "roleId", as: "users" });

  return {
    Permission,
    Role,
    RolePermission,
    User,
    UserProfile,
    Category,
    Post,
    PostVote,
    PostFavorite,
    Comment,
  };
}

export type { CategoryAttributes, CategoryModel } from "./category.model.js";
export type { CommentAttributes, CommentModel } from "./comment.model.js";
export type { PermissionAttributes, PermissionModel } from "./permission.model.js";
export type { PostFavoriteAttributes, PostFavoriteModel } from "./post-favorite.model.js";
export type { PostVoteAttributes, PostVoteModel } from "./post-vote.model.js";
export type { PostAttributes, PostModel } from "./post.model.js";
export type { RolePermissionAttributes, RolePermissionModel } from "./role-permission.model.js";
export type { RoleAttributes, RoleModel } from "./role.model.js";
export type { UserProfileAttributes, UserProfileModel } from "./user-profile.model.js";
export type { UserAttributes, UserModel } from "./user.model.js";
