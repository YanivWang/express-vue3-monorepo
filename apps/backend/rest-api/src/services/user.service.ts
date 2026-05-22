import bcrypt from "bcrypt";

import { User, UserProfile } from "../db.js";
import { createHttpError } from "../middlewares/error.middleware.js";
import { trimmedStringFromUnknown } from "../utils/trimmedStringFromUnknown.js";

import type { Model } from "sequelize";

/** 对外展示：不含 password */
export type PublicUserProfile = {
  id: number;
  username: string;
  avatar: string | null;
  nickname: string | null;
};

function toPublicProfile(user: Model): Omit<PublicUserProfile, "nickname"> {
  return {
    id: user.get("id") as number,
    username: user.get("username") as string,
    avatar: (user.get("avatar") as string | null | undefined) ?? null,
  };
}

/** 当前用户资料：无记录时返回 null（如 JWT 仍有效但库已重置/用户已删） */
export async function findPublicProfileById(id: number): Promise<PublicUserProfile | null> {
  const user = await User.findByPk(id, {
    include: [
      {
        model: UserProfile,
        as: "userProfile",
        attributes: ["nickname"],
        required: false,
      },
    ],
  });
  if (!user) return null;
  const base = toPublicProfile(user);
  const up = user.get("userProfile") as Model | null | undefined;
  let nickname: string | null = null;
  if (up && typeof up.get === "function") {
    nickname = (up.get("nickname") as string | null | undefined) ?? null;
  }
  return { ...base, nickname };
}

async function findUserOrThrow(id: number) {
  const user = await User.findByPk(id);

  if (!user) {
    throw createHttpError(404, "用户不存在");
  }

  return user;
}

export async function findUsersPage(page: number, limit: number) {
  const offset = (page - 1) * limit;
  const [users, total] = await Promise.all([
    User.findAll({
      limit,
      offset,
      order: [["id", "ASC"]],
    }),
    User.count(),
  ]);
  const totalPages = total === 0 ? 0 : Math.ceil(total / limit);
  return { users, total, totalPages };
}

export async function findUserById(id: number) {
  return findUserOrThrow(id);
}

export async function removeUser(id: number) {
  const user = await findUserOrThrow(id);
  await user.destroy();
}

export async function updateUserById(
  id: number,
  payload: { username?: unknown; password?: unknown },
) {
  const user = await findUserOrThrow(id);
  const username = trimmedStringFromUnknown(payload.username);
  const password = trimmedStringFromUnknown(payload.password);

  if (!username || !password) {
    throw createHttpError(400, "用户名或密码不能为空");
  }

  const hashPwd = await bcrypt.hash(password, 10);
  await user.update({ username, password: hashPwd });
}
