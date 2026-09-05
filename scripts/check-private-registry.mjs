#!/usr/bin/env node
/**
 * 【文件职责】
 *   私有依赖白名单守卫：按包名判定哪些依赖来自私仓，与 package.json 的
 *   privateRegistry.allow 白名单逐字比对，多一个少一个都失败。
 *
 * 【架构位置】
 *   scripts — 由 package.json 的 check:registry 调用；接在 postinstall、
 *   quality 链与 CI 上，是「私有依赖不会悄悄变多」的唯一可执行判据。
 *
 * 【主要导出 / 路由】
 *   无（可执行脚本）；无参数，读 pnpm-lock.yaml 与 package.json，失败时列出差异并退出 1。
 *
 * ---
 *
 * 私有包只有本机 verdaccio 一个来源，没有公共上游可以兜底：多进来一个私有依赖，
 * 就多一处「换台机器/换个 CI runner 就装不上」的地方，而且不会在开发机上暴露——
 * 开发机永远装得上。所以私有依赖的清单必须是**显式声明**的，新增一个就要有人
 * 明确地把它写进白名单，而不是随手 `pnpm add` 就混进依赖树。
 *
 * ## 与 Yarn 版本（aippt-web 的同名脚本）的区别
 *
 * 那个版本靠扫 `yarn.lock` 里 `resolved` 字段中的私仓主机名来判定，因为 Yarn 1
 * 把绝对 URL 写死在 lockfile 里。**pnpm 不能这么判**：lockfile v9 只存 integrity
 * 哈希，一个 URL 都没有（实测 0 个），registry 是安装时由 `.npmrc` 决定的。
 *
 * 这对可移植性是好事（同一份 lockfile 可以指向任意可达的 registry），但也意味着
 * 「哪些包来自私仓」在 lockfile 里没有痕迹，只能按**包名**判定：
 *   - `@isheji/*`、`@yanivjs/*` —— 整个 scope 私有；
 *   - `@tiptap/core`、`@tiptap/vue-3` —— 公共名下的私有 fork，靠版本号里的
 *     `-isheji` 预发布标识识别（这两个名字在公共源上也有同名的正式版本）。
 */
import { readFileSync, existsSync } from "node:fs";

const PRIVATE_SCOPES = ["@isheji/", "@yanivjs/"];
// 公共包名下的私有 fork：按版本号里的预发布标识判定，而不是按包名。
const FORK_MARKER = "-isheji.";

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const allowlist = new Set(pkg.privateRegistry?.allow ?? []);

if (!existsSync("pnpm-lock.yaml")) {
  console.error("✗ 找不到 pnpm-lock.yaml，先跑 pnpm install");
  process.exit(1);
}
const lock = readFileSync("pnpm-lock.yaml", "utf8");

const found = new Map();
for (const line of lock.split("\n")) {
  const match = /^ {2}'?((?:@[\w.-]+\/)?[\w.-]+)@([^:'\s(]+)/.exec(line);
  if (!match) continue;
  const [, name, version] = match;
  const isPrivateScope = PRIVATE_SCOPES.some((scope) => name.startsWith(scope));
  const isFork = version.includes(FORK_MARKER);
  if (isPrivateScope || isFork) found.set(`${name}@${version}`, { name, version, isFork });
}

const actual = [...found.keys()].sort();
const unlisted = actual.filter((entry) => !allowlist.has(entry));
const stale = [...allowlist].filter((entry) => !found.has(entry)).sort();

if (unlisted.length > 0 || stale.length > 0) {
  console.error("✗ 私有依赖与白名单不符：\n");
  if (unlisted.length > 0) {
    console.error("  依赖树里有、白名单里没有（新增了私有依赖？）：");
    for (const entry of unlisted) console.error(`    + ${entry}`);
  }
  if (stale.length > 0) {
    console.error("  白名单里有、依赖树里没有（升级或移除后忘了同步？）：");
    for (const entry of stale) console.error(`    - ${entry}`);
  }
  console.error(
    "\n确认这些私有依赖确实需要之后，把上面 + 号那几行逐字写进 package.json 的\n" +
      "privateRegistry.allow，并删掉 - 号那几行。逐字，不要写范围——这份清单的\n" +
      "意义就是「每个私有依赖都被人看过一眼」。",
  );
  process.exit(1);
}

console.log(`✓ 私有依赖白名单一致（${actual.length} 个条目）`);
for (const entry of actual) {
  console.log(`    ${entry}${found.get(entry).isFork ? "  (公共名下的私有 fork)" : ""}`);
}
