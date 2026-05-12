import type { JwtPayload } from "jsonwebtoken";

export type AppJwtUser = JwtPayload & {
  id: number;
  username: string;
  /** 冗余字段；授权仍以库为准 */
  roleId?: number;
  roleSlug?: string;
};
