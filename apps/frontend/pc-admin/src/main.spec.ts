import { flushPromises } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h } from "vue";

/**
 * 应用启动顺序的回归测试。
 *
 * 守的是一条没有其它防线的不变量：会话恢复必须跑在 `app.use(router)` 之前。
 * vue-router 在 install 时就同步发起首次导航，守卫随即读 isLoggedIn 决定去留；
 * 而访问令牌只存内存、刷新页面必然丢失，若此刻还没用刷新 Cookie 换回令牌，
 * 守卫读到的恒为「未登录」。管理端所有非白名单路由都要求登录，
 * 因此顺序一旦错位，表现就是「每次刷新都被踢回登录页」——哪怕刷新 Cookie 完全有效。
 *
 * 这条顺序被挪回去时，typecheck、lint、组件测试与生产构建全都不会报错，
 * 因此这里直接对启动过程本身断言。
 */

const bootstrapSession = vi.fn<() => Promise<void>>();
/** 路由以「插件」形态被 app.use 消费，因此 install 被调用的时刻就是 app.use(router) 的时刻 */
const routerInstall = vi.fn();

vi.mock("./router", () => ({ default: { install: routerInstall } }));
vi.mock("./stores/auth", () => ({ useAuthStore: () => ({ bootstrapSession }) }));
vi.mock("./App.vue", () => ({
  default: defineComponent({ name: "AppStub", render: () => h("div", { class: "app-stub" }) }),
}));

/** 让会话恢复挂起，用来观察「恢复未完成时 app.use(router) 有没有被抢跑」 */
function deferBootstrap() {
  let release!: () => void;
  bootstrapSession.mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        release = resolve;
      }),
  );
  return () => {
    release();
    return flushPromises();
  };
}

beforeEach(() => {
  vi.resetModules();
  bootstrapSession.mockReset();
  routerInstall.mockReset();
  document.body.innerHTML = '<div id="app"></div>';
});

describe("pc-admin 启动顺序", () => {
  it("会话恢复完成之前不安装路由，否则守卫会把已登录用户判为未登录", async () => {
    const finishBootstrap = deferBootstrap();

    await import("./main");
    await flushPromises();

    expect(bootstrapSession).toHaveBeenCalledTimes(1);
    expect(routerInstall).not.toHaveBeenCalled();

    await finishBootstrap();

    expect(routerInstall).toHaveBeenCalledTimes(1);
  });

  it("会话恢复完成后才挂载应用", async () => {
    const finishBootstrap = deferBootstrap();

    await import("./main");
    await flushPromises();
    expect(document.querySelector(".app-stub")).toBeNull();

    await finishBootstrap();

    expect(document.querySelector(".app-stub")).not.toBeNull();
  });

  it("恢复失败也照常安装路由并挂载，不会把用户卡在空白页", async () => {
    bootstrapSession.mockResolvedValue(undefined);

    await import("./main");
    await flushPromises();

    expect(routerInstall).toHaveBeenCalledTimes(1);
    expect(document.querySelector(".app-stub")).not.toBeNull();
  });
});
