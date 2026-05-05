/**
 * test-env.mjs —— `src/env.js` 中 APP_ENV 解析逻辑的冒烟测试（非 Jest，独立 Node 脚本）。
 *
 * 目的：
 * - 在 CI 或本地**没有** `.env.development` / `.env.test` 等文件时，仍能验证环境推断与冲突校验是否正常。
 *
 * 做法：
 * - 用 `spawnSync` 子进程执行 `import('./src/env.js')`，为每次测试注入合成环境变量（`baseEnv` 提供 DB/JWT 等最小必填项，避免加载真实 .env 时缺变量）。
 * - 子进程向 stdout 打印解析得到的 `APP_ENV`，主进程比对期望值；退出码非 0 或输出不符即失败。
 *
 * 覆盖场景：
 * 1. 同时未设置 `APP_ENV` / `NODE_ENV` → 期望 `APP_ENV === "development"`。
 * 2. 仅 `NODE_ENV=test`（且无 `APP_ENV`）→ 期望 `APP_ENV === "test"`（与 env 模块规则一致）。
 * 3. `NODE_ENV=production` 且 `APP_ENV=test` → 期望进程失败（两者冲突，env 应 `process.exit` 或非零）。
 *
 * 运行：在项目根目录执行 `node scripts/test-env.mjs`（或通过 Docker/CI 在镜像工作目录下执行）。
 */
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const node = process.execPath;
const root = join(dirname(fileURLToPath(import.meta.url)), "..");

/** CI/本地均无 .env.* 时能跑通校验所需最小变量（宿主环境仍为最高优先级）。 */
function baseEnv(extra) {
  return {
    ...process.env,
    JWT_SECRET: "a".repeat(40),
    DB_HOST: "127.0.0.1",
    DB_PORT: "3306",
    DB_NAME: "_test_dummy",
    DB_USER: "_test",
    DB_PWD: "_test",
    ...extra,
  };
}

function importEnv(env) {
  return spawnSync(
    node,
    [
      "--input-type=module",
      "-e",
      "import('./src/env.js').then((m) => process.stdout.write(m.APP_ENV))",
    ],
    { cwd: root, env, encoding: "utf8" },
  );
}

function run(label, expectedAppEnv, envOverrides) {
  const r = importEnv(envOverrides);
  if (r.status !== 0) {
    console.error(`[test] ${label} exited ${r.status}\n${r.stderr || ""}${r.stdout || ""}`);
    process.exit(1);
  }
  const got = String(r.stdout).trim();
  if (got !== expectedAppEnv) {
    console.error(`[test] ${label}: expected APP_ENV="${expectedAppEnv}", got "${got}"`);
    process.exit(1);
  }
  console.log(`[test] ${label} ok`);
}

{
  const env = baseEnv({});
  delete env.APP_ENV;
  delete env.NODE_ENV;
  run("default (no APP_ENV/NODE_ENV)", "development", env);
}

{
  const env = baseEnv({ NODE_ENV: "test" });
  delete env.APP_ENV;
  run("NODE_ENV=test", "test", env);
}

{
  const env = baseEnv({
    NODE_ENV: "production",
    APP_ENV: "test",
  });
  const r = importEnv(env);
  if (r.status === 0) {
    console.error("[test] expected APP_ENV/NODE_ENV conflict to fail non-zero\n", r.stderr, r.stdout);
    process.exit(1);
  }
  console.log("[test] APP_ENV vs NODE_ENV conflict rejected ok");
}
