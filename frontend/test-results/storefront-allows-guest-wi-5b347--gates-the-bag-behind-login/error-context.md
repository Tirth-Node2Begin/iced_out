# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: storefront.spec.ts >> allows guest wishlist but gates the bag behind login
- Location: e2e\storefront.spec.ts:22:5

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('heading', { name: /cold by nature/i })
Expected: visible
Timeout: 15000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 15000ms
  - waiting for getByRole('heading', { name: /cold by nature/i })

```

```yaml
- link "Skip to content":
  - /url: "#main-content"
- banner:
  - link "Iced_out — home":
    - /url: /
    - text: ICED_OUT
  - navigation "Primary navigation":
    - link "Men":
      - /url: /new-man
    - link "Women":
      - /url: /new-woman
    - link "New drop":
      - /url: /new-drop
    - link "About":
      - /url: /about
    - link "Contact":
      - /url: /contact
  - link "Bag":
    - /url: /cart
  - link "Profile":
    - /url: /auth/login?returnTo=%2Faccount%2Fprofile
  - link "Login":
    - /url: /auth/login?returnTo=%2F
- main:
  - region "Iced Out":
    - heading "Iced Out" [level=1]
    - img "Black ICED OUT hoodie ghost mannequin cutout"
    - img "Cream ICED OUT knit polo sweater ghost mannequin cutout"
    - link "Buy Now":
      - /url: /new-drop
    - button "Write a review"
    - text: Be the first to review
  - paragraph: The weight
  - heading "Nothing here is light." [level=2]: Nothinghereislight.
  - paragraph: Drop 001 is anchored on 520 GSM brushed fleece and the Nightshift Overcoat is pressed wool at 740. That weight is the entire argument — it is what makes a piece hang correctly the first night out and still hang correctly two winters later, long after a lighter version of the same garment has gone soft at the shoulders.
  - img "Two figures in a concrete underpass after dark"
  - paragraph: 02 / From weight to wear
  - heading "Built slowly. Worn hard." [level=2]
  - img "Heavyweight fabric study under raking studio light"
  - img "Layered Iced_out silhouette photographed mid-movement"
  - img "Construction detail from the third prototype pass"
  - img "A finished piece from the numbered Drop 001 run"
  - text: Construction log / 01 Material
  - article:
    - text: "01"
    - paragraph: Material
    - heading "Start with the hand." [level=3]
    - paragraph: We test density, recovery, drape, and abrasion before a silhouette is allowed to exist.
    - text: Touch / Tension / Time
  - article:
    - text: "02"
    - paragraph: Form
    - heading "Cut for the moving body." [level=3]
    - paragraph: "Proportion is tuned in motion: reach, stride, sit, layer, repeat. Stillness is only one state."
    - text: Range / Balance / Stack
  - article:
    - text: "03"
    - paragraph: Trial
    - heading "Review until quiet." [level=3]
    - paragraph: Three construction passes remove friction, excess, and decorative decisions that do not work.
    - text: Prototype / Wear / Refine
  - article:
    - text: "04"
    - paragraph: Edition
    - heading "Release less. Mean more." [level=3]
    - paragraph: Runs stay intentionally small, letting each drop remain specific and every revision stay accountable.
    - text: Numbered / Limited / Recorded
- contentinfo:
  - paragraph: Gear up · every season
  - paragraph: Built for the cold starts and the long finishes. Limited runs, restocked when the season turns.
  - navigation "Footer":
    - heading "Shop" [level=4]
    - link "Men":
      - /url: /new-man
    - link "Women":
      - /url: /new-woman
    - link "New drop":
      - /url: /new-drop
    - link "Wishlist":
      - /url: /wishlist
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
- region "Notifications alt+T"
- alert
```

# Test source

```ts
  1   | import { expect, test, type Page } from "@playwright/test";
  2   | 
  3   | /**
  4   |  * Signs in through the real auth page and lands on `returnTo`. The session is
  5   |  * in-memory, so the test has to arrive at its destination from here — a fresh
  6   |  * page.goto() would drop it and bounce back through the guard.
  7   |  */
  8   | async function signInCustomer(page: Page, returnTo = "/") {
  9   |   await page.goto("/new-drop");
  10  |   await page.getByRole("link", { name: "Login" }).click();
  11  |   if (returnTo !== "/") {
  12  |     await page.goto(`/auth/login?returnTo=${encodeURIComponent(returnTo)}`);
  13  |   }
  14  |   await page.getByLabel("Email address").fill("shopper@example.com");
  15  |   // `getByLabel("Password")` also matches the field's "Show password" reveal
  16  |   // button, which resolves two elements and fails strict mode before the form
  17  |   // is ever filled.
  18  |   await page.getByRole("textbox", { name: "Password" }).fill("secret1");
  19  |   await page.getByRole("button", { name: "Sign in", exact: true }).click();
  20  | }
  21  | 
  22  | test("allows guest wishlist but gates the bag behind login", async ({ page }) => {
  23  |   await page.setViewportSize({ width: 1440, height: 1000 });
  24  |   await page.goto("/");
  25  | 
> 26  |   await expect(page.getByRole("heading", { name: /cold by nature/i })).toBeVisible();
      |                                                                        ^ Error: expect(locator).toBeVisible() failed
  27  |   await expect(page.getByText("Drop 001 / Live now")).toBeVisible();
  28  | 
  29  |   const firstProduct = page.locator(".product-card").first();
  30  |   await firstProduct.scrollIntoViewIfNeeded();
  31  |   await firstProduct.hover();
  32  |   await firstProduct.getByRole("button", { name: /Save Afterdark Hoodie/ }).click();
  33  |   await expect(firstProduct.getByRole("button", { name: /Remove Afterdark Hoodie/ })).toBeVisible();
  34  |   await firstProduct
  35  |     .locator('[aria-label="Choose a size for Afterdark Hoodie"]')
  36  |     .getByRole("button", { name: "M", exact: true })
  37  |     .click();
  38  |   await firstProduct.getByRole("button", { name: "Add to bag" }).click();
  39  | 
  40  |   // Gated actions route to the real sign-in page instead of opening a modal.
  41  |   await expect(page).toHaveURL(/\/auth\/login\?returnTo=/);
  42  |   await expect(page.getByRole("heading", { name: /SIGN IN\./ })).toBeVisible();
  43  |   await page.getByLabel("Email address").fill("shopper@example.com");
  44  |   // `getByLabel("Password")` also matches the field's "Show password" reveal
  45  |   // button, which resolves two elements and fails strict mode before the form
  46  |   // is ever filled.
  47  |   await page.getByRole("textbox", { name: "Password" }).fill("secret1");
  48  |   await page.getByRole("button", { name: "Sign in" }).click();
  49  |   await expect(page).toHaveURL("/");
  50  | 
  51  |   await page.getByRole("button", { name: "Bottoms" }).click();
  52  |   const productGrid = page.locator(".product-grid");
  53  |   await expect(productGrid.getByText("Shadow Cargo 02")).toBeVisible();
  54  |   await expect(productGrid.getByText("Afterdark Hoodie")).toHaveCount(0);
  55  | });
  56  | 
  57  | test("falls back to the footer for navigation on mobile", async ({ page }) => {
  58  |   await page.setViewportSize({ width: 390, height: 844 });
  59  |   await page.goto("/new-drop");
  60  | 
  61  |   // The shared bar drops both rails below 860px — the same behaviour it has on
  62  |   // the new home — so the footer is what carries the destinations there.
  63  |   await expect(page.getByRole("navigation", { name: "Primary navigation" })).toBeHidden();
  64  |   await expect(page.locator(".nh-nav__wordmark")).toBeVisible();
  65  | 
  66  |   // One footer serves the whole site now (`components/layout/site-footer`), so
  67  |   // these are its labels rather than the listing pages' old private set.
  68  |   const footer = page.getByRole("contentinfo");
  69  |   for (const label of [
  70  |     "Men",
  71  |     "Women",
  72  |     // Was "Accessories", which only ever pointed at /collections. That route is
  73  |     // gone, so the slot carries the chapter listing that actually exists.
  74  |     "New drop",
  75  |     // Was "Seasonal", which only ever pointed at /sale. That route is gone.
  76  |     "Wishlist",
  77  |     "Shipping",
  78  |     "Returns",
  79  |     "Contact",
  80  |     "About",
  81  |   ]) {
  82  |     await expect(footer.getByRole("link", { name: label, exact: true })).toBeVisible();
  83  |   }
  84  | });
  85  | 
  86  | test("serves the approved public destinations", async ({ page }) => {
  87  |   test.setTimeout(240_000);
  88  |   for (const [path, heading] of [
  89  |     // /new-drop now serves the men's listing; /men is gone.
  90  |     ["/new-drop", "Built for the Men Who Move After Dark"],
  91  |     ["/women", "Structured Volume for the Women Who Set the Pace"],
  92  |     ["/new-man", "Gear up every season"],
  93  |     ["/new-woman", "Gear up every season"],
  94  |     // /collections, /collections/view, /sale, /search and /product are gone —
  95  |     // a chapter has no route of its own, the two listing pages below are the
  96  |     // catalogue, and searching is the header's dock rather than a destination.
  97  |     ["/about", "Cold by nature. Built with intent."],
  98  |     ["/contact", "Start with context. Not a queue."],
  99  |   ]) {
  100 |     await page.goto(path, { waitUntil: "domcontentloaded" });
  101 |     await expect(page.getByRole("heading", { name: heading })).toBeVisible();
  102 |   }
  103 | });
  104 | 
  105 | test("blocks direct guest checkout", async ({ page }) => {
  106 |   await page.goto("/checkout");
  107 |   await page.waitForURL("**/auth/login?returnTo=%2Fcheckout");
  108 |   await expect(page.getByRole("heading", { name: "Sign in." })).toBeVisible();
  109 | });
  110 | 
  111 | test("provides the complete admin payments workspace", async ({ page }) => {
  112 |   await page.goto("/admin/payments");
  113 |   await page.waitForURL("**/admin/login?returnTo=%2Fadmin%2Fpayments");
  114 |   await page.getByRole("button", { name: /Enter console/ }).click();
  115 |   await page.waitForURL("**/admin/payments");
  116 |   await expect(page.getByRole("heading", { name: "Payments ledger" })).toBeVisible();
  117 |   /* Both screens the area has left — money in, and money on to the bank.
  118 |      Refunds moved to Returns, which is where a refund is decided. Scoped to
  119 |      the toolbar pill: the console rail also carries a "Payments" link, and an
  120 |      unqualified name matches both. */
  121 |   const tabs = page.getByRole("navigation", { name: "Payments screens" });
  122 |   await tabs.getByRole("link", { name: "Payouts", exact: true }).click();
  123 |   await expect(page.getByRole("heading", { name: "Gateway payouts" })).toBeVisible();
  124 |   await tabs.getByRole("link", { name: "Payments", exact: true }).click();
  125 |   await expect(page.getByRole("heading", { name: "Payments ledger" })).toBeVisible();
  126 |   await page.getByRole("link", { name: "Open pay_ICE1048" }).click();
```