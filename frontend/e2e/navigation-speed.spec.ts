import { expect, test } from "@playwright/test";

/**
 * The budget for a client-side route change.
 *
 * Every route is statically exported and every rail destination is prefetched,
 * so a transition should be a render rather than a fetch: the payload is in the
 * router cache before the click lands. The threshold has headroom for a loaded
 * CI machine but is well under the old behaviour — before the bar stopped
 * replaying its 0.8s entrance on every cross-group mount, the chrome alone
 * outlasted this number.
 */
const TRANSITION_BUDGET_MS = 1_200;

/** Long enough for prefetch to settle after the pointer lands on a rail item. */
const INTENT_SETTLE_MS = 350;

/**
 * Destinations chosen for two properties, both load-bearing.
 *
 * They live in different route groups — `/contact` in `(storefront)`, `/about`
 * standalone, and the `/new-drop` the run starts from in `(gender)` — so every
 * hop crosses a group boundary and unmounts a layout. That is the expensive
 * case and the whole point. Alternating the two is what keeps three crossings
 * on the board now that Sale has left the rail: it is still a live page, but
 * the bar no longer carries a pill for it, so it cannot be clicked from here.
 *
 * And neither owns a mega menu (only `/new-man`, `/new-woman` and `/new-drop`
 * do). Hovering one of those opens a full-width panel that covers the rail,
 * which makes the click a fight with an animating overlay rather than a
 * measurement of navigation.
 */
const HOPS = ["/contact", "/about", "/contact"] as const;

test("navigates between route groups without a document load", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/new-drop");
  await expect(page.locator(".nh-nav")).toBeVisible();

  const timings: string[] = [];

  for (const path of HOPS) {
    const link = page.locator(`header a[href="${path}"]`).first();
    await expect(link).toBeVisible();

    // Hover first, the way a pointer actually arrives — this is what the bar's
    // intent prefetch listens for, so the click should be served from cache.
    await link.hover();
    await page.waitForTimeout(INTENT_SETTLE_MS);

    const startedAt = Date.now();
    await link.click();

    /* `aria-current="page"` is the honest "the route committed and the chrome
       re-rendered against the new pathname" signal, and unlike a heading it is
       route-agnostic — it survives the pages being redesigned, which the
       heading-based specs in navigation.spec.ts did not. */
    await expect(page.locator(`header a[href="${path}"][aria-current="page"]`)).toBeVisible();
    const elapsed = Date.now() - startedAt;

    await expect(page).toHaveURL(path);
    timings.push(`${path}=${elapsed}ms`);
    expect(elapsed).toBeLessThan(TRANSITION_BUDGET_MS);
  }

  console.log(`NAV_TIMINGS ${timings.join(" ")}`);

  /* The one assertion a fast server cannot fake: a full page load would push a
     second entry here. One entry means every hop above was a client-side
     transition, which is what the no-raw-anchors rule buys. */
  expect(await page.evaluate(() => performance.getEntriesByType("navigation").length)).toBe(1);
});

test("serves a designed 404 for an unmatched URL", async ({ page }) => {
  /* The static export writes `not-found.tsx` to 404.html, so this is the page a
     host serves for anything unrouted. Asserting on it here is what stops it
     regressing to the framework default, which renders on the OS colour scheme
     rather than the app's. */
  const response = await page.goto("/this-route-does-not-exist");
  expect(response).not.toBeNull();

  /* The numeral is `aria-hidden` scenery, so the page's accessible name is the
     visually hidden heading — which is what should be asserted on. If this
     stops matching, the page has lost its meaning for anyone not looking at
     it, whatever the numeral is still doing. */
  await expect(page.getByRole("heading", { name: /page not found/i })).toBeAttached();
  await expect(page.locator(".st__figure")).toHaveText("404");

  // Both ways out are present, and the primary one is a client-side link.
  await expect(page.getByRole("button", { name: /go back/i })).toBeVisible();

  const home = page.getByRole("link", { name: /back to home/i });
  await expect(home).toBeVisible();
  await home.click();

  // Asserting we left the dead end rather than pinning the destination: "/" has
  // been re-pointed at a different home experience more than once, and this
  // test is about the 404 working, not about which build answers the root.
  await expect(page.locator(".st__figure")).toHaveCount(0);
});
