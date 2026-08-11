# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: storefront.spec.ts >> shows privacy-safe public shipment tracking
- Location: e2e\storefront.spec.ts:137:5

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('heading', { name: 'In transit.' })
Expected: visible
Timeout: 15000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 15000ms
  - waiting for getByRole('heading', { name: 'In transit.' })

```

```yaml
- alert
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
    - /url: /auth/login?returnTo=%2Ftrack%2Ftrack-1048-demo
- main:
  - link "Go back to Iced_out":
    - /url: /
    - text: Go back Iced_out
  - text: Shipment tracking Order IO-2026-1048 Live carrier signal
  - heading "Expected 08–09 Aug" [level=1]:
    - text: Expected
    - emphasis: 08–09 Aug
  - text: Steps 03/05 Route 60%
  - paragraph: Nothing below is marked done before it happens. This public view carries no name, address, mobile number or payment detail.
  - text: Route Newest event last · times are IST
  - list:
    - listitem:
      - heading "Order confirmed" [level=2]
      - paragraph: Payment and inventory reservation verified
      - text: 04 Aug · 14:32
    - listitem:
      - heading "Packed" [level=2]
      - paragraph: Package passed the scan-to-pack check
      - text: 05 Aug · 10:18
    - listitem:
      - heading "Courier handoff" [level=2]
      - paragraph: Collected from the fulfilment centre
      - text: 05 Aug · 18:06
    - listitem:
      - heading "In transit" [level=2]
      - paragraph: Moving through the destination network
      - text: Latest provider update
    - listitem:
      - heading "Delivered" [level=2]
      - paragraph: Proof of delivery will appear here
      - text: Expected 08–09 Aug
  - text: Shipment reference IO-2026-1048 Route complete 3 of 5 steps
  - progressbar "Route completion"
  - text: In transit
  - paragraph: Status
  - text: Bengaluru, Karnataka
  - paragraph: Destination
  - text: Blue Dart
  - paragraph: Carrier
  - text: AWB ••••1048
  - paragraph: Reference
  - text: Synced 2 min ago
  - paragraph: Last update
  - text: About this link
  - paragraph: Anyone holding this link can see the route above and nothing else. Tokens will be hashed, revocable and rate-limited once the carrier API lands. If the parcel is late or the route looks wrong, the desk answers within two business days.
  - link "Delivery support":
    - /url: /contact
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
> 139 |   await expect(page.getByRole("heading", { name: "In transit." })).toBeVisible();
      |                                                                    ^ Error: expect(locator).toBeVisible() failed
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
  198 |   await expect(page.getByRole("heading", { name: "Count what is there." })).toBeVisible();
  199 |   await page.getByRole("link", { name: "Access", exact: true }).click();
  200 |   await expect(page.getByRole("heading", { name: "People and permission." })).toBeVisible();
  201 |   await page.getByRole("link", { name: "roles", exact: true }).click();
  202 |   await expect(page.getByRole("heading", { name: "Bundle, never assume." })).toBeVisible();
  203 |   await page.getByRole("link", { name: "Settings", exact: true }).click();
  204 |   await expect(page.getByRole("heading", { name: "Business controls." })).toBeVisible();
  205 |   await page.getByRole("link", { name: "tax", exact: true }).click();
  206 |   await expect(page.getByRole("heading", { name: "Tax configuration." })).toBeVisible();
  207 | });
  208 | 
```