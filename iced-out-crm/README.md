# Iced_out CRM

The operations console and the relationship layer, as their own site.

```
iced-out-crm/
  backend/    PHP API on :8100   — console + CRM endpoints
  frontend/   Next.js on :3100   — the whole CRM
```

---

## What this is, and what changed

The shop used to serve its own admin panel: one Next.js app where `/` was the
storefront and `/admin/*` was the console, one PHP API answering both. That is
now two sites.

| | storefront | CRM |
|---|---|---|
| frontend | `frontend/` — `:3000` | `iced-out-crm/frontend/` — `:3100` |
| backend | `backend/` — `:8000` | `iced-out-crm/backend/` — `:8100` |
| serves | shoppers | staff |
| API surface | `/auth`, `/catalog`, `/checkout`, `/me`, `/home`, `/media/{id}` | `/admin/**` |

**One database.** Both backends point at the same MySQL schema. That is the
whole design: an order taken on the shop is the order the CRM sees, with no sync
step and nothing to reconcile. A contact's order count is a subquery against
`orders`, not a copy of it.

The console screens moved wholesale — 48 route pages, the `aui-*` component
sheet, and every workspace behind them. The paths lost their prefix on the way,
because this host's root IS the console: `/admin/orders` is `/orders` here.

On top of that sits the layer the console never had: **leads, contacts,
companies, a deal pipeline, tasks and notes.**

---

## Running it

Four processes. The storefront half is optional if you are only working on the
CRM — but the CRM writes product photos into the shared media root, so a
storefront that is running needs to be pointed at the same one.

```bash
# 1 · the CRM API
cd iced-out-crm/backend
cp .env.example .env          # then read the three ⚠ notes in it
php bin/console.php migrate
php seeds/demo/crm.php        # optional: a populated pipeline to look at
php -S 127.0.0.1:8100 -t api dev-server.php

# 2 · the CRM
cd iced-out-crm/frontend
cp .env.local.example .env.local
npm install
npm run dev                   # http://127.0.0.1:3100

# 3 + 4 · the shop, if you want it
cd backend  && php -S 127.0.0.1:8000 -t api dev-server.php
cd frontend && npm run dev
```

Sign in at <http://127.0.0.1:3100/login> with the seeded admin account.

> Use `127.0.0.1`, not `localhost`. They are different origins to a browser, and
> the session cookie is issued for whichever one you signed in on.

### Three settings that must agree between the two `.env` files

Nothing warns you when they do not, and each fails in a way that looks like a
different bug:

| key | what breaks when it differs |
|---|---|
| `DB_*` | two shops that never meet |
| `SESSION_SECRET` | tokens are HMAC'd with it — every session the other half issued is refused |
| `MEDIA_ROOT` | photos uploaded in the CRM 404 on the storefront |

---

## How a request gets to PHP

The browser never talks to the API's origin. It calls `/api/v1` on whatever host
the CRM is served from, and Next proxies that to `:8100`
([next.config.ts](frontend/next.config.ts)).

That is not a convenience. `:3100` and `:8100` are different *sites* to a
browser, so the `SameSite=Lax` staff cookie would never be sent across that line
— an operator would look signed out on every request no matter how correct both
halves are. Proxying makes the call first-party: no CORS preflight, no
cross-site cookie, and the hop to PHP is server-to-server.

Production is the same shape: Nginx serves the static export at `/` on the CRM
host and proxies `/api/v1` to that host's PHP-FPM.

---

## The CRM layer

Eight tables, added by [`0028_crm_core.sql`](backend/migrations/0028_crm_core.sql).
They sit BESIDE the commerce schema — nothing there is a foreign key any order,
payment or shipment depends on, so the storefront runs untouched whether the CRM
is deployed or not. Two links point the other way, both nullable and both
`ON DELETE SET NULL`:

```
crm_contacts.user_id  ->  users.id     a contact who is also a shopper
crm_deals.order_id    ->  orders.id    the deal that became a real sale
```

| screen | what it is |
|---|---|
| `/leads` | inbound interest, before anyone decided it was worth a record |
| `/contacts` | the people the shop knows, with their real order history beside them |
| `/companies` | the accounts those people belong to |
| `/deals` | the pipeline board — drag between stages; Won and Lost settle the deal |
| `/tasks` | calls, quotes and meetings, by overdue / today / upcoming / open / done |

**Qualifying a lead** is the one action that writes three records: a contact
always, its company when the lead named one, and a deal when you ask for one —
in a transaction, because a lead marked converted with no contact behind it is
worse than a lead nobody touched.

**Importing from the shop** answers "the CRM was installed after the shop had
already been trading": every shopper account with no contact record yet, sorted
by what they have spent.

---

## Raw materials

The half of inventory that exists **before** a garment does. `stock_items`
counts finished pieces; these seven tables count what they are made of, and the
two meet at exactly one point.

```
suppliers → material_purchases → (receipt) → materials
                                                ↓  product_materials  (the recipe)
                                        production_runs
                                                ↓
                                          stock_items      (already there)
```

| screen | what it is |
|---|---|
| `/inventory/suppliers` | who the fabric and trims come from, and their lead time |
| `/inventory/purchases` | orders on their way in — draft → ordered → part received → received |
| `/inventory/materials` | the register, with a full movement ledger per material |
| `/inventory/production` | runs: planned → started (materials held) → done (consumed, pieces made) |

Three rules carried over from the finished-goods side, because inventory that
half-follows them is worse than inventory that follows none:

- **Availability is derived.** `available` is a generated column, `on_hand −
  reserved`, never written.
- **Every write appends a movement.** `material_movements` is the whole story of
  how a quantity got where it is. Nothing changes a count without a row here.
- **One service writes.** `MaterialService` owns every quantity change, so the
  ledger cannot be bypassed.

**Quantities are `DECIMAL(12,3)` and travel as strings.** Fabric is bought and
cut in metres and a hoodie takes 2.4 of them; a float round-trip turns that into
2.3999999999999996, which after four hundred hoodies is a metre the ledger
cannot account for.

**A production run is where the two halves meet.** Starting one *holds* what its
frozen recipe calls for, so a second run cannot promise the same fleece.
Completing it consumes the hold and adds the finished pieces — and a short yield
is a first-class outcome: a run of 40 that makes 36 consumes material for 36 and
puts the rest of the hold back on the shelf.

The recipe is **snapshotted onto the run** rather than joined to. It can change
next month; a run that happened in August has to keep saying what it used in
August — the same reason `order_items` freezes its prices.

### Permissions

Two codes cover the module: `crm.view` to read, `crm.manage` to change. ADMIN and
MANAGER hold both; SUPPORT holds both as well, because answering these people all
day and not being able to log the call is the wrong shape of restriction.

---

## The design

Layout grammar from `updated style.md`; palette from the storefront.

- **Floating chrome on a deeper canvas.** The rail and the bar are cards lifted
  off the page, inset by one shared 18px gutter — `#16181a` chrome on `#101113`.
- **A 68 → 272px rail** that expands on hover and can be pinned. Only the
  *pinned* width reserves a column: a cursor passing over the rail must never
  reflow the page under it.
- **`<main>` is the scroll container**, not the document. Anything that locks
  scroll or positions a fixed overlay has to account for that.
- **Colour lands on the glyph**, never on a fill — mint, amber, rose, sky and
  violet against a near-monochrome surface.
- **No hover lift, no glow.** Rows and cards recolour, or deepen the same black.

The sheets, in load order:

| file | what is in it |
|---|---|
| [base.css](frontend/src/styles/base.css) | the document surface and the reset |
| [shell.css](frontend/src/styles/shell.css) | tokens, the app frame, the rail, the bar |
| [console.css](frontend/src/styles/console.css) | head cards, tables, forms, dialogs, charts |
| [crm.css](frontend/src/styles/crm.css) | the board, the task list, record screens |

`shell.css` declares the token layer every sheet below it reads through. Swapping
the order leaves the component sheet resolving `var()` against nothing.

---

## Tests

```bash
# Both halves at once: API contracts, schema, every GET endpoint, both builds.
node ../tools/audit.mjs

# No dependencies needed — drives the real pipeline against the real database,
# writes a lead through to a won deal, and cleans up after itself.
cd backend && php tests/Smoke/crm-smoke.php

# The material flow end to end: supplier → PO → part receipt → full receipt →
# recipe → run → started → completed with a SHORT yield → finished units.
cd backend && php tests/Smoke/materials-smoke.php

cd backend  && composer install && vendor/bin/phpunit
cd frontend && npm run check          # lint + typecheck + build
```

One test did not survive the split: *"a staff cookie cannot open a customer
session"* needed both API surfaces in one process, and no single deployable has
them any more. The guarantee still holds — audiences are separate token spaces in
`SessionManager` — but nothing exercises it end to end. Restoring it means an
integration test that boots both apps.
