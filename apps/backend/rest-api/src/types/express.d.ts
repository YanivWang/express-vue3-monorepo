import type { AppJwtUser } from "./jwt-user.js";

declare global {
  namespace Express {
    interface Request {
      requestId?: string;
      user?: AppJwtUser;
    }
  }
}

export {};
