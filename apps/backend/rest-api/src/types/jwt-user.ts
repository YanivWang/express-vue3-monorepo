import type { JwtPayload } from "jsonwebtoken";

export type AppJwtUser = JwtPayload & {
  id: number;
  username: string;

  jti?: string; // JWT 唯一标识，用于退出登录后的 Redis 黑名单
  exp?: number; // JWT 过期时间，单位 秒
  iat?: number; // JWT 签发时间，单位 秒

  /** 冗余字段；授权仍以库为准 */
  roleId?: number;
  roleSlug?: string;
};
