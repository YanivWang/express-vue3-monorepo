import { assertUserPermissions } from "../services/rbac.service.js";

import { createHttpError } from "./error.middleware.js";

import type { PermissionMode } from "../rbac/permission-codes.js";
import type { NextFunction, Request, Response } from "express";

/**
 * `requirePermission(['a','b'], 'all')`：须同时拥有 a 与 b（超级管理员通配）。
 * `requirePermission(['a','b'], 'any')`：满足其一即可。
 */
export function requirePermission(codes: readonly string[], mode: PermissionMode = "all") {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const uid = req.user?.id;
      if (typeof uid !== "number" || !Number.isFinite(uid)) {
        next(createHttpError(401, "未登录或登录已过期"));
        return;
      }
      if (codes.length === 0) {
        next();
        return;
      }
      await assertUserPermissions(uid, codes, mode);
      next();
    } catch (err) {
      next(err);
    }
  };
}
