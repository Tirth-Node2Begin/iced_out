# Iced_out — Project Status & Handoff

> **Read this first.** It is the single orientation document for anyone (human or
> AI) picking up this repository. It states what exists, what works, what is
> stubbed, how the four applications talk to each other, and where the authority
> for each decision lives.
>
> Generated 2026-09-07 from the working tree (branch `main`, HEAD `fc77070`).
> Where this file and the deeper documents disagree, **the deeper document wins** —
> see [Document map](#14-document-map).

---

## 1. What this project is

A dark-editorial **streetwear e-commerce store** for the Indian market (INR,
Razorpay, Asia/Kolkata), plus the **operations console / CRM** that runs it.

It is **four deployable applications over one MySQL database**:

```text
Iced-Out/
├── frontend/                 THE SHOP        Next.js 16 static export   :3000
├── backend/                  its API         PHP 8.2, no framework      :8000
├── iced-out-crm/
│   ├── frontend/             THE CRM         Next.js 16 static export   :3100
│   └── backend/              its API         PHP 8.2, no framework      :8100
├── docs/planning/            the product/architecture specification
├── tools/                    audit + live-deployment build scripts
└── live/                     GENERATED deployment bundle (gitignored)
```

There is **no Node backend, no Laravel, no ORM, no SSR anywhere.** Both frontends
compile to static HTML (`output: "export"`); both backends are hand-rolled core
PHP that returns JSON under `/api/v1/**` and never renders HTML.

### The one-sentence architecture

> Two static sites, each proxying `/api/v1` to its own PHP process, and both PHP
> processes opening the **same MySQL schema** — which is the only thing that
> connects the shop to the CRM.

The two backends **never call each other.** An order placed on the shop is the
row the CRM reads. A contact's lifetime spend in the CRM is a live subquery
against `orders`, not a synced copy. There is no message bus, no webhook between
halves, and nothing to reconcile.

---

## 2. Current status at a glance

| Area | State | Notes |
|---|---|---|
| **Shop frontend** (`frontend/`) | Built | 37 route files → 42 exported HTML pages |
| **Shop backend** (`backend/`) | Built | **60 routes**; 48 wired to the UI, the 12 cart/wishlist routes await their clients |
| **CRM frontend** (`iced-out-crm/frontend/`) | Built | 46 route pages, all register screens DB-backed |
| **CRM backend** (`iced-out-crm/backend/`) | Built | **183 routes** live |
| **Database** | Built | 30 migrations, **88 tables**, 3 views |
| **Auth (customer + staff)** | Working | Separate cookies, separate token spaces |
| **Checkout + Razorpay** | Working | Server-created order, server-verified signature |
| **Live deployment** | Storefront deployed | `iced-out.node2begin.com` (cPanel). CRM **not** deployed |
| **Delivery tracking** | **Stubbed** | iThink Logistics provider written, credentials absent |
| **CMS page blocks** | **Fixtures** | `/pages/[slug]` still reads a TS fixture, not the API |
| **Wishlist** | **API built, clients not switched** | `GET/PUT /me/wishlist`, `POST/DELETE /me/wishlist/{id}` over `wishlist_items` (migration 0030). The storefront and the app still read `localStorage`. |
| **Cart** | **API built, clients not switched** | The 7 endpoints of spec §8.8 plus `POST /me/cart/merge`, over `carts`/`cart_items`. Until a client calls them the bag is still device-local, which is why one account can still see two different bags. |

### Git state right now

`main` is at `fc77070 deploye in our site`. The working tree has **67 uncommitted
changes**, almost all in `frontend/src/components/**` and `frontend/src/styles/**`
— an in-progress **animation / performance pass** on the storefront's marketing
pages. Two new untracked helpers are part of it:

- `frontend/src/lib/performance-mode.ts`
- `frontend/src/lib/use-adaptive-smooth-scroll.ts`

plus new pre-generated `.avif`/`.webp` hero and ghost-product images under
`frontend/public/images/`. **Nothing in `backend/`, and nothing in the CRM
backend, is dirty** — the uncommitted work is purely storefront presentation.

---

## 3. How the four pieces communicate

### 3.1 The request path (this is the part people get wrong)

The browser **never calls the API's own origin.** It calls `/api/v1/...` on
whatever host the page is served from, and that path is routed to PHP by the
layer in front:

```text
DEVELOPMENT
  browser :3000  ──/api/v1/*──▶  next dev rewrite  ──▶  PHP  127.0.0.1:8000
  browser :3100  ──/api/v1/*──▶  next dev rewrite  ──▶  PHP  127.0.0.1:8100

PRODUCTION (cPanel/Apache today, Nginx in the spec)
  browser  ──/*───────▶  static export (index.html, _next/, …)
           ──/api/v1/*─▶  api/v1/*.php  →  front controller  →  PHP application
```

Both `next.config.ts` files declare that rewrite and it is **development-only**
(a static export cannot have rewrites):

- `frontend/next.config.ts` → `API_PROXY_ORIGIN ?? http://127.0.0.1:8000`
- `iced-out-crm/frontend/next.config.ts` → `API_PROXY_ORIGIN ?? http://127.0.0.1:8100`

**Why proxy at all.** `:3000` and `:8000` are different *sites* to a browser, so a
`SameSite=Lax` session cookie is never sent across that line. Proxying makes every
call first-party: no CORS preflight, no cross-site cookie, and the hop to PHP is
server-to-server. Production has the same shape for the same reason.

**Always use `127.0.0.1`, never `localhost`.** They are different origins to a
browser (your session belongs to whichever one you signed in on), and on Windows
`localhost` resolves to `::1` first while PHP's built-in server is IPv4-only —
measured at 34 ms vs 260 ms per request.

### 3.2 The HTTP client layer (frontend side)

`frontend/src/api/clients.ts` and `iced-out-crm/frontend/src/api/clients.ts` are
near-identical. Each exports three axios instances:

| client | `withCredentials` | header sent |
|---|---|---|
| `publicClient` | no | `X-Client-Audience: public` |
| `customerClient` | yes | `X-Client-Audience: customer` |
| `adminClient` | yes | `X-Client-Audience: admin` |

Base URL resolution: `process.env.NEXT_PUBLIC_API_BASE_URL || "/api/v1"`.

> ⚠️ **`||`, not `??`, on purpose.** Next inlines `NEXT_PUBLIC_*` at build time,
> and `NEXT_PUBLIC_API_BASE_URL=` written blank in an env file inlines as the
> **empty string**, which `??` happily keeps. That yields `baseURL: ""`, every
> call goes to `/health` instead of `/api/v1/health`, the static site answers
> them, and the whole shop dies with no error anywhere saying why. Same guard in
> `features/09-payment/razorpay.ts`.

Every request also carries, from `request-context.ts`:
`X-Request-Id`, `X-Client-Timezone`, `Accept-Language`. Mutations that must not
double-apply add `Idempotency-Key`.

Every response error is funnelled through `error-normalizer.ts` into an
`AppError { code, message, fieldErrors, requestId, retryable, status }` — so UI
code never touches an axios error shape.

### 3.3 The response envelope (backend side)

`src/Kernel/Response.php` — spec §4.3, and nothing else:

```jsonc
// success
{ "data": <payload>, "meta": { "request_id": "…", "pagination": { … } } }

// failure
{ "error": { "code": "ICE-…", "message": "…", "errors": [ … ], "retryable": false },
  "meta":  { "request_id": "…" } }
```

`meta.request_id` is stamped centrally on the way out, so no handler has to
remember it. `204` returns an empty body. Binary responses (media) go out via
`Response::raw()`.

### 3.4 The middleware pipeline

Identical in both backends (`src/Kernel/Application.php::PIPELINE`), in this order:

```text
RequestId → SecurityHeaders → Cors → HandleErrors → Maintenance → ResolveRoute
  → BodyLimit → RateLimitByIp → Authenticate → OriginCheck → RateLimitByPrincipal
  → Authorize → Validate → Idempotency → Audit → [Controller]
```

`HandleErrors` sits *below* the two decorators and *above* everything that throws,
so a failure still comes back carrying CORS and security headers.

Layering below the router is one-directional:
`Router → Middleware → Controller → Service → Repository → PDO`.
Presenters sit between Service and Controller and are the **only** place display
formatting happens.

### 3.5 Sessions — two separate token spaces

| | cookie | TTL env key |
|---|---|---|
| shopper | `io_csess` | `CUSTOMER_SESSION_TTL` (30 d) |
| staff | `io_ssess` | `STAFF_SESSION_IDLE_TTL` (15 min idle) |

Tokens are **HMAC'd with `SESSION_SECRET`**. This is why that key must be
byte-identical in both `.env` files — otherwise each half rejects every session
the other issued, and the symptom looks like a random logout bug.

**There is no CSRF token.** The frontends send none, and requiring one would
break every mutation. The defence is `SameSite=Lax` plus the Origin/Referer check
in `Middleware\OriginCheck`.

### 3.6 Authorisation

`config/permissions.php` is the source of truth; `seed` mirrors it into the
`permissions` / `role_permissions` tables, and each CRM route names a code.

- **Codes**: `dashboard.view`, `orders.view|manage`, `shipping.view|manage`,
  `catalog.view|edit|publish`, `inventory.view|adjust|transfer`,
  `returns.view|approve`, `coupons.manage`, `payments.view|reconcile|exports.create`,
  `refunds.request|approve`, `customers.view|manage`, `reviews.moderate`,
  `support.tickets.manage`, `reports.operational.view`, `settings.manage`,
  `audit.view`, `cms.manage`, `media.upload`, `crm.view|manage`.
- **Roles**: `ADMIN` (`*` wildcard), `MANAGER`, `SUPPORT`, `WAREHOUSE`.

Note two deliberate choices: `cms.manage` is held apart from `catalog.edit`
(merchandising the shop front ≠ changing prices), and `SUPPORT` holds
`crm.manage` (answering these people all day and not being able to log the call
is the wrong shape of restriction).

---

## 4. The shop — `frontend/` + `backend/`

### 4.1 Storefront route inventory (37 pages)

```text
(home)                          the landing page
(gender)/women  (gender)/new-drop
men  new-man  new-man/piece  new-woman  new-woman/piece   department + PDP screens
new-home  home-v2  about                                   editorial / alt layouts
(storefront)/contact  /pages/[slug]  /track  /wishlist
(customer-auth)/auth/{login,register,forgot-password,reset-password}
(customer-session)/cart  /checkout  /checkout/payment  /orders
(customer-session)/account
   /addresses /feedback /notifications /orders /orders/detail /profile
   /returns/detail /returns/new /reviews /security /support /vouchers /wallet
```

> **Record routes carry the id in the query string**, not a path segment —
> `/account/orders/detail?id=…`, `/new-man/piece?slug=…`. A static export can only
> pre-render dynamic segments whose values `generateStaticParams` knew at build
> time, and an order placed a minute ago did not exist then. The pattern is a thin
> `"use client"` wrapper reading `useSearchParams()` inside `<Suspense>`.
> Precedent: `features/02-products/components/product-route.tsx`.
>
> `[slug]` segments are still fine for *compiled-in* content (`/pages/[slug]`
> policies, `/new-man/[slug]` display pieces) — those are known at build time.

### 4.2 The 48 shop API routes

| Group | Routes |
|---|---|
| **system** (public) | `GET /health`, `/ready`, `/version`, `/config/storefront` |
| **auth** | `POST /auth/{login,register,logout}`, `POST /auth/password/{forgot,verify,reset}`, `GET /auth/session` |
| **catalog** (public) | `GET /catalog/products`, `/catalog/products/{slug}`, `/catalog/trending`, `/catalog/collections` |
| **home** (public) | `GET /home/hero` |
| **checkout** | `GET /checkout/delivery-options`, `POST /checkout/orders` *(idempotent)*, `POST /checkout/payments/razorpay/order`, `POST /checkout/payments/razorpay/verify` |
| **me** (18) | `GET\|PATCH /me`, addresses CRUD + `/default`, `GET\|PUT /me/checkout/draft`, `GET /me/orders`, `/me/orders/{id}`, `POST /me/password`, `PUT\|DELETE /me/photo`, `GET\|POST /me/returns`, `GET\|POST /me/reviews`, `GET /me/sessions`, `DELETE /me/sessions/{id}`, `POST /me/sessions/revoke-others`, `GET /me/support`, `GET /me/vouchers`, `GET /me/wallet`, `POST /me/wallet/redeem` *(idempotent)* |
| **feedback** | `GET /reviews` (public), `POST /support/queries` |
| **media** | `GET /media/{id}` (public) |

Dump the live table any time with `php bin/console.php routes`.

### 4.3 Which storefront features are wired to the API

| Feature module | Backed by |
|---|---|
| `01-users` (profile, addresses) | **API** — `/me`, `/me/addresses/**` |
| `02-products` (catalog store, PDP) | **API** — `/catalog/**` |
| `04-cart` (bag, coupon, delivery, storefront config) | **localStorage** + `/config/storefront`, `/checkout/delivery-options` — `/me/cart/**` now exists and is not called yet |
| `07-orders` | **API** — `POST /checkout/orders`, `GET /me/orders` |
| `09-payment` | **API** — Razorpay order + verify |
| `10-coupons` / vouchers | **API** for `/me/vouchers`; coupon code held in `localStorage` |
| `11-reviews` | **API** — `/reviews`, `/me/reviews` |
| `14-support` | **API** — `/support/queries`, `/me/support` |
| `18-returns` | **API** — `/me/returns` |
| `19b-home-hero` | **API** — `/home/hero` (CMS-managed slides) |
| `20-auth-security` | **API** — `/auth/**`, `/me/sessions/**` |
| `21-wallet` | **API** — `/me/wallet`, `/me/wallet/redeem` |
| `03-inventory` | display components only (stock shown via PDP payload) |
| `05-wishlist` | **`localStorage` only** — `/me/wishlist` now exists and is not called yet |
| `08-tracking` | **fixtures** — `tracking-fixtures.ts` + `tracking-from-order.ts` |
| `16-analytics`, `17-shipping` | display components only (data comes from order payloads) |
| `19a-cms-read` | **fixtures** — `cms-repository.ts` returns `homePageFixture` |

### 4.4 Checkout & payments — the exact flow

1. Bag lives in `localStorage` (`features/04-cart/cart-context.tsx`). The server
   bag at `/me/cart` is built but unused by this flow.
2. `GET /config/storefront` supplies fees, thresholds, the free-over line, and
   the **public Razorpay key**.
3. `GET /checkout/delivery-options` supplies the shipping choices.
4. `POST /checkout/payments/razorpay/order` — the **server** states the amount and
   creates the Razorpay order.
5. Razorpay Checkout opens in the browser.
6. `POST /checkout/payments/razorpay/verify` — the **server** verifies
   `razorpay_signature`.
7. `POST /checkout/orders` with an `Idempotency-Key` — the server computes prices,
   checks stock, applies the coupon, mints the id and order number, and writes the
   row. A double-tap on a slow connection replays the first order rather than
   buying the bag twice.

> **Degraded mode:** with no API reachable, the checkout falls back to an
> amount-only flow. The real gateway still opens and still takes a real test
> payment, but the success callback is a **claim the browser made** and the result
> carries `verified: false`. Fine on a `rzp_test_` key; never fine on a live one.
> See `features/09-payment/razorpay.ts`.

Test instruments: card `4111 1111 1111 1111`, any future expiry/CVV, OTP `1234`;
or UPI id `success@razorpay`.

**Key placement.** `RAZORPAY_KEY_ID` + `RAZORPAY_KEY_SECRET` belong in
`backend/.env`; the id is served to the storefront by `GET /config/storefront`, so
changing accounts needs no rebuild. `NEXT_PUBLIC_RAZORPAY_KEY_ID` in
`frontend/.env.local` is an optional override for a preview deployment.
`frontend/.env.production.local` deliberately blanks it so the dev test key never
ships in a production bundle.

---

## 5. The CRM — `iced-out-crm/`

Originally the shop's `/admin/*` section; split out on **2026-08-25** into its own
site, own session cookie, own API, and a relationship layer the console never had.

**Frontend routes lost the `/admin` prefix** (`/admin/orders` → `/orders`).
**API paths kept it** — the CRM's endpoints are still `/api/v1/admin/**`.

### 5.1 CRM route inventory (46 pages)

```text
(auth)/login  /forgot-password  /reset-password

(console)/                         dashboard
  /analytics  /profile  /settings/store  /reviews  /support  /vouchers
  /orders  /orders/detail
  /payments  /payments/detail  /payments/payouts
  /shipments/{active,failed,ndr,pickups,manifests}  /shipments/detail
  /returns/{requests,exchanges}  /returns/detail
  /catalog/{products,collections,categories}  /catalog/products/edit
  /customers  /customers/detail
  /home/hero
  /inventory/{overview,warehouses,transfers}
  /inventory/{suppliers,purchases,materials,production}  /inventory/materials/detail

  ── the relationship layer ──
  /leads  /contacts  /contacts/detail  /companies  /companies/detail
  /deals  /tasks
```

### 5.2 The 183 CRM API routes, by module

| Module | Count | Surface |
|---|---|---|
| `admin_auth` | 7 | login/logout, password reset, session, `touch` (idle keepalive) |
| `admin_dashboard` | 5 | queues, trading, activity, pulse, summary |
| `admin_orders` | 6 | index, show, timeline, confirm, cancel, dispatch |
| `admin_shipments` | 11 | index, ndr, show, label, refresh, transition, resend, return-to-store, arrived-back + pickups |
| `admin_catalog` | 16 | products / variants / collections / categories CRUD, publish, listing-room |
| `admin_inventory` | 9 | items, reserve, at-risk, warehouses, transfers |
| `admin_materials` | 18 | suppliers, purchases, receipts, materials, movements, recipes, production runs |
| `admin_returns` | 8 | index/show/history, approve, reject, settle, collect-payment |
| `admin_payments` | 12 | payments, export, gateway-check, collect-COD, payouts, refunds |
| `admin_people` | 16 | customers, reviews, support queries, vouchers |
| `admin_crm` | 24 | leads, contacts, companies, deals, activities, notes, owners, summary, import |
| `admin_settings` | 10 | store settings, staff profile, audit logs, analytics |
| `admin_home` | 6 | hero slides CRUD, reorder, cutout |
| `media` / `system` | 6 | upload, serve, health/ready/version/config |

### 5.3 The relationship layer (`0028_crm_core.sql`)

Eight tables — `crm_leads`, `crm_contacts`, `crm_companies`, `crm_deals`,
`crm_pipelines`, `crm_stages`, `crm_activities`, `crm_notes` — that sit **beside**
the commerce schema. Nothing there is a foreign key any order, payment or shipment
depends on, so the storefront runs untouched whether the CRM is deployed or not.

Two links point the other way, both nullable, both `ON DELETE SET NULL`:

```text
crm_contacts.user_id  →  users.id      a contact who is also a shopper
crm_deals.order_id    →  orders.id     the deal that became a real sale
```

**Qualifying a lead** is the one action that writes three records in a
transaction: a contact always, its company when the lead named one, and a deal
when asked — because a lead marked converted with no contact behind it is worse
than a lead nobody touched.

**Importing from the shop** answers "the CRM was installed after the shop had
already been trading": every shopper account with no contact record yet, sorted by
lifetime spend.

### 5.4 Raw materials (`0029_raw_materials.sql`)

The half of inventory that exists **before** a garment does. `stock_items` counts
finished pieces; seven tables count what they are made of:

```text
suppliers → material_purchases → (receipt) → materials
                                                ↓  product_materials  (the recipe)
                                        production_runs
                                                ↓
                                          stock_items
```

Three rules carried over from the finished-goods side:

- **Availability is derived.** `available` is a generated column (`on_hand − reserved`), never written.
- **Every write appends a movement.** `material_movements` is the whole story.
- **One service writes.** `MaterialService` owns every quantity change.

Quantities are `DECIMAL(12,3)` and **travel as strings** — fabric is cut in metres,
a hoodie takes 2.4 of them, and a float round-trip makes that 2.3999999999999996,
which after four hundred hoodies is a metre the ledger cannot account for.

A production run **snapshots its recipe** onto itself rather than joining to it —
same reason `order_items` freezes prices. Starting a run *holds* material;
completing it consumes the hold and adds finished pieces; a **short yield** is a
first-class outcome (a run of 40 that makes 36 consumes for 36 and returns the rest).

### 5.5 How every CRM screen gets its data

`iced-out-crm/frontend/src/api/use-register.ts` binds one "register" (a searchable,
creatable, editable list) to one set of endpoints. Reads go through a shared
`RemoteStore` keyed by endpoint — so the products tab and the product-editor
dropdown share one list and one request. Writes go straight to the API and the
store is **re-read from the response**, so the row on screen after a save is the
row the database actually holds, including what the server decided (a minted slug,
a derived SKU, a status it refused to change).

Registers are not consistent about what identifies a record — a product by slug, a
variant by SKU, an order by number, a voucher by code — so `itemPath` takes the
whole row rather than an id. That is what stops a PATCH going to the wrong URL.

### 5.6 CRM design system

Layout grammar from `updated style.md`; palette from the storefront.

- Floating chrome on a deeper canvas — `#16181a` cards on `#101113`, one 18px gutter.
- A **68 → 272px rail** that expands on hover and can be pinned. Only the *pinned*
  width reserves a column: a cursor passing over the rail must never reflow the page.
- **`<main>` is the scroll container**, not the document. Anything that locks
  scroll or positions a fixed overlay must account for that.
- Colour lands on the **glyph**, never on a fill. No hover lift, no glow.

Stylesheet load order matters — `shell.css` declares the token layer everything
below reads through:

```text
base.css → shell.css → console.css → crm.css → materials.css → pages.css
```

---

## 6. The database

**One MySQL schema, 88 tables, 3 views, 30 forward-only checksummed migrations.**

Both `migrations/` directories hold the **same files and must keep doing so** —
either half has to be able to rebuild the whole schema. Adding a migration means
adding it to both.

### Table families

| Family | Tables |
|---|---|
| identity & access | `users`, `user_sessions`, `user_addresses`, `user_roles`, `roles`, `permissions`, `role_permissions`, `auth_tokens`, `login_attempts` |
| catalogue | `products`, `product_variants`, `categories`, `collections`, `collection_products`, `product_price_history`, `product_rating_summaries` |
| inventory (finished) | `stock_items`, `stock_item_photos`, `variant_inventory`, `warehouses`, `inventory_movements`, `inventory_reservations`, `inventory_transfers`, `inventory_transfer_items` |
| inventory (raw) | `suppliers`, `materials`, `material_purchases`, `material_purchase_items`, `material_movements`, `product_materials`, `production_runs`, `production_run_materials` |
| cart & promo | `carts`, `cart_items`, `checkout_drafts`, `coupons`, `coupon_redemptions`, `vouchers`, `wallet_accounts`, `wallet_entries` |
| orders & money | `orders`, `order_items`, `order_status_history`, `order_cancellation_requests`, `payments`, `payment_attempts`, `refunds`, `payouts` |
| fulfilment | `shipments`, `shipment_events`, `shipment_labels`, `courier_pickups`, `ndr_cases` |
| after-sale | `return_requests`, `return_status_history`, `reviews`, `review_moderation_history`, `support_queries`, `support_status_history`, `contact_messages` |
| CMS & settings | `cms_pages`, `cms_page_versions`, `cms_blocks`, `faqs`, `home_hero_slides`, `store_settings`, `media_assets` |
| platform | `audit_logs`, `staff_activity_logs`, `activity_feed`, `ops_signals`, `job_queue`, `idempotency_keys`, `domain_events_outbox`, `webhook_inbox`, `inbox_messages`, `notification_preferences`, `search_queries`, `trading_days` |
| CRM | `crm_leads`, `crm_contacts`, `crm_companies`, `crm_deals`, `crm_pipelines`, `crm_stages`, `crm_activities`, `crm_notes` |

Views: `v_dashboard_queues`, `v_order_timeline`, `v_variant_availability`.

### ⚠️ MySQL 8 vs MariaDB — a live landmine

Dev is **XAMPP MariaDB**; the cPanel host is **MySQL 8**. Two constructs are legal
on MariaDB and rejected by MySQL, so a dump that builds fine locally fails on import:

1. **`#1215 Cannot add foreign key constraint`** — MySQL forbids `CASCADE` /
   `SET NULL` / `SET DEFAULT` referential actions when the FK column is a base
   column of a **STORED** generated column. Affects `fk_carts_user`,
   `fk_variants_product`, `fk_reviews_product`, `fk_reviews_user`. The fix that
   keeps the actions is `STORED` → `VIRTUAL` (the rule names STORED only, and none
   of these columns is itself referenced by an FK). Source columns:
   `carts.active_key`, `product_variants.live_key`, `reviews.order_product_key`,
   `reviews.customer_product_key`.
2. **`#3105`** — `tools/live/build-database.mjs` dumps generated columns inside
   `INSERT` column lists with literal values (`product_variants.live_key`,
   `variant_inventory.available`). MySQL refuses a written value for a generated
   column; they must be omitted from both the column list and every row.

Neither fault shows up locally. **The migrations still declare these columns
STORED**, so a fresh install against MySQL repeats fault 1 — fixing it at source
needs a **new forward migration**, never an edit to an applied one.

Migrations also resolve `{{collation}}` per server: `utf8mb4_0900_ai_ci` on
MySQL 8, `utf8mb4_unicode_ci` on MariaDB (which has no `0900` collations).

---

## 7. Settings live in the database, not in PHP

Every policy value, threshold and vocabulary lives in the **`store_settings`**
table, read through `Service\Settings\StoreSettings`. Change a row and the next
request behaves differently — no deploy, no restart.

| Key | Drives |
|---|---|
| `delivery` | fees, free-over threshold, promise windows |
| `cod` | cash-on-delivery cap and fee |
| `inventory` | low-stock threshold, reservation TTLs, per-category size/type vocabularies |
| `shipping` | courier list, failure reasons, max attempts, handling states |
| `returns` | reasons, outcomes, return window |
| `payments` | gateways, refund reasons, payment methods |
| `catalog` | product / collection / variant state vocabularies |
| `security` | login lockout threshold and window, idempotency TTL |
| `sessions` | customer and staff session lifetimes |
| `id_series` / `id_pools` | prefix, width and floor for every minted id |
| `order_number`, `support`, `business` | numbering and store identity |

Two rules keep this honest:

- **Route files never enumerate a vocabulary.** `config/routes/` loads before any
  DB connection exists, so a list written there could only be a stale copy. Rules
  check the *shape* of a request; services check the *vocabulary* against the table.
- **CHECK constraints guard state machines, not vocabularies.** `orders.status`
  and `shipments.status` keep theirs (the application branches on those values).
  Refund reasons, return reasons, support topics, gateways and stock categories
  lost theirs in migration `0013` — pinning them in DDL meant an operator could
  not add one without a migration.

`config/app.php` holds only bootstrap fallbacks used before settings are seeded.
Credentials and deployment wiring stay in the environment: they are not policy.

---

## 8. Running it locally

### Fastest path (Windows)

```bat
start-all.bat
```

One Windows Terminal window, four tabs — shop API `:8000`, CRM API `:8100`, shop
site `:3000`, CRM site `:3100` — then it waits for both sites to answer and opens
them. `backend\server.bat` alone starts just the shop API (it finds PHP, creates
`.env`, mints `SESSION_SECRET`, creates + migrates + seeds the DB, and names
anything it cannot fix — including MySQL not running).

### By hand

```bash
# the shop
cd backend
cp .env.example .env
php bin/console.php preflight              # secret + db + schema + seed-if-empty
php -S 127.0.0.1:8000 -t api dev-server.php
cd ../frontend && npm install && npm run dev          # :3000

# the CRM
cd iced-out-crm/backend
cp .env.example .env
php bin/console.php migrate
php seeds/demo/crm.php                     # optional populated pipeline
php -S 127.0.0.1:8100 -t api dev-server.php
cd ../frontend && npm install && npm run dev          # :3100
```

Open **`http://127.0.0.1:3000`** and **`http://127.0.0.1:3100/login`** — not `localhost`.

### Prerequisites

- PHP **8.2+** with `pdo_mysql`, `mbstring`, `openssl`, `gd`
- MySQL 8.x (prod) / MariaDB 10.4+ (local XAMPP)
- Node **≥ 20.9** (this machine: v24.12.0, PHP 8.2.12)
- Redis 7 **optional** — without it, cache/rate-limit/locks fall back to files
  under `storage/cache` and the queue falls back to the `job_queue` table
- Composer **optional** for running (`autoload.php` registers the same PSR-4 map
  by hand) — required for PHPUnit and PHPStan

### Console commands

```bash
php bin/console.php migrate [--fresh]   apply pending migrations
php bin/console.php migrate:status      applied / pending / changed
php bin/console.php seed [name]         idempotent seeds  (--demo adds demo store)
php bin/console.php routes              print the route table
php bin/console.php key:generate        mint a SESSION_SECRET
php bin/console.php db:create           create the configured database
php bin/console.php db:export           regenerate database/*.sql
php bin/console.php preflight           secret + db + schema + seed-if-empty

php bin/worker.php <queue> [--once]     queue consumer
php bin/scheduler.php                   cron tick (every minute)
```

---

## 9. Seeds — and why they are split

- **`backend/seeds/`** — only what an install cannot function without: roles,
  permissions, the one ADMIN staff account, store settings, and the catalogue with
  its warehouses and stock items.
- **`backend/seeds/demo/`** — the populated store, **opt-in**: a demo shopper,
  orders, payments, shipments, returns, reviews, support threads, vouchers,
  transfers, and a 200-day trading series.
- **`iced-out-crm/backend/seeds/demo/`** additionally has `crm.php` (a populated
  pipeline) and `materials.php`.

**Why split:** seeding customers and orders meant every fresh install opened onto
a shopper nobody had signed up, with purchases nobody had made — and the console's
registers were describing them.

`preflight` (what `server.bat` calls) runs the **essential set only**, and its
emptiness check deliberately does not list `orders` or `trading_days`, which are
empty on a real install and must stay so.

Demo accounts (dev seed only): customer `shopper@example.com` / `secret1`, staff
`admin@gmail.com` / `admin123`. (The essential seed's staff account is
`admin@iced-out.example` / `preview1`.)

### Fixture parity is enforced, not assumed

`iced-out-crm/backend/tests/Contract/FixtureParityTest.php` pins every console
register cell against the frontend module it came from — order rows, the payment
ledger, payout net, shipments, returns, stock, customer counts, reviews, support,
the catalog register, per-size PDP stock and today's trading figures. A seed or
presenter change that would move a cell on screen fails **there**, not in a browser.

Where two frontend fixtures disagreed about the same record, the seed reproduces
**both screens** and reconciles them with real data rather than picking a winner.
`IO-2026-1046` is the worked example: the order register calls it Confirmed with a
captured payment while the ledger calls `pay_ICE1046` Failed — so the seed adds
the retry payment that makes both true.

---

## 10. Testing & auditing

### The whole-project audit

```bash
node tools/audit.mjs
```

Four checks across both halves, ordered so a break is cheapest to find:

| # | Check | Proves | Needs DB |
|---|---|---|---|
| 1 | **contract** | every API path a frontend calls exists in *its* backend's route table with the verb it uses — statically, so it covers paths only a failing branch reaches | no |
| 2 | **schema** | every column named in a literal `INSERT`/`UPDATE` exists in the database | yes |
| 3 | **endpoints** | every `GET` route actually runs against that database — the only check that can see inside a SQL string | yes |
| 4 | **build** | both frontends lint, typecheck and build | no |

Check 3 signs in as a **throwaway customer it creates and deletes**, so the
thirteen `/me/**` routes are exercised rather than skipped at the 401.

### Per-half suites

```bash
cd backend  && composer install && composer test   # phpunit
cd backend  && composer stan                       # phpstan level 8
cd frontend && npm run check                       # lint + typecheck + build
cd frontend && npm run test:e2e                    # playwright against the export

cd iced-out-crm/backend && php tests/Smoke/crm-smoke.php        # lead → won deal
cd iced-out-crm/backend && php tests/Smoke/materials-smoke.php  # supplier → short-yield run
cd iced-out-crm/backend && php tests/Smoke/tracking-smoke.php
```

Playwright specs: `storefront.spec.ts`, `navigation.spec.ts`,
`navigation-speed.spec.ts`, `performance.spec.ts`, `admin-catalog.spec.ts`.

### ⚠️ Point tests at their own database

Any environment variable overrides `.env`, so:

```bash
DB_NAME=iced_out_test php bin/console.php preflight
DB_NAME=iced_out_test php -S 127.0.0.1:8001 -t api dev-server.php
```

A test run that resets the working database deletes the accounts someone
registered while developing, and the symptom — "my password stopped working" —
looks nothing like the cause.

### Known gap

One test did not survive the CRM split: *"a staff cookie cannot open a customer
session"* needed both API surfaces in one process, and no single deployable has
them any more. The guarantee still holds (audiences are separate token spaces in
`SessionManager`) but nothing exercises it end to end.

---

## 11. Deployment

### Current live state

**Storefront only**, at **`iced-out.node2begin.com`** on **cPanel shared hosting**
(Apache/LiteSpeed, `.htaccess`, no root, no Nginx). Decided 2026-09-03.

**The CRM is deliberately not deployed.** When it goes up it gets its **own
subdomain** (`crm.iced-out.node2begin.com`), never a subpath — a subpath would
need Next `basePath`/`assetPrefix` changes and the console API moved off `/api/v1`.

### Building the bundle

```bash
node tools/live/build-live.mjs                 # full build → live/
node tools/live/build-live.mjs --skip-build    # reuse frontend/out as-is
node tools/live/build-live.mjs --domain=x.com
node tools/live/build-live.mjs --layout=split
node tools/live/build-database.mjs             # the one-file SQL import
```

`live/` is **gitignored** — it carries a minted `SESSION_SECRET` and, once filled
in, the live database password.

### The two layouts

**`flat` (the default, and what the user asked for).** One directory,
`live/site/`, and that directory *is* the document root. `.env`, `config/`, `src/`,
`storage/`, `bin/`, `seeds/`, `migrations/`, `database/` and `autoload.php` sit
beside `index.html`, protected **only by `.htaccess`** — in three independent
layers, arranged so failure is loud rather than silent:

1. the deny rules live in the same `.htaccess` that maps every clean URL, so if
   that file stops being read, every page 404s before anything is served;
2. a deny-all `.htaccess` inside each backend folder;
3. the dot-file rule.

`build-live.mjs` **fails the build** if a name in `BACKEND_DIRS` is missing from
the deny list in `templates/htaccess-root` — a folder added in one place and
forgotten in the other is a credential leak nothing else would report.

**`split`.** Two directories: `live/public_html/` (the docroot) and
`live/iced-out-api/` one level above it, where no URL can reach the secrets.
Safer; not what is deployed.

`api/v1/_backend.php` needs no knowledge of which was built — it walks up looking
for `autoload.php` + `config/app.php` and finds either shape.

Re-running is safe: `.env` is **never** overwritten once it exists, and
`storage/media` plus `database/iced_out_live.sql` are carried across untouched
(they are generated together and the dump's rows name the files).

**The one file edited on the server is `live/site/.env`** — the live MySQL
credentials. PHP reads it every request; nothing to restart.

### The spec's target production shape (Nginx, not yet used)

```nginx
root /srv/iced-out/frontend/out;
location / { try_files $uri $uri.html $uri/ /404.html; }
location /api/v1/ {
    root /srv/iced-out/backend/api;
    rewrite ^/api/v1/(.*)$ /$1 break;
    try_files $uri $uri.php /index.php$is_args$args;
    location ~ \.php$ {
        include fastcgi_params;
        fastcgi_pass unix:/run/php/php8.3-fpm.sock;
        fastcgi_param SCRIPT_FILENAME $request_filename;
    }
}
```

Apache/XAMPP needs no extra config — `api/.htaccess` does the same thing.

---

## 12. Environment configuration

### The three keys that must agree between the two `.env` files

Nothing warns you when they do not, and each fails looking like a different bug:

| Key | What breaks when it differs |
|---|---|
| `DB_*` | two shops that never meet |
| `SESSION_SECRET` | tokens are HMAC'd with it — every session the other half issued is refused |
| `MEDIA_ROOT` | photos uploaded in the CRM 404 on the storefront |

### Full key list (`backend/.env.example`)

```ini
APP_ENV  APP_DEBUG  APP_URL  APP_MAINTENANCE
DB_HOST  DB_PORT  DB_NAME  DB_USER  DB_PASS
REDIS_URL                                  # blank => file cache + job_queue fallback
SESSION_COOKIE_CUSTOMER=io_csess  SESSION_COOKIE_STAFF=io_ssess
SESSION_SECRET                             # 64 hex — php bin/console.php key:generate
CUSTOMER_SESSION_TTL=2592000  STAFF_SESSION_IDLE_TTL=900
RAZORPAY_KEY_ID  RAZORPAY_KEY_SECRET  RAZORPAY_WEBHOOK_SECRET  RAZORPAY_TIMEOUT
MEDIA_DRIVER=local  MEDIA_ROOT=storage/media  S3_*
REMOVE_BG_API_KEY  REMOVE_BG_ENDPOINT  REMOVE_BG_SIZE  REMOVE_BG_TIMEOUT
MAIL_DRIVER=log  MAIL_FROM  MAIL_FROM_NAME  SMTP_*
CORS_ALLOWED_ORIGINS                       # split-origin dev only
ITHINK_BASE_URL  ITHINK_ACCESS_TOKEN  ITHINK_SECRET_KEY  ITHINK_TIMEOUT
TRACKING_API_WEBHOOK_SECRET
```

Notes worth carrying:

- `MAIL_DRIVER=log` writes the whole message — **reset code included** — to
  `storage/logs`, so the password flow is exercisable with no credentials.
  `tail -f storage/logs/app-*.log` is the inbox. **Never production.**
- Gmail SMTP needs a 16-character **App Password**, not the account password, and
  2-Step Verification on the account.
- `REMOVE_BG_API_KEY` blank → hero uploads still save, cutouts report "Skipped",
  and the console shows why.
- `ITHINK_*` blank → the placeholder tracking provider stays bound: shipment
  screens render and **no courier scan is ever invented**.

> 🔐 **Housekeeping:** `frontend/.env.local` currently contains a written-to-disk
> `VERCEL_OIDC_TOKEN` (the Vercel CLI puts it there). It is gitignored, but it is
> a credential sitting in the working tree — worth clearing when convenient.

---

## 13. Rules that are easy to break

These are the invariants that cost the most when violated. Treat them as hard
constraints.

**Shared code is duplicated, not linked.** `backend/src/` and
`iced-out-crm/backend/src/` are two copies of the same Kernel, Middleware,
Repository, Service, Presenter and Support layers. A fix below the route table
**must land in both.** Verified differences today: `Application.php` (different
route module lists), `CatalogRepository`, `ShipmentRepository`, plus CRM-only
`Controller/Console/`, `Presenter/CrmPresenter`, `Presenter/MaterialPresenter`,
`Repository/Crm/`, `Repository/MaterialRepository`, `Repository/ProductionRepository`,
`Service/Inventory/MaterialService`. Everything else should be byte-identical.

**`migrations/` must stay identical in both.** Either half has to be able to
rebuild the whole schema.

**CSR only — never SSR.** No `generateStaticParams` over API data, no `fetch` in a
server component, no `async` page that reads data. Pages are static shells; data
arrives client-side.

**Money never touches a float.** `Domain\Money` is integer paise; the database
holds `DECIMAL(12,2)`; `Presenter\Format` makes the strings (`₹17,800` for
customers, `17800` for the console register).

**Material quantities never touch a float either.** `DECIMAL(12,3)`, transported
as strings.

**Dates render in Asia/Kolkata, always.** `X-Client-Timezone` is analytics data,
not a display input. Storage is UTC `DATETIME(6)`.

**Uploads are re-encoded, never trusted.** `POST /api/v1/admin/media` checks size,
**sniffs the type from the file header** (a browser-supplied content type is an
attacker-supplied content type), checks it against `media.allowed_mime`,
**re-encodes** the image (stripping EXIF and anything smuggled in a comment
block), scales to `media.max_edge`, and writes under a **random** storage key.
Nothing under `storage/media` is web-reachable — reads go through
`GET /api/v1/media/{id}`, which serves it with a content type *this server* chose
plus `nosniff`. A form uploads first and submits the returned id, so the record
stays a flat map of strings and the operator learns whether the image was accepted
while they can still pick another. An empty value clears the photo.

**No CSRF token exists, by design.** `SameSite=Lax` + `Middleware\OriginCheck`.

**`server.bat` and `start-all.bat` must stay plain ASCII with CRLF endings.**
`cmd.exe` silently drops the first characters of lines in a batch file saved with
Unix endings, and mangles non-ASCII punctuation under codepage 437. Never put a
bare `>` or `&` inside an `echo` line.

**Delivery tracking is not built.** `Integration\Tracking` holds the seam and a
placeholder returning nothing, so pages render and no courier event is invented.

---

## 14. Document map

Read in this order when you need depth. The **specification wins** over any README.

| File | Lines | What it is |
|---|---|---|
| `backend_setup.md` | 1,353 | **The authoritative build specification** — 183 endpoints, domain tables, wire shapes. Where a README disagrees with it, it wins. |
| `docs/cart-sync-api.md` | — | **The shared bag** — `/me/cart` and `/me/wishlist`, why they did not sync, bearer auth for the app, and the client work still outstanding |
| `docs/planning/product-blueprint.md` | 2,267 | The product plan the feature numbering follows |
| `docs/planning/backend.md` | 1,635 | Backend architecture and the API contract |
| `docs/planning/frontend.md` | 1,171 | Frontend architecture plan |
| `docs/planning/database.md` | 823 | Database architecture |
| `updated style.md` | ~92 KB | The CRM's layout grammar |
| `new_style.md` | ~55 KB | Storefront design language |
| `README.md` | — | Repo overview and the two-site split |
| `backend/README.md` | — | Shop backend. **Its "Status" table is stale** — it lists storefront reads/cart/checkout as "not started"; they are live (see §4.2). |
| `iced-out-crm/README.md` | — | CRM: running it, the schema, the design |
| `frontend/README.md` | — | Storefront. **Stale** — it says "no backend implemented"; that has not been true since the API landed. |
| `frontend/docs/frontend-architecture.md` | 51 | Planning-to-code map |
| `tools/live/templates/DEPLOY-flat.md` | — | The deployment walkthrough, regenerated per build |

Spec section references appear throughout the code as `§n.n` and point into
`backend_setup.md`.

---

## 15. Suggested next steps

Ordered by what unblocks the most:

1. **Commit or resolve the 67 dirty storefront files.** The animation/performance
   pass is mid-flight; nothing else should be started on top of it.
2. **Refresh the two stale READMEs** (`backend/README.md` status table,
   `frontend/README.md` "frontend-only" framing) — both actively mislead.
3. **Write the forward migration that turns the four STORED generated columns
   VIRTUAL** (§6). Until then, every fresh install against MySQL 8 fails at import,
   and only the hand-patched live dump works.
4. **Fix `build-database.mjs`** to omit generated columns from `INSERT` lists.
5. **Wire the remaining fixture-backed storefront features** — `19a-cms-read`
   (`/pages/[slug]`), `08-tracking`, and the wishlist — to the API, or document
   them as deliberately local-only.
6. **Bind real courier tracking** once iThink credentials arrive; the provider is
   written and the seam is in place.
7. **Deploy the CRM** to `crm.iced-out.node2begin.com` when asked — same flat
   bundle shape, own subdomain, `SESSION_SECRET`/`DB_*`/`MEDIA_ROOT` matching the
   storefront's.
8. **Restore the cross-audience session test** as a two-process integration test.
