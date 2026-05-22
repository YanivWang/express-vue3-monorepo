import jwt from "jsonwebtoken";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../env.js", () => ({
  JWT_SECRET: "test-secret",
}));

vi.mock("./auth-token.service.js", () => ({
  isJwtBlacklisted: vi.fn(),
}));

import { isJwtBlacklisted } from "./auth-token.service.js";
import { resolveJwtUser, requireJwtUser } from "./jwt-verify.service.js";

const mockedBlacklist = vi.mocked(isJwtBlacklisted);

function signToken(payload: Record<string, unknown>) {
  return jwt.sign(payload, "test-secret", { expiresIn: 3600 });
}

describe("jwt-verify.service", () => {
  beforeEach(() => {
    mockedBlacklist.mockReset();
    mockedBlacklist.mockResolvedValue(false);
  });

  it("resolveJwtUser 返回有效用户", async () => {
    const token = signToken({ id: 1, username: "u", jti: "jti-1" });
    const user = await resolveJwtUser(token);
    expect(user?.id).toBe(1);
    expect(user?.jti).toBe("jti-1");
  });

  it("resolveJwtUser 对已拉黑 token 返回 null", async () => {
    mockedBlacklist.mockResolvedValue(true);
    const token = signToken({ id: 1, username: "u", jti: "jti-black" });
    const user = await resolveJwtUser(token);
    expect(user).toBeNull();
  });

  it("requireJwtUser 对已拉黑 token 抛出 TokenExpiredError", async () => {
    mockedBlacklist.mockResolvedValue(true);
    const token = signToken({ id: 1, username: "u", jti: "jti-black" });
    await expect(requireJwtUser(token)).rejects.toBeInstanceOf(jwt.TokenExpiredError);
  });
});
