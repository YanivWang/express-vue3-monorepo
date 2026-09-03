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
const { GRACE_SECONDS, ABSOLUTE_TTL_SECONDS, strings, expiries, sets, hooks } = vi.hoisted(() => ({
  GRACE_SECONDS: 30,
  /** 绝对会话寿命：压到 1 小时，用例不必真的等 30 天 */
  ABSOLUTE_TTL_SECONDS: 60 * 60,
  /** 只实现 service 真正用到的那几个命令；TTL 不参与断言，故忽略过期语义 */
  strings: new Map<string, string>(),
  /**
   * 键的过期时刻（epoch 毫秒）。
   *
   * 早期这个假替身直接忽略 TTL，理由是「TTL 不参与断言」。轮换改用「继任者信箱」之后
   * 这条不再成立：宽限窗口现在**就是**信箱键的 TTL，忽略过期等于让窗口永不关闭，
   * 于是「窗口外的重放要撤销家族」这条最要紧的断言会永远拿到 rotated 而假绿。
   */
  expiries: new Map<string, number>(),
  sets: new Map<string, Set<string>>(),
  /** 用来在指定命令之间插入并发操作，从而确定性地复现交错，而不是靠碰运气 */
  hooks: { beforeSAdd: null as null | (() => Promise<void>) },
}));

/** 懒惰过期：读到已过期的键就当它不存在（真实 Redis 的可观察行为） */
function expired(key: string): boolean {
  const at = expiries.get(key);
  return at !== undefined && Date.now() > at;
}

vi.mock("../env.js", () => ({
  REFRESH_TOKEN_TTL_SECONDS: 7 * 24 * 60 * 60,
  REFRESH_ROTATION_GRACE_SECONDS: GRACE_SECONDS,
  REFRESH_SESSION_ABSOLUTE_TTL_SECONDS: ABSOLUTE_TTL_SECONDS,
}));

vi.mock("../utils/logger.js", () => ({
  logger: { warn: vi.fn(), debug: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

vi.mock("../redis.js", () => ({
  redis: {
    // NX 必须实现：轮换的单赢家选举全靠它，忽略它会让并发用例假绿
    set: (key: string, value: string, options?: { NX?: boolean; EX?: number }) => {
      if (options?.NX && !expired(key) && strings.has(key)) return Promise.resolve(null);
      strings.set(key, value);
      if (options?.EX === undefined) expiries.delete(key);
      else expiries.set(key, Date.now() + options.EX * 1000);
      return Promise.resolve("OK");
    },
    get: (key: string) => Promise.resolve(expired(key) ? null : (strings.get(key) ?? null)),
    del: (key: string | string[]) => {
      const keys = Array.isArray(key) ? key : [key];
      let removed = 0;
      for (const k of keys) {
        if (strings.delete(k)) removed += 1;
        expiries.delete(k);
        if (sets.delete(k)) removed += 1;
      }
      return Promise.resolve(removed);
    },
    exists: (key: string) =>
      Promise.resolve((!expired(key) && strings.has(key)) || sets.has(key) ? 1 : 0),
    sAdd: async (key: string, member: string) => {
      const hook = hooks.beforeSAdd;
      if (hook) {
        hooks.beforeSAdd = null;
        await hook();
      }
      const set = sets.get(key) ?? new Set<string>();
      set.add(member);
      sets.set(key, set);
      return 1;
    },
    sRem: (key: string, member: string) => {
      const set = sets.get(key);
      set?.delete(member);
      // 真实 Redis 里集合空了键就没了；假替身必须照做，否则 exists 会谎报家族仍在
      if (set && set.size === 0) sets.delete(key);
      return Promise.resolve(1);
    },
    sMembers: (key: string) => Promise.resolve([...(sets.get(key) ?? [])]),
    expire: () => Promise.resolve(1),
  },
}));

import { logger } from "../utils/logger.js";

import {
  issueRefreshToken,
  revokeAllSessionsForUser,
  revokeRefreshTokenByRaw,
  rotateRefreshToken,
} from "./refresh-token.service.js";

const USER_ID = 42;

/** 把明文令牌的 secret 换掉，模拟「只知道 tokenId、不知道 secret」的一方 */
function withWrongSecret(token: string): string {
  const [tokenId] = token.split(".");
  return `${tokenId}.0000000000000000000000000000000000000000000000000000000000000000`;
}

/** 当前存活的家族数量（= 有效会话数） */
function familyCount(): number {
  return [...sets.keys()].filter((k) => k.startsWith("auth:refresh:family:")).length;
}

/**
 * 当前仍活着的家族成员。
 * 「一个家族同一时刻只有一枚活令牌」是轮换的核心不变式，分叉与否只能靠它证明。
 */
function liveFamilyMembers(): string[] {
  return [...sets.entries()]
    .filter(([key]) => key.startsWith("auth:refresh:family:"))
    .flatMap(([, members]) => [...members]);
}

beforeEach(() => {
  strings.clear();
  expiries.clear();
  sets.clear();
  hooks.beforeSAdd = null;
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

  /**
   * 单赢家选举。
   *
   * 早期实现的轮换是「写墓碑 → 删记录 → 签发」三条互不互斥的命令，
   * 两个并发请求会双双签发，同一枚令牌当场分叉成两条各自有效的令牌链，
   * 「一个家族同一时刻只有一枚活令牌」的不变式就此失守。
   * 这些请求本来就来自同一个浏览器、想要的是同一枚新 Cookie，所以正确结果是**同一枚**。
   */
  it("同一枚令牌被并发轮换时，各方拿到的是同一枚继任令牌，而不是各自一枚", async () => {
    const issued = await issueRefreshToken(USER_ID);

    const [a, b, c] = await Promise.all([
      rotateRefreshToken(issued.token),
      rotateRefreshToken(issued.token),
      rotateRefreshToken(issued.token),
    ]);

    for (const outcome of [a, b, c]) expect(outcome.status).toBe("rotated");
    if (a.status !== "rotated" || b.status !== "rotated" || c.status !== "rotated") return;

    expect(b.next.token).toBe(a.next.token);
    expect(c.next.token).toBe(a.next.token);
    // 分叉的直接证据：家族里活着的令牌只应有一枚
    expect(liveFamilyMembers()).toHaveLength(1);
  });

  /**
   * 宽限窗口必须是幂等重放，不能是铸币机。
   *
   * 早期实现每次重放都补发一枚新的：一枚已用令牌在窗口内重放 N 次就能铸出
   * N 条同时有效、彼此独立的令牌链。攻击者拿到被盗令牌后只要在窗口内刷一次，
   * 就能开出一条与受害者并行、且此后再也不会触发重放检测的会话。
   */
  it("宽限窗口内反复重放同一枚令牌，只会拿回同一枚，不会铸出新链", async () => {
    const issued = await issueRefreshToken(USER_ID);
    const first = await rotateRefreshToken(issued.token);
    if (first.status !== "rotated") throw new Error("首次轮换应当成功");

    for (let i = 0; i < 5; i++) {
      const replay = await rotateRefreshToken(issued.token);
      expect(replay.status).toBe("rotated");
      if (replay.status !== "rotated") return;
      expect(replay.next.token).toBe(first.next.token);
    }

    expect(liveFamilyMembers()).toHaveLength(1);
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

  /**
   * 登出之后的「落后一代的客户端」不是攻击，不该产出安全告警。
   *
   * `refresh_token_reuse_detected` 是这套机制里唯一的安全告警，价值建立在
   * 「响一次就值得看一次」之上。另一个标签页登出、这个标签页拿旧 Cookie 来刷一次——
   * 这是再正常不过的操作序列，如果它稳定地产出 warn，这条告警就被训练成了噪声。
   */
  it("已被撤销的家族不会因为落在宽限窗口内而复活，但也不该被误报成重放", async () => {
    const issued = await issueRefreshToken(USER_ID);
    const rotated = await rotateRefreshToken(issued.token);
    if (rotated.status !== "rotated") throw new Error("首次轮换应当成功");

    await revokeRefreshTokenByRaw(rotated.next.token); // 用户主动登出

    // 登出后立刻拿旧令牌来换（仍在宽限窗口内）——必须换不到
    const outcome = await rotateRefreshToken(issued.token);
    expect(outcome.status).toBe("invalid");
    // 会话已经结束，没有任何可做的处置，因此不该喊「检测到重放」
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it("真正的重放（家族仍然存活）照旧告警并撤销家族", async () => {
    const issued = await issueRefreshToken(USER_ID);
    const rotated = await rotateRefreshToken(issued.token);
    if (rotated.status !== "rotated") throw new Error("首次轮换应当成功");

    // 走出宽限窗口，家族并未被撤销：此时旧令牌再出现只能是被复制走了
    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + (GRACE_SECONDS + 1) * 1000);

    expect((await rotateRefreshToken(issued.token)).status).toBe("reused");
    expect(logger.warn).toHaveBeenCalled();
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

describe("登出与刷新并发", () => {
  /** 活令牌记录的条数——登出之后必须归零，否则就是「登出了，但会话还能续期」 */
  function liveTokenKeys(): string[] {
    return [...strings.keys()].filter((k) => k.startsWith("auth:refresh:token:"));
  }
  function familyKeys(): string[] {
    return [...sets.keys()].filter((k) => k.startsWith("auth:refresh:family:"));
  }
  /** 继任者信箱：宽限窗口内可被原样取回的那一枚 */
  function successorKeys(): string[] {
    return [...strings.keys()].filter((k) => k.startsWith("auth:refresh:successor:"));
  }

  it("登出恰好发生在刷新写入之后时，在途刷新不会把已撤销的家族种回来", async () => {
    const issued = await issueRefreshToken(USER_ID);

    // 在刷新把新令牌登记进家族的那一刻插入一次登出，精确复现最要命的那种交错
    hooks.beforeSAdd = async () => {
      await revokeRefreshTokenByRaw(issued.token);
    };

    const outcome = await rotateRefreshToken(issued.token);

    // 会话已经结束，刷新就该失败——而不是发出一枚「登出后仍然有效」的令牌
    expect(outcome.status).toBe("invalid");
    expect(liveTokenKeys()).toHaveLength(0);
    expect(familyKeys()).toHaveLength(0);
  });

  /**
   * 宽限窗口内的返还同样受撤销约束。
   *
   * 这一条以前是靠 `beforeSAdd` 钩子复现的——那时宽限路径会**再补发一枚**新令牌，
   * 于是能在它写入家族的瞬间插一次登出。现在宽限路径不再签发任何东西，
   * 而是把当初那一枚从信箱里原样取回，所以要守的不变式变成了：
   * 家族一旦被撤销，信箱里那枚已经躺好的继任令牌就不能再交付出去。
   */
  it("家族已撤销时，信箱里的继任令牌不再交付", async () => {
    const issued = await issueRefreshToken(USER_ID);
    const first = await rotateRefreshToken(issued.token);
    if (first.status !== "rotated") throw new Error("首次轮换应当成功");

    // 此刻信箱里确实躺着一枚可交付的继任令牌
    expect(successorKeys()).toHaveLength(1);

    await revokeRefreshTokenByRaw(first.next.token); // 用户点了登出

    // 另一个标签页拿着旧令牌在宽限窗口内赶来：信箱还在，但会话已经结束
    const concurrent = await rotateRefreshToken(issued.token);
    expect(concurrent.status).not.toBe("rotated");
    expect(liveTokenKeys()).toHaveLength(0);
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

/**
 * 「踢掉某个用户的全部会话」。
 *
 * 缺了它，改密码只挡住「用旧密码再登录」，挡不住「已经登着的那个人」——
 * 他手里的刷新令牌照常续期，最长还能再用满一个刷新周期。
 * 而管理员重置密码的场景，十有八九正是怀疑账号被别人拿着。
 */
describe("作废某用户的全部会话", () => {
  it("多次登录派生的多个家族会被一次性全部撤销", async () => {
    const a = await issueRefreshToken(USER_ID);
    const b = await issueRefreshToken(USER_ID);
    const c = await issueRefreshToken(USER_ID);

    // 三次登录 = 三个互相独立的家族
    expect(familyCount()).toBe(3);

    const revoked = await revokeAllSessionsForUser(USER_ID);
    expect(revoked).toBe(3);

    for (const token of [a.token, b.token, c.token]) {
      expect((await rotateRefreshToken(token)).status).toBe("invalid");
    }
  });

  it("只影响目标用户，别人的会话原样存活", async () => {
    const mine = await issueRefreshToken(USER_ID);
    const other = await issueRefreshToken(USER_ID + 1);

    await revokeAllSessionsForUser(USER_ID);

    expect((await rotateRefreshToken(mine.token)).status).toBe("invalid");
    expect((await rotateRefreshToken(other.token)).status).toBe("rotated");
  });

  it("轮换过的会话也踢得掉——索引挂在家族上，不是挂在某一枚令牌上", async () => {
    const issued = await issueRefreshToken(USER_ID);
    const rotated = await rotateRefreshToken(issued.token);
    if (rotated.status !== "rotated") throw new Error("首次轮换应当成功");

    await revokeAllSessionsForUser(USER_ID);

    expect((await rotateRefreshToken(rotated.next.token)).status).toBe("invalid");
  });

  it("没有任何会话时是安全的空操作", async () => {
    expect(await revokeAllSessionsForUser(USER_ID)).toBe(0);
  });
});

/**
 * 绝对会话寿命。
 *
 * 滑动过期单独用是有洞的：每轮换一次就重置一次有效期，所以只要保持每周刷新一次，
 * 会话就能无限期续下去——「7 天有效期」在这种用法下从来不会真的到期。
 */
describe("绝对会话寿命", () => {
  it("到达上限后停止续期，并撤销整个家族", async () => {
    const issued = await issueRefreshToken(USER_ID);

    // 先正常滚动几次，证明「一直在用」并不能让它逃过上限
    let current = issued.token;
    for (let i = 0; i < 3; i++) {
      const r = await rotateRefreshToken(current);
      if (r.status !== "rotated") throw new Error("轮换应当成功");
      current = r.next.token;
    }

    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + (ABSOLUTE_TTL_SECONDS + 1) * 1000);

    expect((await rotateRefreshToken(current)).status).toBe("invalid");
    // 撤销是针对整个家族的，不是只让当前这一枚失效
    expect(familyCount()).toBe(0);
  });

  it("上限之内照常续期", async () => {
    const issued = await issueRefreshToken(USER_ID);

    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + (ABSOLUTE_TTL_SECONDS - 60) * 1000);

    expect((await rotateRefreshToken(issued.token)).status).toBe("rotated");
  });
});
