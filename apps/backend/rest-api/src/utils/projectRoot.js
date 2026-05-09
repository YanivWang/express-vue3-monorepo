import path from "node:path";
import { fileURLToPath } from "node:url";
import { findMonorepoRoot } from "./monorepoRoot.js";

/** `apps/backend/rest-api` 包根目录 */
const restApiPackageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

/** 与 monorepo 根一致：供 `uploads` 等落在仓库根目录 */
export const projectRoot = findMonorepoRoot(restApiPackageRoot);
