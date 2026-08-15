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
    - text: I c e d O u t
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
  - heading "I c e d O u t" [level=1]
  - img "Outerwear set, gold-lit concrete"
  - img "Layered flatlay on steel"
  - img "Wet-floor underpass campaign frame"
  - img "Campaign pair against a lit panel"
  - img "Cotton overshirt, studio still"
  - img "Concrete corridor, full-length"
  - text: "2016"
  - paragraph: We create timeless architectural and interior spaces focused on clarity, functionality, and modern living
  - text: "2025"
  - paragraph: Philosophy
  - paragraph: Every project is shaped through proportion, light, texture, and spatial balance. We believe great design should feel natural over time, creating environments that are both functional and emotionally connected to everyday life
  - img "Two figures in a concrete underpass"
  - text: Meet the founders
  - img "Elena Carter"
  - img "Marcus Lindberg"
  - img "Sofia Bennett"
  - img "Daniel Foster"
  - text: "01"
  - heading "Elena Carter" [level=3]
  - text: Founder & Creative Director
  - paragraph: Leads the studio's creative vision with a focus on timeless interiors, spatial harmony, and material storytelling.
  - text: Studio Highlights
  - heading "Designed for creativity and collaboration" [level=2]
  - text: "01"
  - img "Material Library"
  - heading "Material Library" [level=3]
  - text: 01 Material Library
  - paragraph: Our studio reflects the same principles we bring into every project — calm atmosphere, refined materials, natural light, and intentional design decisions that support both creativity and focus.
  - text: "02"
  - img "Collaborative Workspace"
  - heading "Collaborative Workspace" [level=3]
  - text: "03"
  - img "Design Archive"
  - heading "Design Archive" [level=3]
  - heading "What our clients say" [level=2]
  - button "Previous testimonial":
    - img
  - button "Next testimonial":
    - img
  - img "Emma Larson"
  - text: "01"
  - paragraph: “The team created a home that feels calm, timeless, and deeply personal. Every detail was thoughtfully considered from start to finish.”
  - text: Emma Larson Private residence client
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
  72  |     "Accessories",
  73  |     "Seasonal",
  74  |     "Shipping",
  75  |     "Returns",
  76  |     "Contact",
  77  |     "About",
  78  |   ]) {
  79  |     await expect(footer.getByRole("link", { name: label, exact: true })).toBeVisible();
  80  |   }
  81  | });
  82  | 
  83  | test("serves the approved public destinations", async ({ page }) => {
  84  |   test.setTimeout(240_000);
  85  |   for (const [path, heading] of [
  86  |     // /new-drop now serves the men's listing; /men is gone.
  87  |     ["/new-drop", "Built for the Men Who Move After Dark"],
  88  |     ["/women", "Structured Volume for the Women Who Set the Pace"],
  89  |     ["/new-man", "Gear up every season"],
  90  |     ["/new-woman", "Gear up every season"],
  91  |     ["/collections", "Collections."],
  92  |     ["/sale", "Sale."],
  93  |     ["/about", "Cold by nature. Built with intent."],
  94  |     ["/contact", "Start with context. Not a queue."],
  95  |   ]) {
  96  |     await page.goto(path, { waitUntil: "domcontentloaded" });
  97  |     await expect(page.getByRole("heading", { name: heading })).toBeVisible();
  98  |   }
  99  | });
  100 | 
  101 | test("blocks direct guest checkout", async ({ page }) => {
  102 |   await page.goto("/checkout");
  103 |   await page.waitForURL("**/auth/login?returnTo=%2Fcheckout");
  104 |   await expect(page.getByRole("heading", { name: "Sign in." })).toBeVisible();
  105 | });
  106 | 
  107 | test("provides the complete admin payments workspace", async ({ page }) => {
  108 |   await page.goto("/admin/payments");
  109 |   await page.waitForURL("**/admin/login?returnTo=%2Fadmin%2Fpayments");
  110 |   await page.getByRole("button", { name: /Enter console/ }).click();
  111 |   await page.waitForURL("**/admin/payments");
  112 |   await expect(page.getByRole("heading", { name: "Payments ledger" })).toBeVisible();
  113 |   /* Both screens the area has left — money in, and money on to the bank.
  114 |      Refunds moved to Returns, which is where a refund is decided. Scoped to
  115 |      the toolbar pill: the console rail also carries a "Payments" link, and an
  116 |      unqualified name matches both. */
  117 |   const tabs = page.getByRole("navigation", { name: "Payments screens" });
  118 |   await tabs.getByRole("link", { name: "Payouts", exact: true }).click();
  119 |   await expect(page.getByRole("heading", { name: "Gateway payouts" })).toBeVisible();
  120 |   await tabs.getByRole("link", { name: "Payments", exact: true }).click();
  121 |   await expect(page.getByRole("heading", { name: "Payments ledger" })).toBeVisible();
  122 |   await page.getByRole("link", { name: "Open pay_ICE1048" }).click();
  123 |   await page.waitForURL("**/admin/payments/pay_ICE1048");
  124 |   await expect(page.getByRole("heading", { name: "Payment pay_ICE1048" })).toBeVisible();
  125 | });
  126 | 
```