import { expect, test, type Page } from "@playwright/test";

/**
 * The catalogue's three registers, end to end, and the register they hang off.
 *
 * What is being proved is the part a unit test cannot reach: that a product is
 * a decision about real stock — it can only be listed from what a warehouse
 * holds, in a size that warehouse carries, and the count it shows is read back
 * from there rather than copied. Then the ordinary register verbs on top of
 * that: it opens in an editor, what the editor saves comes back to the list,
 * and deleting it removes it and everything hanging off it.
 */

/**
 * Signs into the console and lands on `returnTo`. The staff session is held in
 * memory rather than restored, so a test has to arrive at its screen from this
 * form — a later `page.goto()` drops the session and bounces back through the
 * guard.
 */
async function signInStaff(page: Page, returnTo: string) {
  await page.goto(`/admin/login?returnTo=${encodeURIComponent(returnTo)}`);
  await page.getByRole("textbox", { name: "Work email" }).fill("admin@gmail.com");
  // `getByLabel("Password")` also matches the field's "Show password" reveal
  // button, which resolves two elements and fails strict mode.
  await page.getByRole("textbox", { name: "Password" }).fill("admin123");
  await page.getByRole("button", { name: "Enter console" }).click();
  await expect(page).toHaveURL(returnTo);
}

/** The register's own row, found by something printed in it. */
function row(page: Page, text: string) {
  return page.locator(".aui-table tbody tr").filter({ hasText: text }).first();
}

async function remove(page: Page, id: string, singular: string) {
  await page.getByRole("button", { name: `Delete ${id}` }).click();
  await page.getByRole("button", { name: `Delete ${singular}`, exact: true }).click();
}

/** Picks from one of the console's dropdowns by the label a person reads. */
async function choose(page: Page, field: string, option: string | RegExp) {
  await page.getByRole("combobox", { name: field }).click();
  /* Exact for a plain string: a size list holds "L", "XL" and "XXL", and a
     substring match resolves to all three rather than picking one. */
  await page.getByRole("option", { name: option, exact: typeof option === "string" }).click();
}

/** What a dropdown is currently offering, opened and then closed again. */
async function choicesIn(page: Page, field: string) {
  await page.getByRole("combobox", { name: field }).click();
  const options = await page.getByRole("option").allInnerTexts();
  await page.keyboard.press("Escape");
  return options.map((option) => option.trim());
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
});

test("puts the catalogue's screens in the list toolbar, and no longer offers imports", async ({
  page,
}) => {
  await signInStaff(page, "/admin/catalog/products");

  const toolbar = page.locator(".aui-toolbar").first();
  await expect(toolbar.getByRole("link", { name: "Products" })).toBeVisible();
  await expect(toolbar.getByRole("link", { name: "Categories" })).toBeVisible();
  await expect(toolbar.getByRole("link", { name: "Collections" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Imports" })).toHaveCount(0);

  /* The three states, and All — every one of them present whether or not a
     product is currently in it. */
  await expect(toolbar.getByRole("button", { name: /^All/ })).toBeVisible();
  await expect(toolbar.getByRole("button", { name: /^Published/ })).toBeVisible();
  await expect(toolbar.getByRole("button", { name: /^Scheduled/ })).toBeVisible();
  await expect(toolbar.getByRole("button", { name: /^Draft/ })).toBeVisible();
});

test("lists a product from stock, minting its slug and code", async ({ page }) => {
  await signInStaff(page, "/admin/catalog/products");

  await page.getByRole("button", { name: "New product" }).click();
  /* The count travels with the name, so listing something nobody has any of is
     a decision rather than an accident. */
  await choose(page, "Inventory item", "Afterdark Hoodie · 36 available");
  await choose(page, "Size", "L");
  await page.getByLabel("Price").fill("₹7,200");
  await page.getByRole("button", { name: "Create product" }).click();

  /* The name is the item's, never typed — so it cannot be spelled two ways. */
  const created = row(page, "AFH");
  await expect(created).toContainText("Afterdark Hoodie");
  await expect(created).toContainText("36");
  await expect(created).toContainText("₹7,200");
  await expect(created).toContainText("Draft");
  await expect(created.getByRole("link", { name: /^Open/ })).toHaveAttribute(
    "href",
    "/admin/catalog/products/edit?id=afterdark-hoodie-2",
  );

  await remove(page, "afterdark-hoodie-2", "product");
  await expect(row(page, "AFH")).toHaveCount(0);
});

test("offers only the sizes the chosen item is stocked in and has not listed", async ({ page }) => {
  await signInStaff(page, "/admin/catalog/products");
  await page.getByRole("button", { name: "New product" }).click();

  /* A bottom is sized by waist inches — and 32 is missing because Shadow Cargo
     02 is already listed in it. A size cannot be listed twice. */
  await choose(page, "Inventory item", /^Shadow Cargo 02/);
  expect(await choicesIn(page, "Size")).toEqual(["30", "34"]);

  /* A top is sized by letter, and switching to one moves the answer with it —
     the form cannot be left holding a waist size for a t-shirt. M is gone for
     the same reason 32 was. */
  await choose(page, "Inventory item", /^Core Heavy Tee/);
  expect(await choicesIn(page, "Size")).toEqual(["S", "L", "XL", "XXL"]);
  await expect(page.getByRole("combobox", { name: "Size" })).toHaveText("S");

  await page.getByRole("button", { name: "Cancel" }).click();
});

test("holds an item the warehouse has run out of, and says so", async ({ page }) => {
  await signInStaff(page, "/admin/catalog/products");

  /* Every one of its six pieces is reserved against an order, so there is
     nothing left to promise a shopper. */
  await expect(row(page, "Bone Utility Overshirt")).toContainText("0");

  await page.getByRole("button", { name: "New product" }).click();
  await page.getByRole("combobox", { name: "Inventory item" }).click();

  /* Shown rather than hidden: an operator looking for it has to be able to
     find it and read why, and the reason is the fix. */
  const soldOut = page.getByRole("option", { name: /^Bone Utility Overshirt/ });
  await expect(soldOut).toHaveText(/Bone Utility Overshirt · Out of stock/);
  await expect(soldOut).toHaveAttribute("aria-disabled", "true");
});

test("closes an item off once every size it stocks has been listed", async ({ page }) => {
  await signInStaff(page, "/admin/catalog/products");

  /* Shadow Cargo 02 is stocked in three waist sizes and listed in one. Take
     the other two. */
  for (const size of ["30", "34"]) {
    await page.getByRole("button", { name: "New product" }).click();
    await choose(page, "Inventory item", /^Shadow Cargo 02/);
    await choose(page, "Size", size);
    await page.getByLabel("Price").fill("₹11,200");
    await page.getByRole("button", { name: "Create product" }).click();
  }

  await page.getByRole("button", { name: "New product" }).click();
  await page.getByRole("combobox", { name: "Inventory item" }).click();

  const exhausted = page.getByRole("option", { name: /^Shadow Cargo 02/ });
  await expect(exhausted).toHaveText(/Shadow Cargo 02 · All sizes listed/);
  await expect(exhausted).toHaveAttribute("aria-disabled", "true");

  /* Something with room left is still perfectly listable — the ceiling is per
     item, not a lock on the whole register. An offered option carries no
     `aria-disabled` at all, rather than carrying it set to false. */
  await expect(page.getByRole("option", { name: /^Core Heavy Tee/ })).not.toHaveAttribute(
    "aria-disabled",
    "true",
  );
});

test("reads a product's available count live from the inventory register", async ({ page }) => {
  await signInStaff(page, "/admin/catalog/products");
  await expect(row(page, "Afterdark Hoodie")).toContainText("36");

  /* Hold more of it back for orders, on the screen that owns that decision. */
  await page.getByRole("link", { name: "Inventory", exact: true }).click();
  await expect(page.getByRole("heading", { name: /Stock truth/ })).toBeVisible();
  await page.getByRole("button", { name: "Reserve pieces of Afterdark Hoodie" }).click();
  await page.getByLabel("Pieces to reserve").fill("40");
  await page.getByRole("button", { name: "Save reservation" }).click();

  /* The catalogue was not edited, and is already showing the smaller number:
     the count is read from stock, never copied into the product. */
  await page.getByRole("link", { name: "Catalog", exact: true }).click();
  await expect(page.getByRole("heading", { name: /Product catalogue/ })).toBeVisible();
  await expect(row(page, "Afterdark Hoodie")).toContainText("8");
});

test("opens a product created in the register, and saves the editor back to it", async ({
  page,
}) => {
  await signInStaff(page, "/admin/catalog/products");

  await page.getByRole("button", { name: "New product" }).click();
  await choose(page, "Inventory item", /^Midnight Denim/);
  await choose(page, "Size", "36");
  await page.getByLabel("Price").fill("₹9,400");
  await page.getByRole("button", { name: "Create product" }).click();

  await row(page, "MDD2").getByRole("link", { name: /^Open/ }).click();

  /* A product that did not exist at build time still has an editor: the screen
     is one static route reading the slug from its query. */
  await expect(page).toHaveURL("/admin/catalog/products/edit?id=midnight-denim-2");
  await expect(page.getByRole("heading", { name: /Edit Midnight Denim/ })).toBeVisible();
  await expect(page.getByText("/products/midnight-denim-2")).toBeVisible();
  await expect(page.getByText("Midnight Denim · 3 available")).toBeVisible();

  await page.getByLabel("Price").fill("₹9,900");
  await page.getByRole("button", { name: /Save product/ }).click();

  await page.getByRole("link", { name: "Go back to Catalogue" }).click();
  await expect(row(page, "MDD2")).toContainText("₹9,900");

  await remove(page, "midnight-denim-2", "product");
  await expect(row(page, "MDD2")).toHaveCount(0);
});

test("starts a new product with no variants, and mints a SKU for each one added", async ({
  page,
}) => {
  await signInStaff(page, "/admin/catalog/products");

  await page.getByRole("button", { name: "New product" }).click();
  await choose(page, "Inventory item", /^Core Heavy Tee/);
  await choose(page, "Size", "XL");
  await page.getByLabel("Price").fill("₹6,400");
  await page.getByRole("button", { name: "Create product" }).click();
  await row(page, "CHT2").getByRole("link", { name: /^Open/ }).click();

  /* A product nobody has added a size to has none — not a borrowed set from
     whichever product the fixture happened to describe. */
  await expect(page.getByRole("heading", { name: "No variants yet" })).toBeVisible();
  await expect(page.getByText("Nothing to sell yet")).toBeVisible();

  await page.getByRole("button", { name: "New variant" }).first().click();
  await page.getByLabel("Colour").fill("Washed black");
  /* The variant form offers this item's sizes, not a fixed letter run. */
  expect(await choicesIn(page, "Size")).toEqual(["S", "M", "L", "XL", "XXL"]);
  await choose(page, "Size", "L");
  await page.getByLabel("In stock").fill("6");
  await page.getByRole("button", { name: "Create variant" }).click();

  /* Product code · colour code · size, minted rather than typed. */
  await expect(row(page, "CHT2-WSB-L")).toContainText("Washed black");
  await expect(row(page, "CHT2-WSB-L")).toContainText("6");
  await expect(page.getByRole("heading", { name: "1 variant" })).toBeVisible();

  /* Deleting the product takes its variants with it: a product listed from the
     same item afterwards must not inherit them. */
  await page.getByRole("link", { name: "Go back to Catalogue" }).click();
  await remove(page, "core-heavy-tee-2", "product");

  await page.getByRole("button", { name: "New product" }).click();
  await choose(page, "Inventory item", /^Core Heavy Tee/);
  await page.getByLabel("Price").fill("₹6,400");
  await page.getByRole("button", { name: "Create product" }).click();
  await row(page, "CHT2").getByRole("link", { name: /^Open/ }).click();
  await expect(page.getByRole("heading", { name: "No variants yet" })).toBeVisible();
});

test("gives categories a slug and a count, and nothing to be in a state about", async ({ page }) => {
  await signInStaff(page, "/admin/catalog/products");
  await page.locator(".aui-toolbar").getByRole("link", { name: "Categories" }).click();
  await expect(page.getByRole("heading", { name: /Category system/ })).toBeVisible();

  const toolbar = page.locator(".aui-toolbar").first();
  await expect(toolbar.getByRole("button", { name: /^All/ })).toBeVisible();
  await expect(toolbar.getByRole("button", { name: /^Complete|^Review/ })).toHaveCount(0);
  await expect(page.getByRole("columnheader", { name: "State" })).toHaveCount(0);
  await expect(page.getByRole("columnheader", { name: "Complete" })).toHaveCount(0);
  await expect(page.getByRole("columnheader", { name: "Outstanding" })).toHaveCount(0);

  await page.getByRole("button", { name: "New category" }).click();
  await expect(page.getByLabel("Completeness")).toHaveCount(0);
  await expect(page.getByLabel("Outstanding work")).toHaveCount(0);
  await expect(page.getByLabel("Slug")).toHaveCount(0);
  await page.getByLabel("Category name").fill("Winter Layers");
  await page.getByLabel("Products").fill("7");
  await page.getByRole("button", { name: "Create category" }).click();

  const created = row(page, "Winter Layers");
  await expect(created).toContainText("winter-layers");
  await expect(created).toContainText("7");

  await remove(page, "winter-layers", "category");
  await expect(row(page, "Winter Layers")).toHaveCount(0);
});

test("gives collections the same three states, and no release window to fill in", async ({
  page,
}) => {
  await signInStaff(page, "/admin/catalog/products");
  await page.locator(".aui-toolbar").getByRole("link", { name: "Collections" }).click();
  await expect(page.getByRole("heading", { name: /Collection desk/ })).toBeVisible();

  const toolbar = page.locator(".aui-toolbar").first();
  await expect(toolbar.getByRole("button", { name: /^Published/ })).toBeVisible();
  await expect(toolbar.getByRole("button", { name: /^Scheduled/ })).toBeVisible();
  await expect(toolbar.getByRole("button", { name: /^Draft/ })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Release window" })).toHaveCount(0);
  await expect(page.getByRole("columnheader", { name: "Signal" })).toHaveCount(0);

  await page.getByRole("button", { name: "New collection" }).click();
  await expect(page.getByLabel("Release window")).toHaveCount(0);
  await expect(page.getByLabel("Signal")).toHaveCount(0);
  await expect(page.getByLabel("Slug")).toHaveCount(0);
  await page.getByLabel("Collection name").fill("Night Shift");
  await page.getByLabel("Pieces").fill("5");
  await page.getByRole("button", { name: "Create collection" }).click();

  const created = row(page, "Night Shift");
  await expect(created).toContainText("night-shift");
  await expect(created).toContainText("Draft");

  await remove(page, "night-shift", "collection");
  await expect(row(page, "Night Shift")).toHaveCount(0);
});
