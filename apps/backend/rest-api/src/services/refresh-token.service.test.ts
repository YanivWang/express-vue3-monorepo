/**
 * 刷新令牌轮换的行为基线。
 *
 * 用内存假 Redis 而不是真实 Redis：这里要证明的是**状态机**——什么情况下轮换、
 * 什么情况下判定重放、什么情况下必须一动不动。这些分支与 Redis 的具体实现无关，
 * 放在单测里才能进 `pnpm verify`，每次提交都跑得到（真实 Redis 的那份在
 * refresh-token.integration.test.ts，由 CI 的集成作业覆盖）。
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

// vi.mock 的工厂会被提升到文件顶部，因此它引用的东西必须由 vi.hoisted 一起提升
const { GRACE_SECONDS, strings, sets } = vi.hoisted(() => ({
  GRACE_SECONDS: 30,
  /** 只实现 service 真正用到的那几个命令；TTL 不参与断言，故忽略过期语义 */
  strings: new Map<string, string>(),
  sets: new Map<string, Set<string>>(),
}));

vi.mock("../env.js", () => ({
  REFRESH_TOKEN_TTL_SECONDS: 7 * 24 * 60 * 60,
  REFRESH_ROTATION_GRACE_SECONDS: GRACE_SECONDS,
}));

vi.mock("../utils/logger.js", () => ({
  logger: { warn: vi.fn(), debug: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

vi.mock("../redis.js", () => ({
  redis: {
    set: (key: string, value: string) => {
      strings.set(key, value);
      return Promise.resolve("OK");
    },
    get: (key: string) => Promise.resolve(strings.get(key) ?? null),
    del: (key: string | string[]) => {
      const keys = Array.isArray(key) ? key : [key];
      let removed = 0;
      for (const k of keys) {
        if (strings.delete(k)) removed += 1;
        if (sets.delete(k)) removed += 1;
      }
      return Promise.resolve(removed);
    },
    exists: (key: string) => Promise.resolve(strings.has(key) || sets.has(key) ? 1 : 0),
    sAdd: (key: string, member: string) => {
      const set = sets.get(key) ?? new Set<string>();
      set.add(member);
      sets.set(key, set);
      return Promise.resolve(1);
    },
    sRem: (key: string, member: string) => {
      sets.get(key)?.delete(member);
      return Promise.resolve(1);
    },
    sMembers: (key: string) => Promise.resolve([...(sets.get(key) ?? [])]),
    expire: () => Promise.resolve(1),
  },
}));

import { logger } from "../utils/logger.js";

import {
  issueRefreshToken,
  revokeRefreshTokenByRaw,
  rotateRefreshToken,
} from "./refresh-token.service.js";

const USER_ID = 42;

/** 把明文令牌的 secret 换掉，模拟「只知道 tokenId、不知道 secret」的一方 */
function withWrongSecret(token: string): string {
  const [tokenId] = token.split(".");
  return `${tokenId}.0000000000000000000000000000000000000000000000000000000000000000`;
}

beforeEach(() => {
  strings.clear();
  sets.clear();
  vi.mocked(logger.warn).mockClear();
  vi.useRealTimers();
});

describe("正常轮换", () => {
  it("旧令牌换出新令牌，且旧令牌不再是有效记录", async () => {
    const issued = await issueRefreshToken(USER_ID);

    const outcome = await rotateRefreshToken(issued.token);

    expect(outcome.status).toBe("rotated");
    if (outcome.status !== "rotated") return;
    expect(outcome.userId).toBe(USER_ID);
    expect(outcome.next.token).not.toBe(issued.token);

    // 新令牌可以继续轮换，证明它确实生效
    const again = await rotateRefreshToken(outcome.next.token);
    expect(again.status).toBe("rotated");
  });

  it("结构非法的令牌一律 invalid，不产生任何副作用", async () => {
    for (const bad of ["", ".", "no-dot", "abc.", ".secret"]) {
      expect((await rotateRefreshToken(bad)).status).toBe("invalid");
    }
    expect(strings.size).toBe(0);
  });
});

describe("并发刷新（多标签页 / 门户与管理端共用同一枚 Cookie）", () => {
  it("宽限窗口内重复提交同一枚令牌，双方都拿到可用令牌，会话不被踢掉", async () => {
    const issued = await issueRefreshToken(USER_ID);

    const first = await rotateRefreshToken(issued.token);
    // 第二个标签页几乎同时到达，手里还是同一枚旧令牌
    const second = await rotateRefreshToken(issued.token);

    expect(first.status).toBe("rotated");
    expect(second.status).toBe("rotated");
    if (first.status !== "rotated" || second.status !== "rotated") return;

    // 两枚都能继续用，用户不会因为多开一个标签页就被要求重新登录
    expect((await rotateRefreshToken(first.next.token)).status).toBe("rotated");
    expect((await rotateRefreshToken(second.next.token)).status).toBe("rotated");
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it("并发是同一个家族，不会派生出互相独立的会话", async () => {
    const issued = await issueRefreshToken(USER_ID);
    const first = await rotateRefreshToken(issued.token);
    const second = await rotateRefreshToken(issued.token);
    if (first.status !== "rotated" || second.status !== "rotated") return;

    // 从任意一枚登出，另一枚也应随家族一起失效
    await revokeRefreshTokenByRaw(first.next.token);
    expect((await rotateRefreshToken(second.next.token)).status).toBe("invalid");
  });
});

describe("重放检测", () => {
  it("宽限窗口之外的重放会撤销整个家族", async () => {
    const issued = await issueRefreshToken(USER_ID);
    const rotated = await rotateRefreshToken(issued.token);
    if (rotated.status !== "rotated") throw new Error("首次轮换应当成功");

    // 时间走过宽限窗口：此时再出现的旧令牌只可能是被复制走的
    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + (GRACE_SECONDS + 1) * 1000);

    const replayed = await rotateRefreshToken(issued.token);
    expect(replayed.status).toBe("reused");
    expect(logger.warn).toHaveBeenCalled();

    // 真实用户手里那枚「合法的」令牌也必须一并失效，否则攻击者与用户会并行持有会话
    expect((await rotateRefreshToken(rotated.next.token)).status).toBe("invalid");
  });

  it("已被撤销的家族不会因为落在宽限窗口内而复活", async () => {
    const issued = await issueRefreshToken(USER_ID);
    const rotated = await rotateRefreshToken(issued.token);
    if (rotated.status !== "rotated") throw new Error("首次轮换应当成功");

    await revokeRefreshTokenByRaw(rotated.next.token); // 用户主动登出

    // 登出后立刻拿旧令牌来换（仍在宽限窗口内）——必须换不到
    expect((await rotateRefreshToken(issued.token)).status).toBe("reused");
  });
});

describe("只知道 tokenId 的一方什么也做不了", () => {
  it("secret 不正确时无法轮换，也不会让原令牌失效", async () => {
    const issued = await issueRefreshToken(USER_ID);

    expect((await rotateRefreshToken(withWrongSecret(issued.token))).status).toBe("invalid");

    // 原令牌毫发无损
    expect((await rotateRefreshToken(issued.token)).status).toBe("rotated");
  });

  it("secret 不正确时无法凭墓碑撤销他人的令牌家族", async () => {
    const issued = await issueRefreshToken(USER_ID);
    const rotated = await rotateRefreshToken(issued.token);
    if (rotated.status !== "rotated") throw new Error("首次轮换应当成功");

    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + (GRACE_SECONDS + 1) * 1000);

    // 拿着旧 tokenId + 瞎编的 secret 来「触发重放检测」，企图把别人踢下线
    expect((await rotateRefreshToken(withWrongSecret(issued.token))).status).toBe("invalid");
    expect(logger.warn).not.toHaveBeenCalled();

    // 用户的会话仍然完好
    expect((await rotateRefreshToken(rotated.next.token)).status).toBe("rotated");
  });

  it("secret 不正确时登出不生效", async () => {
    const issued = await issueRefreshToken(USER_ID);

    await revokeRefreshTokenByRaw(withWrongSecret(issued.token));

    expect((await rotateRefreshToken(issued.token)).status).toBe("rotated");
  });
});

describe("登出", () => {
  it("撤销整个家族，家族内其他令牌一并失效", async () => {
    const issued = await issueRefreshToken(USER_ID);
    const rotated = await rotateRefreshToken(issued.token);
    if (rotated.status !== "rotated") throw new Error("首次轮换应当成功");

    await revokeRefreshTokenByRaw(rotated.next.token);

    expect((await rotateRefreshToken(rotated.next.token)).status).toBe("invalid");
  });

  it("接受落后一代的令牌：另一个标签页刚刷新过时，登出仍须真正撤销会话", async () => {
    const issued = await issueRefreshToken(USER_ID);
    const rotated = await rotateRefreshToken(issued.token);
    if (rotated.status !== "rotated") throw new Error("首次轮换应当成功");

    // 客户端 Cookie 还停留在上一代（issued），此时点了登出
    await revokeRefreshTokenByRaw(issued.token);

    // 新一代令牌也必须失效，否则会留下一个「已登出但仍能续期」的会话
    expect((await rotateRefreshToken(rotated.next.token)).status).toBe("invalid");
  });
});
