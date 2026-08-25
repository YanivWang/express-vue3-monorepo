import { beforeEach, describe, expect, it, vi } from "vitest";

import { PERMISSION_CODES } from "../rbac/permission-codes.js";

vi.mock("../utils/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("../db.js", () => ({
  Permission: { findOrCreate: vi.fn(), findAll: vi.fn() },
  Role: { findOrCreate: vi.fn() },
  User: { count: vi.fn(), findOrCreate: vi.fn() },
}));

const { Permission, Role, User } = await import("../db.js");
const { bootstrapRbacIfNeeded } = await import("./rbac-bootstrap.service.js");

const mockedPermission = vi.mocked(
  Permission as unknown as Record<string, ReturnType<typeof vi.fn>>,
);
const mockedRole = vi.mocked(Role as unknown as Record<string, ReturnType<typeof vi.fn>>);
const mockedUser = vi.mocked(User as unknown as Record<string, ReturnType<typeof vi.fn>>);

/** 造一个够用的 Role 实例替身：只需要 get(id) 与 setPermissions */
function fakeRole(id: number) {
  return { id, get: (k: string) => (k === "id" ? id : undefined), setPermissions: vi.fn() };
}

const allPerms = PERMISSION_CODES.map((code, i) => ({ code, id: i + 1 }));

/**
 * @param created 各角色本次是否为「新建」（findOrCreate 的第二个返回值）
 */
function arrangeRoles(created: { superAdmin: boolean; user: boolean; moderator: boolean }) {
  const roles = { superAdmin: fakeRole(1), user: fakeRole(2), moderator: fakeRole(3) };

  mockedPermission.findOrCreate.mockResolvedValue([{}, true]);
  mockedPermission.findAll.mockResolvedValue(allPerms);
  // 已存在 super_admin 账号，走 early return，不触发建号分支
  mockedUser.count.mockResolvedValue(1);

  mockedRole.findOrCreate.mockImplementation((opts: { where: { slug: string } }) => {
    switch (opts.where.slug) {
      case "super_admin":
        return Promise.resolve([roles.superAdmin, created.superAdmin]);
      case "user":
        return Promise.resolve([roles.user, created.user]);
      case "moderator":
        return Promise.resolve([roles.moderator, created.moderator]);
      default:
        throw new Error(`unexpected slug ${opts.where.slug}`);
    }
  });

  return roles;
}

describe("bootstrapRbacIfNeeded 的权限绑定策略", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("super_admin 每次启动都全量同步权限（新增权限码后老库自动补齐）", async () => {
    const roles = arrangeRoles({ superAdmin: false, user: false, moderator: false });
    await bootstrapRbacIfNeeded();

    expect(roles.superAdmin.setPermissions).toHaveBeenCalledTimes(1);
    expect(roles.superAdmin.setPermissions).toHaveBeenCalledWith(allPerms);
  });

  it("角色已存在时不再触碰 user / moderator 的权限绑定（重启不清空矩阵勾选）", async () => {
    const roles = arrangeRoles({ superAdmin: false, user: false, moderator: false });
    await bootstrapRbacIfNeeded();

    expect(roles.user.setPermissions).not.toHaveBeenCalled();
    expect(roles.moderator.setPermissions).not.toHaveBeenCalled();
  });

  it("仅在首次创建这两个角色时播种为空权限", async () => {
    const roles = arrangeRoles({ superAdmin: false, user: true, moderator: true });
    await bootstrapRbacIfNeeded();

    expect(roles.user.setPermissions).toHaveBeenCalledWith([]);
    expect(roles.moderator.setPermissions).toHaveBeenCalledWith([]);
  });
});
