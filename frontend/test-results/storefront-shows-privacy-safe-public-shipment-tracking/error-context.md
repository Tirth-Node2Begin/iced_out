# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: storefront.spec.ts >> shows privacy-safe public shipment tracking
- Location: e2e\storefront.spec.ts:191:5

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
- region "Notifications alt+T"
- alert
```

# Test source

```ts
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
  127 | /**
  128 |  * The one thing that makes the payments module a ledger rather than a
  129 |  * demonstration: money a shopper owes shows up in the back office.
  130 |  *
  131 |  * Cash on delivery is the case worth pinning. It is the outcome that used to
  132 |  * write nothing at all — no gateway was asked, so nothing was recorded — and
  133 |  * it is the only one that reaches the console still owing money.
  134 |  */
  135 | test("records a checkout payment in the admin ledger", async ({ page }) => {
  136 |   /* Wide enough for the header to show the bag rather than collapse it. */
  137 |   await page.setViewportSize({ width: 1440, height: 1000 });
  138 |   await signInCustomer(page, "/product/afterdark-hoodie");
  139 | 
  140 |   const product = page.locator(".pdp");
  141 |   await product.getByRole("button", { name: "M", exact: true }).click();
  142 |   await product.getByRole("button", { name: "Add to bag" }).click();
  143 | 
  144 |   /* Straight from the drawer that adding opens, which is how a shopper gets
  145 |      there — and no page load, so the in-memory customer session survives. */
  146 |   await page.getByRole("button", { name: "Secure checkout" }).click();
  147 | 
  148 |   /* Contact and address arrive pre-filled from the profile, so the steps are
  149 |      answered already — Continue walks them to the one that is not. */
  150 |   const cod = page.getByText("Pay the courier when the parcel arrives");
  151 |   for (let step = 0; step < 3 && !(await cod.isVisible()); step += 1) {
  152 |     await page.getByRole("button", { name: "Continue" }).click();
  153 |   }
  154 | 
  155 |   await cod.click();
  156 |   await page.getByRole("button", { name: /^Checkout · / }).click();
  157 | 
  158 |   await page.waitForURL(/\/orders\/ord-local-\d+/);
  159 |   const heading = page.getByRole("heading", { level: 1, name: /^Order IO-/ });
  160 |   await expect(heading).toBeVisible();
  161 |   const number = (await heading.innerText()).match(/IO-\d{4}-\d+/)?.[0];
  162 |   expect(number, "the order screen names the order it just placed").toBeTruthy();
  163 | 
  164 |   /* The ledger lives in this browser, so the same order is waiting in the
  165 |      console — under a staff sign-in of its own, which the shopper's session
  166 |      has nothing to do with. */
  167 |   await page.goto("/admin/payments");
  168 |   await page.getByRole("button", { name: /Enter console/ }).click();
  169 |   await page.waitForURL("**/admin/payments");
  170 | 
  171 |   const row = page.getByRole("row").filter({ hasText: number! });
  172 |   await expect(row).toContainText("Cash on delivery");
  173 |   await expect(row).toContainText("Due");
  174 | 
  175 |   /* And the one verb it offers settles it. */
  176 |   await row.getByRole("button", { name: /Mark .* collected/ }).click();
  177 |   await expect(row).toContainText("Captured");
  178 | });
  179 | 
  180 | test("supports product evaluation before the customer gate", async ({ page }) => {
  181 |   await page.goto("/product/afterdark-hoodie");
  182 |   const product = page.locator(".pdp");
  183 |   await expect(product.getByRole("heading", { name: "Afterdark Hoodie" })).toBeVisible();
  184 |   await expect(product.getByRole("button", { name: "XS, sold out" })).toBeDisabled();
  185 |   await expect(product.getByRole("button", { name: "Select a size" })).toBeDisabled();
  186 |   await product.getByRole("button", { name: "L", exact: true }).click();
  187 |   await expect(product.getByText("Only 2 left in this size.")).toBeVisible();
  188 |   await expect(product.getByRole("button", { name: "Add to bag" })).toBeEnabled();
  189 | });
  190 | 
  191 | test("shows privacy-safe public shipment tracking", async ({ page }) => {
  192 |   await page.goto("/track/track-1048-demo");
> 193 |   await expect(page.getByRole("heading", { name: "In transit." })).toBeVisible();
      |                                                                    ^ Error: expect(locator).toBeVisible() failed
  194 |   await expect(page.getByText("Tokenized shipment tracking")).toBeVisible();
  195 |   await expect(page.getByText(/no customer name, street address, mobile number, or payment data/i)).toBeVisible();
  196 | });
  197 | 
  198 | test("keeps customer account navigation and lifecycle actions usable", async ({ page }) => {
  199 |   // Signed in, the bar drops its only action, so the auth page's returnTo is
  200 |   // what carries the shopper to /account.
  201 |   await signInCustomer(page, "/account");
  202 |   await page.waitForURL("**/account");
  203 |   await expect(page.getByRole("heading", { name: "Good evening." })).toBeVisible();
  204 | 
  205 |   const accountNavigation = page.getByRole("navigation", { name: "Account navigation" });
  206 |   await accountNavigation.getByRole("link", { name: "Orders", exact: true }).click();
  207 |   await expect(page.getByRole("heading", { name: "Orders." })).toBeVisible();
  208 |   await page.getByRole("link", { name: "IO-2026-1027" }).click();
  209 |   await expect(page.getByRole("heading", { name: "IO-2026-1027" })).toBeVisible();
  210 |   await page.getByRole("link", { name: "Start a return" }).click();
  211 |   await expect(page.getByRole("heading", { name: "Start a return." })).toBeVisible();
  212 | 
  213 |   await accountNavigation.getByRole("link", { name: "Support", exact: true }).click();
  214 |   await expect(page.getByRole("heading", { name: "How can we help?" })).toBeVisible();
  215 | });
  216 | 
  217 | test("preserves staff access across operations workspaces", async ({ page }) => {
  218 |   await page.goto("/admin/orders");
  219 |   await page.waitForURL("**/admin/login?returnTo=%2Fadmin%2Forders");
  220 |   await page.getByRole("button", { name: /Open permitted workspace/ }).click();
  221 |   await expect(page.getByRole("heading", { name: "Orders", exact: true })).toBeVisible();
  222 | 
  223 |   await page.getByRole("link", { name: "Support", exact: true }).click();
  224 |   await page.waitForURL("**/admin/support/tickets");
  225 |   await expect(page.getByRole("heading", { name: "Keep the context." })).toBeVisible();
  226 |   await expect(page.getByText("Permission-masked context")).toBeVisible();
  227 | });
  228 | 
  229 | test("serves versioned policy and staff recovery pages", async ({ page }) => {
  230 |   await page.goto("/pages/return-policy");
  231 |   await expect(page.getByRole("heading", { name: "Return policy." })).toBeVisible();
  232 |   await expect(page.getByRole("heading", { name: "Evidence and quality control" })).toBeVisible();
  233 | 
  234 |   await page.goto("/admin/forgot-password");
  235 |   await expect(page.getByRole("heading", { name: "Recover access." })).toBeVisible();
  236 |   await expect(page.getByText(/No credential or recovery request leaves this browser/)).toBeVisible();
  237 | });
  238 | 
  239 | test("covers the remaining planned admin module families", async ({ page }) => {
  240 |   await page.goto("/admin/notifications/templates");
  241 |   await page.waitForURL("**/admin/login?returnTo=%2Fadmin%2Fnotifications%2Ftemplates");
  242 |   await page.getByRole("button", { name: /Enter console/ }).click();
  243 |   await expect(page.getByRole("heading", { level: 1, name: "Transactional clarity" })).toBeVisible();
  244 | 
  245 |   await page.getByRole("link", { name: "Inventory", exact: true }).click();
  246 |   await expect(page.getByRole("heading", { level: 1, name: "Stock truth" })).toBeVisible();
  247 |   await page.getByRole("link", { name: "Transfers", exact: true }).click();
  248 |   await expect(page.getByRole("heading", { level: 1, name: "Move with custody" })).toBeVisible();
  249 |   await page.getByRole("link", { name: "Settings", exact: true }).click();
  250 |   await expect(page.getByRole("heading", { level: 1, name: "Business controls" })).toBeVisible();
  251 |   await page.getByRole("link", { name: "Tax", exact: true }).click();
  252 |   /* Pinned to the page heading: the tax screen also carries a section called
  253 |      "Tax configuration", and an unqualified name would match both. */
  254 |   await expect(page.getByRole("heading", { level: 1, name: "Tax configuration" })).toBeVisible();
  255 | });
  256 | 
  257 | test("opens the profile from the account menu and pages its activity log", async ({ page }) => {
  258 |   await page.goto("/admin/orders");
  259 |   await page.waitForURL("**/admin/login?returnTo=%2Fadmin%2Forders");
  260 |   await page.getByRole("button", { name: /Enter console/ }).click();
  261 | 
  262 |   /* Reached the way an operator reaches it, through the account chip. Not
  263 |      `page.goto`: a staff session is deliberately never persisted, so a full
  264 |      page load would land back on the login screen. */
  265 |   await page.getByRole("button", { name: /Aarav D\./ }).click();
  266 |   await page.getByRole("menuitem", { name: "Your profile" }).click();
  267 |   await expect(page.getByRole("heading", { name: /Your profile/ })).toBeVisible();
  268 | 
  269 |   /* Five rows on the page and the rest behind the modal — that split is the
  270 |      point of the screen, so the counts are asserted rather than assumed. */
  271 |   await expect(page.locator("table.aui-table tbody tr")).toHaveCount(5);
  272 |   await page.getByRole("button", { name: /See more/ }).click();
  273 | 
  274 |   const log = page.getByRole("dialog");
  275 |   await expect(log.getByRole("heading", { name: "Full activity log" })).toBeVisible();
  276 |   await expect(log.locator("tbody tr")).toHaveCount(12);
  277 | 
  278 |   await page.keyboard.press("Escape");
  279 |   await expect(log).toBeHidden();
  280 | });
  281 | 
```