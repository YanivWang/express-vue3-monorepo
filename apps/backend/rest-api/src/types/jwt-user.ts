import type { JwtPayload } from "jsonwebtoken";

export type AppJwtUser = JwtPayload & {
  id: number;
  username: string;
  role?: number;
};
