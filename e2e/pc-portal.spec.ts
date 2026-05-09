import { expect, test } from "@playwright/test";

test.describe("pc-portal", () => {
  test("首页显示门户顶栏、全部频道与文章列表或空态", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("link", { name: "门户" })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: "全部" })).toBeVisible();

    const empty = page.getByText("暂无文章");
    const firstCard = page.locator(".feed article.card").first();
    await expect(empty.or(firstCard)).toBeVisible();
  });

  test("访客可从顶栏进入登录与注册页", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("button", { name: "登录" }).click();
    await expect(page).toHaveURL(/\/login(?:\?|$)/);
    await expect(page.getByRole("heading", { name: "登录" })).toBeVisible();

    await page.goto("/");
    await page.getByRole("button", { name: "注册" }).click();
    await expect(page).toHaveURL(/\/register$/);
    await expect(page.getByRole("heading", { name: "注册" })).toBeVisible();
  });

  test("未登录访问 /mine 时跳转登录并携带 redirect", async ({ page }) => {
    await page.goto("/mine");

    await expect(page).toHaveURL(/\/login/);
    const u = new URL(page.url());
    expect(u.pathname).toBe("/login");
    expect(u.searchParams.get("redirect")).toContain("/mine");
  });
});
