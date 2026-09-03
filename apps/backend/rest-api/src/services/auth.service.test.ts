/**
 * 登录的凭证比对不该泄露「用户名是否存在」。
 *
 * 这条约束只体现在**耗时**上，断言不了毫秒数（CI 机器的抖动远大于差值），
 * 但可以断言产生差值的那个原因：用户不存在时是否仍然走了一次 bcrypt。
 * 直接对着实现断言在这里是恰当的——要守的正是这个实现选择本身，
 * 一旦有人「顺手优化」成查无此人就早返回，时序侧信道立刻回来。
 */
import bcrypt from "bcrypt";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../env.js", () => ({
  JWT_SECRET: "test-secret-at-least-32-characters-long",
  ACCESS_TOKEN_TTL_SECONDS: 900,
}));

vi.mock("bcrypt", () => ({
  default: { compare: vi.fn(), hash: vi.fn() },
}));

vi.mock("../db.js", () => ({
  User: { findOne: vi.fn(), create: vi.fn() },
  Role: {},
}));

vi.mock("./rbac.service.js", () => ({
  getRoleIdBySlugOrThrow: vi.fn(),
}));

vi.mock("../utils/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { User } from "../db.js";

import { loginUser } from "./auth.service.js";

const mockedCompare = vi.mocked(bcrypt.compare);
const mockedFindOne = vi.mocked(User.findOne);

/**
 * loginUser 只读 id / username / password 这几项，用最小替身代替真实模型实例；
 * `findOne` 的返回类型来自 Sequelize，故此处需要一次窄化。
 */
function fakeUser(fields: { id: number; username: string; password: string }) {
  return fields as unknown as NonNullable<Awaited<ReturnType<typeof User.findOne>>>;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("loginUser", () => {
  it("用户名不存在时仍然执行一次口令比对，不给时序留下枚举入口", async () => {
    mockedFindOne.mockResolvedValue(null);

    await expect(loginUser({ username: "nobody", password: "whatever" })).rejects.toMatchObject({
      statusCode: 401,
    });

    // 关键：查无此人也要付出同样的哈希代价，否则响应快一截就等于回答了「这个用户名不存在」
    expect(mockedCompare).toHaveBeenCalledTimes(1);
    const [, hashUsed] = mockedCompare.mock.calls[0];
    expect(hashUsed).toMatch(/^\$2[aby]\$/);
  });

  it("用户存在但口令错误时，比对的是该用户的真实哈希", async () => {
    mockedFindOne.mockResolvedValue(
      fakeUser({ id: 1, username: "someone", password: "$2b$10$real" }),
    );
    mockedCompare.mockResolvedValue(false as never);

    await expect(loginUser({ username: "someone", password: "wrong" })).rejects.toMatchObject({
      statusCode: 401,
    });

    expect(mockedCompare).toHaveBeenCalledWith("wrong", "$2b$10$real");
  });

  it("两条失败路径给出完全相同的对外文案", async () => {
    mockedFindOne.mockResolvedValue(null);
    const missing = await loginUser({ username: "nobody", password: "x" }).catch(
      (e: Error) => e.message,
    );

    mockedFindOne.mockResolvedValue(
      fakeUser({ id: 1, username: "someone", password: "$2b$10$real" }),
    );
    mockedCompare.mockResolvedValue(false as never);
    const wrongPwd = await loginUser({ username: "someone", password: "x" }).catch(
      (e: Error) => e.message,
    );

    expect(missing).toBe(wrongPwd);
  });
});
