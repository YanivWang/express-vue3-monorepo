/**
 * 就绪探针在优雅退出期间的行为。
 *
 * 这条只能用真实 HTTP 栈验：要断言的是「编排层会看到什么」，
 * 而编排层看到的就是探针的真实状态码。纯函数单测证明不了路由挂载与顺序。
 *
 * 历史缺陷：`/ready` 只探 MySQL 与 Redis，完全不知道进程正在退出。
 * 收到 SIGTERM 后它继续答 200，于是负载均衡会一直把请求打到一个马上要关掉监听的实例上——
 * 滚动更新期间表现为零星 502，而进程日志一切正常（它确实优雅退出了，只是比 LB 反应快）。
 *
 * 单独成文件而不是并进别的用例：本用例会把进程标记成「正在退出」，
 * 那是个不可逆的全局状态，混在其他文件里会污染同一进程内的后续用例。
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  dropTestDatabase,
  prepareTestEnv,
  recreateTestDatabase,
  startTestApi,
  type TestApi,
} from "../test/integration-harness.js";

const DB_NAME = "evm_it_readiness";

let api: TestApi;
let lifecycle: typeof import("../lifecycle.js");

async function getReady() {
  const res = await fetch(`${api.baseUrl}/ready`);
  return { status: res.status, body: (await res.json()) as { status?: string } };
}

beforeAll(async () => {
  prepareTestEnv(DB_NAME);
  await recreateTestDatabase(DB_NAME);
  api = await startTestApi();
  lifecycle = await import("../lifecycle.js");
  lifecycle.resetLifecycleForTests();
});

afterAll(async () => {
  lifecycle.resetLifecycleForTests();
  await api.close();
  await dropTestDatabase(DB_NAME);
});

describe("就绪探针", () => {
  it("正常运行时报 ready", async () => {
    const res = await getReady();
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ready");
  });

  it("存活探针与就绪探针是两条不同的语义，前者不受退出影响", async () => {
    // 存活探针答的是「进程还活着吗」——退出期间它仍然活着，重启它没有意义。
    // 若这里也翻 503，编排层会把「正在优雅退出」误判成「进程坏了」而直接 kill。
    const before = await fetch(`${api.baseUrl}/health`);
    expect(before.status).toBe(200);

    lifecycle.markShuttingDown();

    const after = await fetch(`${api.baseUrl}/health`);
    expect(after.status).toBe(200);
  });

  it("进入优雅退出后立刻报 not_ready，让编排层停止分发流量", async () => {
    // 上一条用例已经标记过；这里断言的是标记生效后的探针输出
    const res = await getReady();
    expect(res.status).toBe(503);
    expect(res.body.status).toBe("shutting_down");
  });
});
