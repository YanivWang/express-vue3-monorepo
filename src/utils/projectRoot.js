import path from "node:path";
import { fileURLToPath } from "node:url";

console.log("import.meta.url=>", import.meta.url); //是当前模块的url，一般是 file:// 是文件url
// file:///Users/wangcheng/Documents/workSpace/backEnd/nodeJsProjectSpace/expressProject/express-demo-02/src/utils/projectRoot.js

console.log("fileURLToPath=>", fileURLToPath(import.meta.url)); //用于把文件URL转成操作系统上的文件路径字符串，这样后续的 path 才能按操作系统本地路径正确处理
// /Users/wangcheng/Documents/workSpace/backEnd/nodeJsProjectSpace/expressProject/express-demo-02/src/utils/projectRoot.js

console.log("path.dirname=>", path.dirname(fileURLToPath(import.meta.url))); //取 目录名，去掉文件名
// /Users/wangcheng/Documents/workSpace/backEnd/nodeJsProjectSpace/expressProject/express-demo-02/src/utils

//生成项目根目录绝对路径
export const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
console.log("projectRoot=>", projectRoot);
// Users/wangcheng/Documents/workSpace/backEnd/nodeJsProjectSpace/expressProject/express-demo-02

//es模块中不能用 __dirname
