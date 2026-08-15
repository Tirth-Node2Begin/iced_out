import { expect, test, type Page } from "@playwright/test";

/**
 * Signs in through the real auth page and lands on `returnTo`. The session is
 * in-memory, so the test has to arrive at its destination from here — a fresh
 * page.goto() would drop it and bounce back through the guard.
 */
async function signInCustomer(page: Page, returnTo = "/") {
  await page.goto("/new-drop");
  await page.getByRole("link", { name: "Login" }).click();
  if (returnTo !== "/") {
    await page.goto(`/auth/login?returnTo=${encodeURIComponent(returnTo)}`);
  }
  await page.getByLabel("Email address").fill("shopper@example.com");
  // `getByLabel("Password")` also matches the field's "Show password" reveal
  // button, which resolves two elements and fails strict mode before the form
  // is ever filled.
  await page.getByRole("textbox", { name: "Password" }).fill("secret1");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
}

test("allows guest wishlist but gates the bag behind login", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");

  await expect(page.getByRole("heading", { name: /cold by nature/i })).toBeVisible();
  await expect(page.getByText("Drop 001 / Live now")).toBeVisible();

  const firstProduct = page.locator(".product-card").first();
  await firstProduct.scrollIntoViewIfNeeded();
  await firstProduct.hover();
  await firstProduct.getByRole("button", { name: /Save Afterdark Hoodie/ }).click();
  await expect(firstProduct.getByRole("button", { name: /Remove Afterdark Hoodie/ })).toBeVisible();
  await firstProduct
    .locator('[aria-label="Choose a size for Afterdark Hoodie"]')
    .getByRole("button", { name: "M", exact: true })
    .click();
  await firstProduct.getByRole("button", { name: "Add to bag" }).click();

  // Gated actions route to the real sign-in page instead of opening a modal.
  await expect(page).toHaveURL(/\/auth\/login\?returnTo=/);
  await expect(page.getByRole("heading", { name: /SIGN IN\./ })).toBeVisible();
  await page.getByLabel("Email address").fill("shopper@example.com");
  // `getByLabel("Password")` also matches the field's "Show password" reveal
  // button, which resolves two elements and fails strict mode before the form
  // is ever filled.
  await page.getByRole("textbox", { name: "Password" }).fill("secret1");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("/");

  await page.getByRole("button", { name: "Bottoms" }).click();
  const productGrid = page.locator(".product-grid");
  await expect(productGrid.getByText("Shadow Cargo 02")).toBeVisible();
  await expect(productGrid.getByText("Afterdark Hoodie")).toHaveCount(0);
});

test("falls back to the footer for navigation on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/new-drop");

  // The shared bar drops both rails below 860px — the same behaviour it has on
  // the new home — so the footer is what carries the destinations there.
  await expect(page.getByRole("navigation", { name: "Primary navigation" })).toBeHidden();
  await expect(page.locator(".nh-nav__wordmark")).toBeVisible();

  // One footer serves the whole site now (`components/layout/site-footer`), so
  // these are its labels rather than the listing pages' old private set.
  const footer = page.getByRole("contentinfo");
  for (const label of [
    "Men",
    "Women",
    "Accessories",
    "Seasonal",
    "Shipping",
    "Returns",
    "Contact",
    "About",
  ]) {
    await expect(footer.getByRole("link", { name: label, exact: true })).toBeVisible();
  }
});

test("serves the approved public destinations", async ({ page }) => {
  test.setTimeout(240_000);
  for (const [path, heading] of [
    // /new-drop now serves the men's listing; /men is gone.
    ["/new-drop", "Built for the Men Who Move After Dark"],
    ["/women", "Structured Volume for the Women Who Set the Pace"],
    ["/new-man", "Gear up every season"],
    ["/new-woman", "Gear up every season"],
    ["/collections", "Collections."],
    ["/sale", "Sale."],
    ["/about", "Cold by nature. Built with intent."],
    ["/contact", "Start with context. Not a queue."],
  ]) {
    await page.goto(path, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: heading })).toBeVisible();
  }
});

test("blocks direct guest checkout", async ({ page }) => {
  await page.goto("/checkout");
  await page.waitForURL("**/auth/login?returnTo=%2Fcheckout");
  await expect(page.getByRole("heading", { name: "Sign in." })).toBeVisible();
});

test("provides the complete admin payments workspace", async ({ page }) => {
  await page.goto("/admin/payments");
  await page.waitForURL("**/admin/login?returnTo=%2Fadmin%2Fpayments");
  await page.getByRole("button", { name: /Enter console/ }).click();
  await page.waitForURL("**/admin/payments");
  await expect(page.getByRole("heading", { name: "Payments ledger" })).toBeVisible();
  /* Both screens the area has left — money in, and money on to the bank.
     Refunds moved to Returns, which is where a refund is decided. Scoped to
     the toolbar pill: the console rail also carries a "Payments" link, and an
     unqualified name matches both. */
  const tabs = page.getByRole("navigation", { name: "Payments screens" });
  await tabs.getByRole("link", { name: "Payouts", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Gateway payouts" })).toBeVisible();
  await tabs.getByRole("link", { name: "Payments", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Payments ledger" })).toBeVisible();
  await page.getByRole("link", { name: "Open pay_ICE1048" }).click();
  await page.waitForURL("**/admin/payments/pay_ICE1048");
  await expect(page.getByRole("heading", { name: "Payment pay_ICE1048" })).toBeVisible();
});

/**
 * The one thing that makes the payments module a ledger rather than a
 * demonstration: money a shopper owes shows up in the back office.
 *
 * Cash on delivery is the case worth pinning. It is the outcome that used to
 * write nothing at all — no gateway was asked, so nothing was recorded — and
 * it is the only one that reaches the console still owing money.
 */
test("records a checkout payment in the admin ledger", async ({ page }) => {
  /* Wide enough for the header to show the bag rather than collapse it. */
  await page.setViewportSize({ width: 1440, height: 1000 });
  await signInCustomer(page, "/product/afterdark-hoodie");

  const product = page.locator(".pdp");
  await product.getByRole("button", { name: "M", exact: true }).click();
  await product.getByRole("button", { name: "Add to bag" }).click();

  /* Straight from the drawer that adding opens, which is how a shopper gets
     there — and no page load, so the in-memory customer session survives. */
  await page.getByRole("button", { name: "Secure checkout" }).click();

  /* Contact and address arrive pre-filled from the profile, so the steps are
     answered already — Continue walks them to the one that is not. */
  const cod = page.getByText("Pay the courier when the parcel arrives");
  for (let step = 0; step < 3 && !(await cod.isVisible()); step += 1) {
    await page.getByRole("button", { name: "Continue" }).click();
  }

  await cod.click();
  await page.getByRole("button", { name: /^Checkout · / }).click();

  await page.waitForURL(/\/orders\/ord-local-\d+/);
  const heading = page.getByRole("heading", { level: 1, name: /^Order IO-/ });
  await expect(heading).toBeVisible();
  const number = (await heading.innerText()).match(/IO-\d{4}-\d+/)?.[0];
  expect(number, "the order screen names the order it just placed").toBeTruthy();

  /* The ledger lives in this browser, so the same order is waiting in the
     console — under a staff sign-in of its own, which the shopper's session
     has nothing to do with. */
  await page.goto("/admin/payments");
  await page.getByRole("button", { name: /Enter console/ }).click();
  await page.waitForURL("**/admin/payments");

  const row = page.getByRole("row").filter({ hasText: number! });
  await expect(row).toContainText("Cash on delivery");
  await expect(row).toContainText("Due");

  /* And the one verb it offers settles it. */
  await row.getByRole("button", { name: /Mark .* collected/ }).click();
  await expect(row).toContainText("Captured");
});

test("supports product evaluation before the customer gate", async ({ page }) => {
  await page.goto("/product/afterdark-hoodie");
  const product = page.locator(".pdp");
  await expect(product.getByRole("heading", { name: "Afterdark Hoodie" })).toBeVisible();
  await expect(product.getByRole("button", { name: "XS, sold out" })).toBeDisabled();
  await expect(product.getByRole("button", { name: "Select a size" })).toBeDisabled();
  await product.getByRole("button", { name: "L", exact: true }).click();
  await expect(product.getByText("Only 2 left in this size.")).toBeVisible();
  await expect(product.getByRole("button", { name: "Add to bag" })).toBeEnabled();
});

test("shows privacy-safe public shipment tracking", async ({ page }) => {
  await page.goto("/track/track-1048-demo");
  await expect(page.getByRole("heading", { name: "In transit." })).toBeVisible();
  await expect(page.getByText("Tokenized shipment tracking")).toBeVisible();
  await expect(page.getByText(/no customer name, street address, mobile number, or payment data/i)).toBeVisible();
});

test("keeps customer account navigation and lifecycle actions usable", async ({ page }) => {
  // Signed in, the bar drops its only action, so the auth page's returnTo is
  // what carries the shopper to /account.
  await signInCustomer(page, "/account");
  await page.waitForURL("**/account");
  await expect(page.getByRole("heading", { name: "Good evening." })).toBeVisible();

  const accountNavigation = page.getByRole("navigation", { name: "Account navigation" });
  await accountNavigation.getByRole("link", { name: "Orders", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Orders." })).toBeVisible();
  await page.getByRole("link", { name: "IO-2026-1027" }).click();
  await expect(page.getByRole("heading", { name: "IO-2026-1027" })).toBeVisible();
  await page.getByRole("link", { name: "Start a return" }).click();
  await expect(page.getByRole("heading", { name: "Start a return." })).toBeVisible();

  await accountNavigation.getByRole("link", { name: "Support", exact: true }).click();
  await expect(page.getByRole("heading", { name: "How can we help?" })).toBeVisible();
});

test("preserves staff access across operations workspaces", async ({ page }) => {
  await page.goto("/admin/orders");
  await page.waitForURL("**/admin/login?returnTo=%2Fadmin%2Forders");
  await page.getByRole("button", { name: /Open permitted workspace/ }).click();
  await expect(page.getByRole("heading", { name: "Orders", exact: true })).toBeVisible();

  await page.getByRole("link", { name: "Support", exact: true }).click();
  await page.waitForURL("**/admin/support");
  await expect(page.getByRole("heading", { name: "Customer queries" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Queries from customers" })).toBeVisible();
});

test("serves versioned policy and staff recovery pages", async ({ page }) => {
  await page.goto("/pages/return-policy");
  await expect(page.getByRole("heading", { name: "Return policy." })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Evidence and quality control" })).toBeVisible();

  await page.goto("/admin/forgot-password");
  await expect(page.getByRole("heading", { name: "Recover access." })).toBeVisible();
  await expect(page.getByText(/No credential or recovery request leaves this browser/)).toBeVisible();
});

test("covers the remaining planned admin module families", async ({ page }) => {
  await page.goto("/admin/inventory/overview");
  await page.waitForURL("**/admin/login?returnTo=%2Fadmin%2Finventory%2Foverview");
  await page.getByRole("button", { name: /Enter console/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Stock truth" })).toBeVisible();

  await page.getByRole("link", { name: "Transfers", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Move with custody" })).toBeVisible();
  await page.getByRole("link", { name: "Settings", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Business controls" })).toBeVisible();
  await page.getByRole("link", { name: "Tax", exact: true }).click();
  /* Pinned to the page heading: the tax screen also carries a section called
     "Tax configuration", and an unqualified name would match both. */
  await expect(page.getByRole("heading", { level: 1, name: "Tax configuration" })).toBeVisible();
});

test("opens the profile from the account menu and pages its activity log", async ({ page }) => {
  await page.goto("/admin/orders");
  await page.waitForURL("**/admin/login?returnTo=%2Fadmin%2Forders");
  await page.getByRole("button", { name: /Enter console/ }).click();

  /* Reached the way an operator reaches it, through the account chip. Not
     `page.goto`: a staff session is deliberately never persisted, so a full
     page load would land back on the login screen. */
  await page.getByRole("button", { name: /Aarav D\./ }).click();
  await page.getByRole("menuitem", { name: "Your profile" }).click();
  await expect(page.getByRole("heading", { name: /Your profile/ })).toBeVisible();

  /* Five rows on the page and the rest behind the modal — that split is the
     point of the screen, so the counts are asserted rather than assumed. */
  await expect(page.locator("table.aui-table tbody tr")).toHaveCount(5);
  await page.getByRole("button", { name: /See more/ }).click();

  const log = page.getByRole("dialog");
  await expect(log.getByRole("heading", { name: "Full activity log" })).toBeVisible();
  await expect(log.locator("tbody tr")).toHaveCount(12);

  await page.keyboard.press("Escape");
  await expect(log).toBeHidden();
});
