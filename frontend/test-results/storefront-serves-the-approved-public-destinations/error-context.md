# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: storefront.spec.ts >> serves the approved public destinations
- Location: e2e\storefront.spec.ts:86:5

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('heading', { name: 'Built for the Men Who Move After Dark' })
Expected: visible
Timeout: 15000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 15000ms
  - waiting for getByRole('heading', { name: 'Built for the Men Who Move After Dark' })

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
    - /url: /auth/login?returnTo=%2Fnew-drop
- main:
  - region "Men — collection hero":
    - paragraph: Drop 001 · Menswear
    - heading "Nothing Here Comes Back." [level=1]
    - paragraph: 520 GSM fleece, four-pocket canvas, articulated cargo. Built with the heft left in.
    - link "Shop the Edit":
      - /url: "#gx-edit"
    - link "Explore Lookbook":
      - /url: "#gx-lookbook"
  - region "Men — Drop 001":
    - paragraph: Iced_out / Men / Drop 001
    - text: Numbered · Never restocked
    - heading "No pieces cut for weight and movement" [level=2]
    - paragraph: The men's edit is built around three anchors — a 520 GSM fleece, a four-pocket canvas overshirt, and a wide-leg cargo balanced by articulated knees. Everything else is designed to sit under, over, or beside them.
    - list:
      - listitem: 0 Pieces live
      - listitem: 320 Numbered units
      - listitem: 01 Production run
  - region "Shop the drop":
    - paragraph: 01 / The release
    - heading "Shop the drop" [level=2]
    - radiogroup "Filter the release by category":
      - radio "All pieces" [checked]
      - radio "Outerwear"
      - radio "Knitwear"
      - radio "Trousers"
      - radio "Tops"
      - radio "Accessories"
    - heading "Cannot read properties of undefined (reading 'code')" [level=3]
  - region "How it’s worn":
    - paragraph: 02 / The look
    - heading "How it’s worn" [level=2]
    - paragraph: Two complete fits from the release, shot after dark. Tap either to open the piece that carries it.
    - link "Look 01 — Underpass":
      - /url: /new-man
      - text: Look 01
    - heading "Underpass" [level=3]
    - paragraph: Shell over heavyweight fleece, wide-leg cargo, chain hardware. The default after-dark uniform.
    - link "Look 02 — Gold Wall":
      - /url: /new-man
      - text: Look 02
    - heading "Gold Wall" [level=3]
    - paragraph: Zip hood over a boxy tee, drop-shoulder through the body, cargo cut long over the boot.
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
  26  |   await expect(page.getByRole("heading", { name: /cold by nature/i })).toBeVisible();
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
> 101 |     await expect(page.getByRole("heading", { name: heading })).toBeVisible();
      |                                                                ^ Error: expect(locator).toBeVisible() failed
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
  127 |   await page.waitForURL("**/admin/payments/pay_ICE1048");
  128 |   await expect(page.getByRole("heading", { name: "Payment pay_ICE1048" })).toBeVisible();
  129 | });
  130 | 
  131 | /**
  132 |  * The one thing that makes the payments module a ledger rather than a
  133 |  * demonstration: money a shopper owes shows up in the back office.
  134 |  *
  135 |  * Cash on delivery is the case worth pinning. It is the outcome that used to
  136 |  * write nothing at all — no gateway was asked, so nothing was recorded — and
  137 |  * it is the only one that reaches the console still owing money.
  138 |  */
  139 | test("records a checkout payment in the admin ledger", async ({ page }) => {
  140 |   /* Wide enough for the header to show the bag rather than collapse it. */
  141 |   await page.setViewportSize({ width: 1440, height: 1000 });
  142 |   await signInCustomer(page, "/product/afterdark-hoodie");
  143 | 
  144 |   const product = page.locator(".pdp");
  145 |   await product.getByRole("button", { name: "M", exact: true }).click();
  146 |   await product.getByRole("button", { name: "Add to bag" }).click();
  147 | 
  148 |   /* Straight from the drawer that adding opens, which is how a shopper gets
  149 |      there — and no page load, so the in-memory customer session survives. */
  150 |   await page.getByRole("button", { name: "Secure checkout" }).click();
  151 | 
  152 |   /* Contact and address arrive pre-filled from the profile, so the steps are
  153 |      answered already — Continue walks them to the one that is not. */
  154 |   const cod = page.getByText("Pay the courier when the parcel arrives");
  155 |   for (let step = 0; step < 3 && !(await cod.isVisible()); step += 1) {
  156 |     await page.getByRole("button", { name: "Continue" }).click();
  157 |   }
  158 | 
  159 |   await cod.click();
  160 |   await page.getByRole("button", { name: /^Checkout · / }).click();
  161 | 
  162 |   await page.waitForURL(/\/orders\/ord-local-\d+/);
  163 |   const heading = page.getByRole("heading", { level: 1, name: /^Order IO-/ });
  164 |   await expect(heading).toBeVisible();
  165 |   const number = (await heading.innerText()).match(/IO-\d{4}-\d+/)?.[0];
  166 |   expect(number, "the order screen names the order it just placed").toBeTruthy();
  167 | 
  168 |   /* The ledger lives in this browser, so the same order is waiting in the
  169 |      console — under a staff sign-in of its own, which the shopper's session
  170 |      has nothing to do with. */
  171 |   await page.goto("/admin/payments");
  172 |   await page.getByRole("button", { name: /Enter console/ }).click();
  173 |   await page.waitForURL("**/admin/payments");
  174 | 
  175 |   const row = page.getByRole("row").filter({ hasText: number! });
  176 |   await expect(row).toContainText("Cash on delivery");
  177 |   await expect(row).toContainText("Due");
  178 | 
  179 |   /* And the one verb it offers settles it. */
  180 |   await row.getByRole("button", { name: /Mark .* collected/ }).click();
  181 |   await expect(row).toContainText("Captured");
  182 | });
  183 | 
  184 | test("supports product evaluation before the customer gate", async ({ page }) => {
  185 |   await page.goto("/product/afterdark-hoodie");
  186 |   const product = page.locator(".pdp");
  187 |   await expect(product.getByRole("heading", { name: "Afterdark Hoodie" })).toBeVisible();
  188 |   await expect(product.getByRole("button", { name: "XS, sold out" })).toBeDisabled();
  189 |   await expect(product.getByRole("button", { name: "Select a size" })).toBeDisabled();
  190 |   await product.getByRole("button", { name: "L", exact: true }).click();
  191 |   await expect(product.getByText("Only 2 left in this size.")).toBeVisible();
  192 |   await expect(product.getByRole("button", { name: "Add to bag" })).toBeEnabled();
  193 | });
  194 | 
  195 | test("shows privacy-safe public shipment tracking", async ({ page }) => {
  196 |   await page.goto("/track/track-1048-demo");
  197 |   await expect(page.getByRole("heading", { name: "In transit." })).toBeVisible();
  198 |   await expect(page.getByText("Tokenized shipment tracking")).toBeVisible();
  199 |   await expect(page.getByText(/no customer name, street address, mobile number, or payment data/i)).toBeVisible();
  200 | });
  201 | 
```