/**
 * test-env.ts —— `src/env.ts` 中 APP_ENV 解析逻辑的冒烟测试（非 Jest，独立脚本）。
 */
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const node = process.execPath;
const root = join(dirname(fileURLToPath(import.meta.url)), "..");

/** CI/本地均无 .env.* 时能跑通校验所需最小变量（宿主环境仍为最高优先级）。 */
function baseEnv(extra: Record<string, string>): NodeJS.ProcessEnv {
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

function importEnv(env: NodeJS.ProcessEnv) {
  return spawnSync(
    node,
    [
      "--import",
      "tsx",
      "--input-type=module",
      "-e",
      "import('./src/env.ts').then((m) => process.stdout.write(m.APP_ENV))",
    ],
    { cwd: root, env: env, encoding: "utf8" },
  );
}

function run(label: string, expectedAppEnv: string, envOverrides: NodeJS.ProcessEnv) {
  const r = importEnv(envOverrides);
  if (r.status !== 0) {
    console.error(`[test] ${label} exited ${r.status}\n${r.stderr || ""}${r.stdout || ""}`);
    process.exit(1);
  }
  const got = (typeof r.stdout === "string" ? r.stdout : "").trim();
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
    console.error(
      "[test] expected APP_ENV/NODE_ENV conflict to fail non-zero\n",
      r.stderr,
      r.stdout,
    );
    process.exit(1);
  }
  console.log("[test] APP_ENV vs NODE_ENV conflict rejected ok");
}
