/**
 * 根 package.json 的 `prepare` 钩子。
 *
 * 为什么不直接写 `"prepare": "husky"`：
 * husky 是 devDependency，而 `pnpm install --prod`（生产镜像的 prod-deps 阶段、任何仅装运行时依赖的
 * 场景）根本不会安装它。此时 npm 生命周期仍会执行 `prepare`，`husky: not found` 会让整条 install
 * 以非零退出码失败——docker/Dockerfile 的 prod-deps 阶段就是这样挂掉的。
 *
 * 因此这里把「是否安装 git hooks」变成一次显式判断：环境明确关闭、或 husky 压根不可用时安静跳过，
 * 其余情况才真正执行；husky 自身报错仍会如实向外抛出，不做吞异常处理。
 */
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

/** 显式关闭：Dockerfile 与 CI 均设置 HUSKY=0 */
if (process.env.HUSKY === "0") {
  console.log("[prepare] HUSKY=0，跳过 git hooks 安装");
  process.exit(0);
}

/** 仅装了生产依赖时 husky 不存在，跳过而不是让 install 失败 */
try {
  require.resolve("husky");
} catch {
  console.log("[prepare] 未安装 husky（生产依赖安装），跳过 git hooks 安装");
  process.exit(0);
}

const result = spawnSync("husky", [], { stdio: "inherit", shell: true });
process.exit(result.status ?? 0);
