# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: storefront.spec.ts >> serves the approved public destinations
- Location: e2e\storefront.spec.ts:83:5

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
  - button "Open menu"
- main:
  - heading "Menswear built to move Every Season!" [level=1]
  - link "Shop menswear":
    - /url: /collections
  - link "View sale":
    - /url: /sale
  - img "Iced_out winter training kit"
  - paragraph: 01 / Men _2025
  - paragraph: "Fit: Regular"
  - paragraph: Cut for how men actually train. Shells that break the wind, mid-layers that still breathe under them, and joggers with room to drive through the last set.
  - button "Play the campaign film"
  - img "Training short, detail"
  - img "Winter shell, studio"
  - img "Layering system, detail"
  - paragraph: Men's outerwear for the cold months — taped seams, brushed linings, and a shoulder cut that never fights the sleeve.
  - paragraph: "Performance-driven menswear: tees, joggers, thermals, and shells, sized S through XXL."
  - paragraph: The men's edit
  - heading "Twenty pieces cut for weight and movement" [level=2]
  - paragraph: Drop 001
  - region "Filter the men's edit":
    - radiogroup "Filter by category":
      - radio "All pieces" [checked]
      - radio "Outerwear"
      - radio "Knitwear"
      - radio "Trousers"
      - radio "Tops"
      - radio "Accessories"
    - checkbox "In stock"
    - checkbox "New in"
    - button "Sort products — Featured": Sort Featured
    - paragraph: 20 / 20 pieces
  - article:
    - img "Afterdark Hoodie"
    - link "Afterdark Hoodie, ₹8,900 — view product":
      - /url: /new-man/afterdark-hoodie
    - button "Save Afterdark Hoodie"
    - button "Quick view Afterdark Hoodie"
    - text: "₹8,900 MRP: ₹10,200 13% OFF"
    - link "Afterdark Hoodie":
      - /url: /new-man/afterdark-hoodie
  - article:
    - img "Shadow Cargo 02"
    - link "Shadow Cargo 02, ₹9,800 — view product":
      - /url: /new-man/shadow-cargo-02
    - text: New
    - button "Save Shadow Cargo 02"
    - button "Quick view Shadow Cargo 02"
    - text: "₹9,800 MRP: ₹19,600 50% OFF"
    - link "Shadow Cargo 02":
      - /url: /new-man/shadow-cargo-02
  - article:
    - img "Bone Utility Overshirt"
    - link "Bone Utility Overshirt, ₹11,400 — view product":
      - /url: /new-man/bone-utility-overshirt
    - text: New
    - button "Save Bone Utility Overshirt"
    - button "Quick view Bone Utility Overshirt"
    - text: "₹11,400 MRP: ₹25,330 55% OFF"
    - link "Bone Utility Overshirt":
      - /url: /new-man/bone-utility-overshirt
  - article:
    - img "Core Heavy Tee"
    - link "Core Heavy Tee, ₹4,200 — view product":
      - /url: /new-man/core-heavy-tee
    - button "Save Core Heavy Tee"
    - button "Quick view Core Heavy Tee"
    - text: "₹4,200 MRP: ₹10,500 60% OFF"
    - link "Core Heavy Tee":
      - /url: /new-man/core-heavy-tee
  - article:
    - img "Nightshift Overcoat"
    - link "Nightshift Overcoat, ₹18,600 — view product":
      - /url: /new-man/nightshift-overcoat
    - button "Save Nightshift Overcoat"
    - button "Quick view Nightshift Overcoat"
    - text: "₹18,600 MRP: ₹26,570 30% OFF"
    - link "Nightshift Overcoat":
      - /url: /new-man/nightshift-overcoat
  - article:
    - img "Concrete Zip Hood"
    - link "Concrete Zip Hood, ₹10,400 — view product":
      - /url: /new-man/concrete-zip-hood
    - button "Save Concrete Zip Hood"
    - button "Quick view Concrete Zip Hood"
    - text: "₹10,400 MRP: ₹17,330 40% OFF"
    - link "Concrete Zip Hood":
      - /url: /new-man/concrete-zip-hood
  - article:
    - img "Ballast Cargo Pant"
    - link "Ballast Cargo Pant, ₹9,200 — view product":
      - /url: /new-man/ballast-cargo-pant
    - button "Save Ballast Cargo Pant"
    - button "Quick view Ballast Cargo Pant"
    - text: "₹9,200 MRP: ₹16,730 45% OFF"
    - link "Ballast Cargo Pant":
      - /url: /new-man/ballast-cargo-pant
  - article:
    - img "Vault Carry Pouch"
    - link "Vault Carry Pouch, ₹3,800 — view product":
      - /url: /new-man/vault-carry-pouch
    - text: New
    - button "Save Vault Carry Pouch"
    - button "Quick view Vault Carry Pouch"
    - text: "₹3,800 MRP: ₹7,600 50% OFF"
    - link "Vault Carry Pouch":
      - /url: /new-man/vault-carry-pouch
  - article:
    - img "Chain Link Set"
    - link "Chain Link Set, ₹2,600 — view product":
      - /url: /new-man/chain-link-set
    - button "Save Chain Link Set"
    - button "Quick view Chain Link Set"
    - text: "₹2,600 MRP: ₹5,780 55% OFF"
    - link "Chain Link Set":
      - /url: /new-man/chain-link-set
  - article:
    - img "Gravel Wash Hoodie"
    - link "Gravel Wash Hoodie, ₹8,600 — view product":
      - /url: /new-man/gravel-wash-hoodie
    - button "Save Gravel Wash Hoodie"
    - button "Quick view Gravel Wash Hoodie"
    - text: "₹8,600 MRP: ₹15,640 45% OFF"
    - link "Gravel Wash Hoodie":
      - /url: /new-man/gravel-wash-hoodie
  - article:
    - img "Bone Field Jacket"
    - link "Bone Field Jacket, ₹13,900 — view product":
      - /url: /new-man/bone-field-jacket
    - text: Sold out
    - button "Save Bone Field Jacket"
    - button "Quick view Bone Field Jacket"
    - text: "₹13,900 MRP: ₹27,800 50% OFF"
    - link "Bone Field Jacket":
      - /url: /new-man/bone-field-jacket
  - article:
    - img "Signal Boot"
    - link "Signal Boot, ₹15,400 — view product":
      - /url: /new-man/signal-boot
    - button "Save Signal Boot"
    - button "Quick view Signal Boot"
    - text: "₹15,400 MRP: ₹34,220 55% OFF"
    - link "Signal Boot":
      - /url: /new-man/signal-boot
  - button "Load 8 more"
  - paragraph: Showing 12 of 20
  - list:
    - listitem: 01 Sized XS — XL Graded on a real curve, with the fit noted on every product page.
    - listitem: 02 Free shipping over ₹4,999 Dispatched from the Bengaluru studio within two working days.
    - listitem: 03 30-day returns Unworn, tags on. Exchanges are free once per order.
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
> 97  |     await expect(page.getByRole("heading", { name: heading })).toBeVisible();
      |                                                                ^ Error: expect(locator).toBeVisible() failed
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
  110 |   await page.getByRole("button", { name: /Open permitted workspace/ }).click();
  111 |   await page.waitForURL("**/admin/payments");
  112 |   await expect(page.getByRole("heading", { name: "Payments", exact: true })).toBeVisible();
  113 |   await page.getByRole("link", { name: "Transactions" }).click();
  114 |   await expect(page.getByRole("heading", { name: "Transactions" })).toBeVisible();
  115 |   await page.getByRole("link", { name: "pay_ICE1048" }).click();
  116 |   await page.waitForURL("**/admin/payments/transactions/pay_ICE1048");
  117 |   await expect(page.getByRole("heading", { name: "pay_ICE1048" })).toBeVisible();
  118 |   await page.getByRole("link", { name: "Mismatches", exact: true }).click();
  119 |   await expect(page.getByRole("heading", { name: "Mismatches" })).toBeVisible();
  120 |   await page.getByRole("link", { name: "Reconciliation", exact: true }).click();
  121 |   await expect(page.getByRole("heading", { name: "Reconciliation", exact: true })).toBeVisible();
  122 |   await page.getByRole("link", { name: "Settlements", exact: true }).click();
  123 |   await expect(page.getByRole("heading", { name: "Settlements" })).toBeVisible();
  124 | });
  125 | 
  126 | test("supports product evaluation before the customer gate", async ({ page }) => {
  127 |   await page.goto("/product/afterdark-hoodie");
  128 |   const product = page.locator(".pdp");
  129 |   await expect(product.getByRole("heading", { name: "Afterdark Hoodie" })).toBeVisible();
  130 |   await expect(product.getByRole("button", { name: "XS, sold out" })).toBeDisabled();
  131 |   await expect(product.getByRole("button", { name: "Select a size" })).toBeDisabled();
  132 |   await product.getByRole("button", { name: "L", exact: true }).click();
  133 |   await expect(product.getByText("Only 2 left in this size.")).toBeVisible();
  134 |   await expect(product.getByRole("button", { name: "Add to bag" })).toBeEnabled();
  135 | });
  136 | 
  137 | test("shows privacy-safe public shipment tracking", async ({ page }) => {
  138 |   await page.goto("/track/track-1048-demo");
  139 |   await expect(page.getByRole("heading", { name: "In transit." })).toBeVisible();
  140 |   await expect(page.getByText("Tokenized shipment tracking")).toBeVisible();
  141 |   await expect(page.getByText(/no customer name, street address, mobile number, or payment data/i)).toBeVisible();
  142 | });
  143 | 
  144 | test("keeps customer account navigation and lifecycle actions usable", async ({ page }) => {
  145 |   // Signed in, the bar drops its only action, so the auth page's returnTo is
  146 |   // what carries the shopper to /account.
  147 |   await signInCustomer(page, "/account");
  148 |   await page.waitForURL("**/account");
  149 |   await expect(page.getByRole("heading", { name: "Good evening." })).toBeVisible();
  150 | 
  151 |   const accountNavigation = page.getByRole("navigation", { name: "Account navigation" });
  152 |   await accountNavigation.getByRole("link", { name: "Orders", exact: true }).click();
  153 |   await expect(page.getByRole("heading", { name: "Orders." })).toBeVisible();
  154 |   await page.getByRole("link", { name: "IO-2026-1027" }).click();
  155 |   await expect(page.getByRole("heading", { name: "IO-2026-1027" })).toBeVisible();
  156 |   await page.getByRole("link", { name: "Start a return" }).click();
  157 |   await expect(page.getByRole("heading", { name: "Start a return." })).toBeVisible();
  158 | 
  159 |   await accountNavigation.getByRole("link", { name: "Support", exact: true }).click();
  160 |   await expect(page.getByRole("heading", { name: "How can we help?" })).toBeVisible();
  161 | });
  162 | 
  163 | test("preserves staff access across operations workspaces", async ({ page }) => {
  164 |   await page.goto("/admin/orders");
  165 |   await page.waitForURL("**/admin/login?returnTo=%2Fadmin%2Forders");
  166 |   await page.getByRole("button", { name: /Open permitted workspace/ }).click();
  167 |   await expect(page.getByRole("heading", { name: "Orders", exact: true })).toBeVisible();
  168 | 
  169 |   await page.getByRole("link", { name: "Support", exact: true }).click();
  170 |   await page.waitForURL("**/admin/support/tickets");
  171 |   await expect(page.getByRole("heading", { name: "Keep the context." })).toBeVisible();
  172 |   await expect(page.getByText("Permission-masked context")).toBeVisible();
  173 | });
  174 | 
  175 | test("serves versioned policy and staff recovery pages", async ({ page }) => {
  176 |   await page.goto("/pages/return-policy");
  177 |   await expect(page.getByRole("heading", { name: "Return policy." })).toBeVisible();
  178 |   await expect(page.getByRole("heading", { name: "Evidence and quality control" })).toBeVisible();
  179 | 
  180 |   await page.goto("/admin/forgot-password");
  181 |   await expect(page.getByRole("heading", { name: "Recover access." })).toBeVisible();
  182 |   await expect(page.getByText(/No credential or recovery request leaves this browser/)).toBeVisible();
  183 | });
  184 | 
  185 | test("covers the remaining planned admin module families", async ({ page }) => {
  186 |   await page.goto("/admin/marketing/coupons");
  187 |   await page.waitForURL("**/admin/login?returnTo=%2Fadmin%2Fmarketing%2Fcoupons");
  188 |   await page.getByRole("button", { name: /Open permitted workspace/ }).click();
  189 |   await expect(page.getByRole("heading", { name: "Build a promise you can keep." })).toBeVisible();
  190 | 
  191 |   await page.getByRole("link", { name: "campaigns", exact: true }).click();
  192 |   await expect(page.getByRole("heading", { name: "Release with intent." })).toBeVisible();
  193 |   await page.getByRole("link", { name: "Messages", exact: true }).click();
  194 |   await expect(page.getByRole("heading", { name: "Transactional clarity." })).toBeVisible();
  195 |   await page.getByRole("link", { name: "Inventory", exact: true }).click();
  196 |   await expect(page.getByRole("heading", { name: "Stock truth" })).toBeVisible();
  197 |   await page.getByRole("link", { name: "counts", exact: true }).click();
```