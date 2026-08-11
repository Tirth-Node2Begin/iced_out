# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: navigation.spec.ts >> keeps the storefront shell mounted and swaps to the About experience
- Location: e2e\navigation.spec.ts:3:5

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('heading', { name: 'Gear up every season' })
Expected: visible
Timeout: 15000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 15000ms
  - waiting for getByRole('heading', { name: 'Gear up every season' })

```

```yaml
- alert: Iced_out — Women's training wear — Iced_out
- banner:
  - link "Iced_out — home":
    - /url: /
    - text: ICED_OUT
  - navigation "Primary navigation":
    - link "Men":
      - /url: /new-man
    - link "Women" [expanded]:
      - /url: /new-woman
    - link "New drop":
      - /url: /new-drop
    - link "Sale":
      - /url: /sale
    - link "About":
      - /url: /about
    - link "Contact":
      - /url: /contact
  - link "Bag":
    - /url: /cart
  - link "Profile":
    - /url: /auth/login?returnTo=%2Faccount
  - link "Login":
    - /url: /auth/login?returnTo=%2F
  - text: Shop
  - list:
    - listitem:
      - link "All women":
        - /url: /new-woman
    - listitem:
      - link "New drop":
        - /url: /new-drop
    - listitem:
      - link "Sale":
        - /url: /sale
  - text: Collections
  - list:
    - listitem:
      - link "Drop 001 Live now":
        - /url: /collections/drop-001
    - listitem:
      - link "After Hours Open archive":
        - /url: /collections/after-hours
    - listitem:
      - link "Core Uniform Always considered":
        - /url: /collections/core-uniform
  - link "After Hours Open archive After Hours":
    - /url: /collections/after-hours
    - img "After Hours"
    - text: Open archive After Hours
- main:
  - heading "Womenswear built to move Every Season!" [level=1]
  - link "Shop womenswear":
    - /url: /collections
  - link "View sale":
    - /url: /sale
  - img "Iced_out winter training kit"
  - paragraph: 01 / Women _2025
  - paragraph: "Fit: Sculpt"
  - paragraph: Cut for how women actually train. High-rise tights that stay put, seamless base layers, and shells that layer clean without the bulk.
  - button "Play the campaign film"
  - img "Training short, detail"
  - img "Winter shell, studio"
  - img "Layering system, detail"
  - paragraph: Women's layers for the cold months — brushed thermals, cropped shells, and tights that hold their shape session after session.
  - paragraph: "Performance-driven womenswear: bras, tights, crops, and shells, sized XS through XL."
- contentinfo:
  - paragraph: Gear up · every season
  - paragraph: Built for the cold starts and the long finishes. Limited runs, restocked when the season turns.
  - navigation "Footer":
    - heading "Shop" [level=4]
    - link "Men":
      - /url: /new-man
    - link "Women":
      - /url: /new-woman
    - link "Accessories":
      - /url: /collections
    - link "Seasonal":
      - /url: /sale
    - heading "Support" [level=4]
    - link "Shipping":
      - /url: /pages/shipping-policy
    - link "Returns":
      - /url: /pages/return-policy
    - link "Size guide":
      - /url: /contact
    - link "Contact":
      - /url: /contact
    - heading "Studio" [level=4]
    - link "About":
      - /url: /about
    - link "Journal":
      - /url: /contact
    - link "Stockists":
      - /url: /contact
    - link "Careers":
      - /url: /contact
  - text: © 2026 Iced_out Every season · every workout
```

# Test source

```ts
  1  | import { expect, test } from "@playwright/test";
  2  | 
  3  | test("keeps the storefront shell mounted and swaps to the About experience", async ({ page }) => {
  4  |   await page.setViewportSize({ width: 1440, height: 1000 });
  5  |   // "/" redirects to the new home, which is outside the shell — the run starts
  6  |   // from a route the shell actually owns.
  7  |   // The men's listing moved to /new-drop; /men no longer exists.
  8  |   await page.goto("/new-drop");
  9  |   await expect(
  10 |     page.getByRole("heading", { name: "Built for the Men Who Move After Dark" }),
  11 |   ).toBeVisible();
  12 | 
  13 |   // .nh-nav-scope is the storefront shell's own wrapper around the shared bar;
  14 |   // the About experience mounts the same .nh-nav without it.
  15 |   await page.locator(".nh-nav-scope").evaluate((header) => {
  16 |     header.setAttribute("data-navigation-probe", "persistent");
  17 |   });
  18 | 
  19 |   for (const [path, heading] of [
  20 |     ["/new-woman", "Gear up every season"],
  21 |     ["/new-man", "Gear up every season"],
  22 |     ["/new-drop", "Built for the Men Who Move After Dark"],
  23 |   ] as const) {
  24 |     const startedAt = Date.now();
  25 |     await page.locator(`header a[href="${path}"]`).click();
  26 |     await expect(page).toHaveURL(path);
> 27 |     await expect(page.getByRole("heading", { name: heading })).toBeVisible();
     |                                                                ^ Error: expect(locator).toBeVisible() failed
  28 |     expect(Date.now() - startedAt).toBeLessThan(2_000);
  29 |   }
  30 | 
  31 |   await expect(page.locator('.nh-nav-scope[data-navigation-probe="persistent"]')).toBeVisible();
  32 | 
  33 |   const startedAt = Date.now();
  34 |   await page.locator('header a[href="/about"]').click();
  35 |   await expect(page).toHaveURL("/about");
  36 |   await expect(
  37 |     page.getByRole("heading", { name: "Cold by nature. Built with intent." }),
  38 |   ).toBeVisible();
  39 |   await expect(page.locator(".nh-nav")).toBeVisible();
  40 |   await expect(page.locator(".nh-nav-scope")).toHaveCount(0);
  41 |   expect(Date.now() - startedAt).toBeLessThan(2_000);
  42 |   expect(await page.evaluate(() => performance.getEntriesByType("navigation").length)).toBe(1);
  43 | });
  44 | 
```