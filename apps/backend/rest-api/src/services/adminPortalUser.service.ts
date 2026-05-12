import { Op } from "sequelize";

import { Role, User, UserProfile } from "../db.js";
import { createHttpError } from "../middlewares/error.middleware.js";
import { ROLE_SLUG_USER } from "../rbac/permission-codes.js";
import { escapeMysqlLikePattern } from "../utils/escapeMysqlLike.js";
import { trimmedStringFromUnknown } from "../utils/trimmedStringFromUnknown.js";

const roleBrief = ["id", "slug", "name", "isStaff"] as const;

async function loadPortalTargetOrThrow(userId: number) {
  const row = await User.findByPk(userId, {
    include: [{ model: Role, as: "role", attributes: [...roleBrief] }],
  });
  if (!row) {
    throw createHttpError(404, "用户不存在");
  }
  const slug = (row.get("role") as { get: (k: string) => unknown } | null)?.get("slug");
  if (String(slug) !== ROLE_SLUG_USER) {
    throw createHttpError(400, "仅可维护前台注册用户（普通客户角色）");
  }
  return row;
}

export async function findPortalUsersPage(page: number, limit: number, q?: string | null) {
  const offset = (page - 1) * limit;
  const where: Record<string, unknown> = {};
  const kw = q?.trim();
  if (kw) {
    const pattern = `%${escapeMysqlLikePattern(kw)}%`;
    where.username = { [Op.like]: pattern };
  }

  const [rows, total] = await Promise.all([
    User.findAll({
      where,
      limit,
      offset,
      order: [["id", "DESC"]],
      include: [
        {
          model: Role,
          as: "role",
          where: { slug: ROLE_SLUG_USER },
          required: true,
          attributes: [...roleBrief],
        },
      ],
      attributes: { exclude: ["password"] },
    }),
    User.count({
      where,
      include: [
        {
          model: Role,
          as: "role",
          where: { slug: ROLE_SLUG_USER },
          required: true,
        },
      ],
    }),
  ]);
  const totalPages = total === 0 ? 0 : Math.ceil(total / limit);
  return { users: rows, total, totalPages };
}

export async function updatePortalUserById(
  id: number,
  payload: { username?: unknown; avatar?: unknown },
) {
  const row = await loadPortalTargetOrThrow(id);
  const next: Record<string, unknown> = {};
  if (payload.username !== undefined) {
    const u = trimmedStringFromUnknown(payload.username);
    if (!u) {
      throw createHttpError(400, "用户名不能为空");
    }
    next.username = u;
  }
  if (payload.avatar !== undefined) {
    next.avatar = trimmedStringFromUnknown(payload.avatar) || null;
  }
  if (Object.keys(next).length === 0) {
    throw createHttpError(400, "没有要更新的字段");
  }
  await row.update(next);
  if (payload.avatar !== undefined) {
    await UserProfile.update({ avatar: next.avatar as string | null }, { where: { userId: id } });
  }
  return User.findByPk(id, {
    attributes: { exclude: ["password"] },
    include: [{ model: Role, as: "role", attributes: [...roleBrief] }],
  });
}

export async function removePortalUserById(id: number) {
  await loadPortalTargetOrThrow(id);
  try {
    await User.destroy({ where: { id } });
  } catch {
    throw createHttpError(400, "该用户仍有关联文章或评论等数据，无法删除");
  }
}
