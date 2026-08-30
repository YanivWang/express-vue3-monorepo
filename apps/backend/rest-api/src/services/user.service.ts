import { User, UserProfile } from "../db.js";

import type { UserModel } from "../models/index.js";

/** 对外展示：不含 password */
export type PublicUserProfile = {
  id: number;
  username: string;
  avatar: string | null;
  nickname: string | null;
};

function toPublicProfile(user: UserModel): Omit<PublicUserProfile, "nickname"> {
  return {
    id: user.id,
    username: user.username,
    avatar: user.avatar,
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
  // userProfile 仅在 include 命中时存在（required: false），故用可选链而非运行时形态嗅探
  const nickname = user.userProfile?.nickname ?? null;
  return { ...base, nickname };
}
