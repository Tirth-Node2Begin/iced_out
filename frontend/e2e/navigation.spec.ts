import { expect, test } from "@playwright/test";

test("keeps the storefront shell mounted and swaps to the About experience", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  // "/" redirects to the new home, which is outside the shell — the run starts
  // from a route the shell actually owns.
  // The men's listing moved to /new-drop; /men no longer exists.
  await page.goto("/new-drop");
  await expect(
    page.getByRole("heading", { name: "Built for the Men Who Move After Dark" }),
  ).toBeVisible();

  // .nh-nav-scope is the storefront shell's own wrapper around the shared bar;
  // the About experience mounts the same .nh-nav without it.
  await page.locator(".nh-nav-scope").evaluate((header) => {
    header.setAttribute("data-navigation-probe", "persistent");
  });

  for (const [path, heading] of [
    ["/new-woman", "Gear up every season"],
    ["/new-man", "Gear up every season"],
    ["/new-drop", "Built for the Men Who Move After Dark"],
  ] as const) {
    const startedAt = Date.now();
    await page.locator(`header a[href="${path}"]`).click();
    await expect(page).toHaveURL(path);
    await expect(page.getByRole("heading", { name: heading })).toBeVisible();
    expect(Date.now() - startedAt).toBeLessThan(2_000);
  }

  await expect(page.locator('.nh-nav-scope[data-navigation-probe="persistent"]')).toBeVisible();

  const startedAt = Date.now();
  await page.locator('header a[href="/about"]').click();
  await expect(page).toHaveURL("/about");
  await expect(
    page.getByRole("heading", { name: "Cold by nature. Built with intent." }),
  ).toBeVisible();
  await expect(page.locator(".nh-nav")).toBeVisible();
  await expect(page.locator(".nh-nav-scope")).toHaveCount(0);
  expect(Date.now() - startedAt).toBeLessThan(2_000);
  expect(await page.evaluate(() => performance.getEntriesByType("navigation").length)).toBe(1);
});
