import path from "node:path";
import { fileURLToPath } from "node:url";

//生成项目根目录绝对路径
export const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
