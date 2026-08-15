# Iced_out — Backend Setup & Full API Contract

**Version:** 1.0 · **Date:** 2026-08-14 · **Status:** Build specification (authoritative)

This document is the single build order for the Iced_out backend. It was derived **from the
frontend code as it exists on disk today** — every context provider, localStorage store, fixture
shape, state machine, and guard rule in `frontend/src` was read and mapped. The planning docs in
`docs/planning/` were used **only** for conventions (layering, naming, hardening patterns); where
they disagree with the frontend, **the frontend wins**.

> **Prime directive — DO NOT BREAK THE UI.**
> The frontend is a finished, static-exported CSR app (`next.config.ts` → `output: "export"`).
> The backend must slot underneath it by serving **exactly** the JSON shapes the UI already
> renders, at the paths its axios clients already point to (`/api/v1`). No SSR, no HTML rendering,
> no framework. Core PHP 8.3+, JSON only.

---

## Table of contents

1. [Ground rules & hard constraints](#1-ground-rules--hard-constraints)
2. [System architecture](#2-system-architecture)
3. [Serving model & environments](#3-serving-model--environments)
4. [Transport contract (envelope, headers, errors)](#4-transport-contract)
5. [Authentication & sessions](#5-authentication--sessions)
6. [Database schema (MySQL 8)](#6-database-schema)
7. [Wire shapes (the exact JSON the UI consumes)](#7-wire-shapes)
8. [Full endpoint catalogue](#8-full-endpoint-catalogue)
   - 8.1 System · 8.2 Customer auth · 8.3 Profile/me · 8.4 Addresses · 8.5 Catalog ·
     8.6 Search · 8.7 Wishlist · 8.8 Cart · 8.9 Checkout & payment · 8.10 Customer orders ·
     8.11 Public tracking · 8.12 Returns (customer) · 8.13 Vouchers (customer) ·
     8.14 Reviews (customer) · 8.15 Support (customer) · 8.16 CMS & contact ·
     8.17 Staff auth · 8.18 Console dashboard · 8.19 Console orders · 8.20 Console shipments ·
     8.21 Console catalog · 8.22 Console inventory · 8.23 Console returns ·
     8.24 Console vouchers · 8.25 Console payments · 8.26 Console customers ·
     8.27 Console reviews · 8.28 Console support · 8.29 Console analytics ·
     8.30 Console settings & staff profile · 8.31 Media · 8.32 Webhooks
9. [Domain invariants & state machines](#9-domain-invariants--state-machines)
10. [Frontend wiring map (store → endpoint replacement)](#10-frontend-wiring-map)
11. [Static-export ID registry (reserved slots)](#11-static-export-id-registry)
12. [Seed parity (data the UI expects on day one)](#12-seed-parity)
13. [Background jobs & scheduler](#13-background-jobs--scheduler)
14. [Security hardening checklist](#14-security-hardening-checklist)
15. [Implementation phases & acceptance checks](#15-implementation-phases--acceptance-checks)

---

## 1. Ground rules & hard constraints

1. **Core PHP 8.3+ (8.4 OK), no framework.** Composer PSR-4 autoload, PSR-12 style,
   `declare(strict_types=1)` in every file, PHPStan level 8, PHPUnit. No Laravel/Symfony/Slim.
2. **CSR strictly, no SSR.** The backend never renders HTML. It serves:
   - the JSON API under `/api/v1/**`, and
   - (optionally, via Nginx) the static frontend from `frontend/out/`.
   `backend/public/index.php` is the **only** web-reachable PHP file.
3. **The frontend is not modified structurally.** Wiring the app to the API means replacing the
   bodies of the existing context providers/repositories with calls through the already-built
   axios clients (`src/api/clients.ts`) — the components, routes, and rendered shapes stay
   byte-for-byte compatible. Section 10 lists every seam.
4. **MySQL 8.x (InnoDB, utf8mb4), PDO prepared statements only.** No ORM. Repositories own all
   SQL. Redis 7 for cache/rate-limit/locks/queue; a `job_queue` table (`FOR UPDATE SKIP LOCKED`)
   is the queue fallback when Redis is absent.
5. **Layering (CI-enforced by grep):**
   `Router → Middleware pipeline → Controller (thin) → Service (business rules + transactions)
   → Repository (SQL) → PDO`. Presenters/serializers sit between Service and Controller and are
   the only place display formatting happens.
6. **One engine per concern.** One pricing engine, one coupon/voucher engine, one stock writer
   (`StockService` — nothing else may `UPDATE inventory`), one payment recorder.
7. **A DB transaction never spans an external HTTP call.** Gateway/courier calls happen strictly
   after commit; results are folded back in a second transaction.
8. **Money** is stored as `DECIMAL(12,2)` + `currency CHAR(3)` (always `INR` for v1), computed in
   integer paise inside services, and **formatted by presenters** to the exact strings the UI
   shows (see §7). Floats never touch money.
9. **India-first:** timezone `Asia/Kolkata` for display formatting, storage in UTC
   (`DATETIME(6)`); en-IN number formatting (`₹17,800`); GST fields on order lines; Razorpay is
   the primary gateway; COD is a first-class payment method.
10. **Complexity budget is spent on correctness**, not on ceremony: idempotency keys, optimistic
    locking, append-only ledgers, outbox events, audit logs, rate limits, RBAC — all specified
    below and all required.

---

## 2. System architecture

### 2.1 Stack

| Layer | Choice |
|---|---|
| Web server | Nginx → PHP-FPM (PHP 8.3+) |
| Language | Core PHP, strict types, Composer PSR-4 |
| Database | MySQL 8.x, InnoDB, `utf8mb4_0900_ai_ci` |
| Cache/locks/queues | Redis 7 (fallback: `job_queue` table) |
| Object storage | Local `storage/media` in dev; S3-compatible in prod |
| Payments | Razorpay (server-side order + signature verify + webhook) |
| Mail/SMS | SMTP (dev: log transport); DLT SMS adapter stub |

### 2.2 Repository layout

```
backend/
├── public/
│   └── index.php               # front controller — the ONLY web-reachable file
├── bin/
│   ├── console.php             # CLI: migrate, seed, make:migration, reindex, routes
│   ├── worker.php              # queue consumer (jobs table / Redis streams)
│   └── scheduler.php           # cron entry, runs due scheduled tasks (every minute)
├── config/
│   ├── app.php                 # env-driven config (returns array; reads getenv())
│   ├── database.php
│   ├── routes/                 # one file per module, pure arrays of route defs
│   │   ├── system.php  auth.php  me.php  catalog.php  cart.php  checkout.php
│   │   ├── orders.php  tracking.php  returns.php  vouchers.php  reviews.php
│   │   ├── support.php  cms.php  console.php  webhooks.php  media.php
│   └── permissions.php         # permission code → role matrix
├── src/
│   ├── Kernel/                 # Router, Request, Response, Middleware pipeline, DI container
│   ├── Middleware/             # RequestId, SecurityHeaders, Cors, BodyLimit, RateLimit,
│   │                           # Authenticate, Csrf, Authorize, Validate, Idempotency, Audit
│   ├── Controller/             # thin: parse → call service → present
│   │   ├── Storefront/  Customer/  Console/  Webhook/  System/
│   ├── Service/                # business logic, transactions, outbox writes
│   │   ├── Auth/  Catalog/  Inventory/  Cart/  Checkout/  Order/  Payment/
│   │   ├── Shipping/  Returns/  Voucher/  Review/  Support/  Cms/  Customer/
│   │   ├── Dashboard/  Analytics/  Settings/  Media/  Notification/
│   ├── Repository/             # all SQL lives here, one class per aggregate
│   ├── Presenter/              # domain → exact UI wire shapes (see §7) — THE compat layer
│   ├── Domain/                 # value objects: Money, OrderNumber, Slug, Pincode, enums
│   ├── Integration/            # RazorpayGateway, Tracking/ (PlaceholderTrackingProvider §9.8),
│   │                           # Mailer, ObjectStorage
│   ├── Job/                    # queued jobs (SendMail, ExpireReservations, RefreshRollups…)
│   └── Support/                # Clock, Uuid, IdAllocator (reserved pools, §11), Validation
├── migrations/                 # 0001_….sql upward, checksummed in schema_migrations
├── seeds/                      # fixture-parity seeds (§12), idempotent upserts
├── storage/
│   ├── logs/  media/  cache/
├── tests/
│   ├── Unit/  Contract/  Concurrency/
├── composer.json
└── .env.example
```

### 2.3 Middleware pipeline (ordered, every request)

```
request_id → security_headers → cors → maintenance → body_limit(1 MB; 8 MB media)
→ rate_limit(ip) → authenticate(cookie → session) → csrf(origin check on mutations)
→ rate_limit(principal) → authorize(permission + scope) → validate(request schema)
→ idempotency(where declared) → controller → audit(mutations) → respond
```

### 2.4 Entry-point behavior

`public/index.php`: bootstrap autoload → load config → build container → dispatch
`Router::match($method, $path)` → run pipeline → emit JSON. Uncaught `DomainException`
subclasses map to error codes (§4.4); anything else → `ICE-SYS-500` with `request_id`, stack
trace only to logs, never to the client.

---

## 3. Serving model & environments

### 3.1 Topology (single origin — recommended, zero CORS pain)

```
Nginx :443
├── /                → static files from frontend/out/  (the CSR export; SPA fallbacks)
│                      try_files $uri $uri.html $uri/ /404.html;
└── /api/v1/         → php-fpm (backend/public/index.php)
```

Because the frontend and API share an origin, cookies are first-party, `SameSite=Lax` works,
and no CORS preflights occur. This is the production layout.

### 3.2 Split-origin dev (Next dev server on :3000, PHP on :8080)

- Frontend env: `NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8080/api/v1`
- Backend must then send CORS: `Access-Control-Allow-Origin: http://127.0.0.1:3000`,
  `Access-Control-Allow-Credentials: true`, allow headers
  `Content-Type, X-Client-Audience, X-Request-Id, X-Client-Timezone, Accept-Language,
  Idempotency-Key`, methods `GET,POST,PUT,PATCH,DELETE,OPTIONS`, and answer `OPTIONS` with 204.
- Cookies in dev: `SameSite=Lax` still works for top-level navigation; use `127.0.0.1` for both
  hosts so the cookie domain matches. (Never `SameSite=None` without HTTPS.)

### 3.3 Environment variables (`backend/.env`)

```
APP_ENV=dev|prod            APP_URL=https://iced-out.example
DB_HOST=127.0.0.1 DB_PORT=3306 DB_NAME=iced_out DB_USER=… DB_PASS=…
REDIS_URL=redis://127.0.0.1:6379/0
SESSION_COOKIE_CUSTOMER=io_csess   SESSION_COOKIE_STAFF=io_ssess
SESSION_SECRET=<64 hex>            # HMAC for session tokens & tracking tokens
CUSTOMER_SESSION_TTL=2592000       # 30 d rolling
STAFF_SESSION_IDLE_TTL=900         # 15 min inactivity — mirrors the UI's timer
RAZORPAY_KEY_ID=rzp_test_…         RAZORPAY_KEY_SECRET=…   RAZORPAY_WEBHOOK_SECRET=…
MEDIA_DRIVER=local|s3  MEDIA_ROOT=storage/media  S3_*=…
MAIL_DRIVER=log|smtp  SMTP_*=…
CORS_ALLOWED_ORIGINS=http://127.0.0.1:3000
# External delivery-tracking API — PLACEHOLDERS, leave blank until provided (§9.8):
TRACKING_API_BASE_URL=
TRACKING_API_KEY=
TRACKING_API_WEBHOOK_SECRET=
```

Frontend `.env.local` (the only two knobs it has):

```
NEXT_PUBLIC_API_BASE_URL=/api/v1            # default already correct for single origin
NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_test_…      # public key only
# NEXT_PUBLIC_RAZORPAY_ORDER_API is retired — order creation moves to /api/v1/checkout/payment/initiate
```

---

## 4. Transport contract

This section is **non-negotiable**: it is what `src/api/clients.ts`, `src/api/types.ts`, and
`src/api/error-normalizer.ts` already implement.

### 4.1 Base & clients

- Base path: **`/api/v1`**. Timeout budget: respond in **< 12 s** (axios aborts at 12 s).
- Three audiences, sent on every request as `X-Client-Audience: public|customer|admin`.
- `withCredentials: true` for customer & admin ⇒ **cookie sessions**. No `Authorization`
  header exists anywhere in the frontend — do not require one.

### 4.2 Request headers (sent by the frontend on every call)

| Header | Content | Backend use |
|---|---|---|
| `X-Client-Audience` | `public` \| `customer` \| `admin` | must match the route's audience; mismatch → `403 ICE-AUTH-403` |
| `X-Request-Id` | UUID v4 per request | echo into `meta.request_id` and all log lines |
| `X-Client-Timezone` | IANA zone | analytics only; display formatting is always `Asia/Kolkata` |
| `Accept-Language` | browser locale | reserved; v1 is `en-IN` only |
| `Idempotency-Key` | `<scope>-<uuid>` | required on the endpoints flagged **[idem]** in §8 |

### 4.3 Response envelope

**Success** (2xx):
```json
{ "data": <payload>, "meta": { "request_id": "…", "pagination": { "page": 1, "per_page": 24, "total": 96, "total_pages": 4 } } }
```
`meta` and `pagination` only when relevant. Keys are `snake_case` in `meta`; **payload keys
match the frontend types exactly** (mostly camelCase — see §7; do not "normalize" them).

**Failure** (4xx/5xx):
```json
{ "error": { "code": "ICE-CART-422", "message": "That size is sold out.",
             "retryable": false,
             "errors": [ { "field": "quantity", "detail": "Only 2 left in this size." } ] },
  "meta": { "request_id": "…" } }
```
- `code`: `ICE-<MODULE>-<HTTP>`; modules: `AUTH USR CAT INV CART CPN CHK ORD PAY REF SHIP TRK
  RET RVW WSH SUP CMS MEDIA RPT IDMP RATE REQ WEBHOOK SYS`.
- `message`: one human sentence, safe to toast.
- `errors[]`: per-field validation details; `field` omitted for form-level problems.
- `retryable: true` only for transient faults (503, gateway timeout, lock contention).

### 4.4 Error code map (canonical set)

| HTTP | Codes (examples) | When |
|---|---|---|
| 400 | `ICE-REQ-400` | malformed JSON, unknown fields |
| 401 | `ICE-AUTH-401` | no/expired session |
| 403 | `ICE-AUTH-403` | wrong audience, missing permission, CSRF/origin fail |
| 404 | `ICE-<MOD>-404` | unknown resource (never reveals existence) |
| 409 | `ICE-ORD-409` `ICE-INV-409` `ICE-IDMP-409` | state conflict, oversell, idempotency-body mismatch |
| 410 | `ICE-CHK-410` | expired checkout/reservation |
| 422 | `ICE-<MOD>-422` | validation failure (with `errors[]`) |
| 429 | `ICE-RATE-429` | rate limit (`Retry-After` header) |
| 500 | `ICE-SYS-500` | unexpected |
| 503 | `ICE-SYS-503` (`retryable: true`) | maintenance/dependency down |

### 4.5 Pagination, sorting, filtering

`?page=1&per_page=24` (catalog default 24, console default 50, hard cap 100). Response carries
`meta.pagination`. Console list endpoints also accept `q` (free text) and the filter params
listed per endpoint in §8. Stable sort: `created_at DESC, id DESC` unless stated.

### 4.6 Idempotency **[idem]**

Endpoints flagged **[idem]** require `Idempotency-Key`. Store
`(scope, endpoint, key_hash, request_hash, response_status, response_body)` in
`idempotency_keys`; same key + same body ⇒ replay stored response byte-for-byte; same key +
different body ⇒ `409 ICE-IDMP-409`. TTL 48 h. The frontend already ships
`createIdempotencyKey(scope)` in `src/api/request-context.ts` — wiring attaches it.

### 4.7 Rate limits (Redis token buckets; headers `X-RateLimit-Limit/Remaining/Reset`)

| Class | Limit |
|---|---|
| auth login/register | 10/min per IP (+ per-email lockout, §5.6) |
| password forgot | 5/hour per IP |
| public catalog/search | 120/min per IP |
| cart/checkout mutations | 30/min per session |
| contact / support create | 5/hour per session or IP |
| console reads | 300/min per staff session |
| console writes | 60/min per staff session |
| webhooks | 1000/min per provider |

---

## 5. Authentication & sessions

The UI's behavior (auth-context, route-guard, staff session timer) defines the contract.

### 5.1 Model — opaque server sessions in HttpOnly cookies

No JWTs on the wire. A session row + an opaque 256-bit token, stored **hashed (SHA-256)**:

- **Customer cookie** `io_csess`: `HttpOnly; Secure; SameSite=Lax; Path=/api/v1`,
  rolling 30-day expiry, rotated on privilege change (login, password change).
- **Staff cookie** `io_ssess`: `HttpOnly; Secure; SameSite=Lax; Path=/api/v1`, **session cookie
  (no Max-Age)** + server-side idle TTL **15 min**, sliding. The UI already throttles activity
  touches to one per 30 s and force-expires the tab — mirror it server-side: every authenticated
  console request slides expiry; `POST /console/auth/touch` exists for quiet tabs.
- The two audiences are **separate cookies, separate session rows, separate token spaces**.
  A staff cookie never authorizes a customer route or vice versa (checked before role logic).

### 5.2 CSRF

The frontend sends **no CSRF token header** — do not require one (it would break every
mutation). Defense instead:
1. `SameSite=Lax` cookies (blocks cross-site POSTs).
2. **Origin/Referer check** on every cookie-authenticated mutation: must match `APP_URL`
   or a `CORS_ALLOWED_ORIGINS` entry; missing Origin on a mutation with a session cookie → 403.
3. All state changes are non-GET.

### 5.3 Login flow (matches the UI exactly)

- Customer login/register form posts `{email, password}` (+ `name` on register). On success the
  backend sets `io_csess` and returns the session payload (§8.2). The UI then navigates to
  `returnTo` client-side (`safeReturnPath` already guards open redirects) — the backend never
  redirects.
- Login **upserts the customer register row** (this replicates `recordCustomerSignIn`): new
  users get a `cus-…` id from the reserved band (§11); returning users only bump `seen`.
  **A `Blocked` customer authenticates but stays `Blocked`** in the register (matches current
  semantics); blocked customers are refused at checkout (`403 ICE-ORD-403`).
- Staff login posts `{email, password}`; success returns `{ name, role, permissions[], expires_at }`.
- Password recovery (both audiences) is **neutral**: any well-formed request → `202` with the
  same body, whether or not the account exists. Staff reset requires the emailed token + new
  password ≥ 12 chars; customer reset ≥ 6 chars (UI minimums: customer 6, staff 12).

### 5.4 Session introspection & bootstrapping

On app load the wired frontend calls `GET /auth/session` (customer) or
`GET /console/auth/session` (staff) to hydrate its context. `200` with the session payload, or
`401 ICE-AUTH-401` when anonymous — the RouteGuard then does its existing
`/auth/login?returnTo=…` dance untouched.

### 5.5 RBAC (console)

Roles: `ADMIN`, `MANAGER`, `SUPPORT`, `WAREHOUSE` (v1 seeds only `ADMIN`, matching the UI, but
the permission layer is built now). Permissions are **resolved per request** from
`user_roles → role_permissions` (never cached in the cookie). Permission codes and the
role matrix live in `config/permissions.php`; the endpoint tables in §8 name the required code
per route. `GET /console/auth/session` returns the effective permission list so the UI can later
hide affordances without a second source of truth.

### 5.6 Credential hygiene

Argon2id password hashes; per-email + per-IP login throttling with progressive lockout
(5 failures → 15 min); `login_attempts` append-only table; all reset/OTP tokens stored hashed
with single-use + 30 min expiry; sessions revocable (`/me/sessions`).

### 5.7 Guest → customer "bag intent"

Guests can browse and wishlist locally (UI keeps this in localStorage — no API). Adding to bag
while anonymous routes to login (already in the UI). To survive the trip, the wired frontend
may POST the pending line to `POST /auth/intent` (signed, 15-min TTL, no DB cart row for
guests) and `POST /auth/intent/resume` after login merges it into the customer cart. Both
endpoints exist in §8.2; if unused, login simply starts from the server cart.

---

## 6. Database schema

MySQL 8, InnoDB, `utf8mb4_0900_ai_ci`. Conventions: PK `id BIGINT UNSIGNED AUTO_INCREMENT`
(internal only); `public_id` (VARCHAR(40)) carries the UI-visible id (e.g. `ord-local-07`,
`pay_ICE2003`, `IO-2026-1049`); timestamps `DATETIME(6)` UTC (`created_at`, `updated_at`,
soft-delete `deleted_at` where noted); money `DECIMAL(12,2)` + `currency CHAR(3) DEFAULT 'INR'`;
status columns `VARCHAR(32)` with `CHECK` constraints (no MySQL ENUM); booleans `TINYINT(1)`
named `is_*`; ledgers are **append-only** (the app DB user has no UPDATE/DELETE grant on them).

### 6.1 Identity & access (10 tables)

| # | Table | Key columns |
|---|---|---|
| 1 | `users` | `id, public_id (cus-…/stf-…), type ('CUSTOMER','STAFF'), status ('ACTIVE','BLOCKED'), name, email (UQ per type), email_normalized, phone, password_hash, photo_media_id FK, last_seen_at, created_at, updated_at, deleted_at` |
| 2 | `user_addresses` | `id, public_id (addr-…), user_id FK, label, name, street, city, state, pincode CHAR(6), phone, is_default, position, created_at, updated_at, deleted_at` |
| 3 | `user_sessions` | `id, user_id FK, audience ('customer','staff'), token_hash BINARY(32) UQ, ip VARBINARY(16), user_agent, last_active_at, idle_expires_at, absolute_expires_at, revoked_at, created_at` |
| 4 | `auth_tokens` | `id, user_id FK, purpose ('PASSWORD_RESET','EMAIL_VERIFY','BAG_INTENT'), token_hash UQ, payload_json, attempts, expires_at, consumed_at, created_at` |
| 5 | `login_attempts` (ledger) | `id, email_normalized, audience, ip, was_success, created_at` |
| 6 | `roles` | `id, code ('ADMIN','MANAGER','SUPPORT','WAREHOUSE'), is_system` |
| 7 | `permissions` | `id, code (stable strings, config-mirrored)` |
| 8 | `role_permissions` | `role_id FK, permission_id FK` (PK pair) |
| 9 | `user_roles` | `user_id FK, role_id FK, granted_by FK, created_at` (PK pair) |
| 10 | `staff_activity_logs` (ledger) | `id, staff_user_id FK, action, resource, result ('Completed','Denied','Recorded'), where_label, request_id, created_at` — feeds the profile activity table (5 preview / 12 full) |

### 6.2 Catalog (10 tables)

| # | Table | Key columns |
|---|---|---|
| 11 | `products` | `id, public_id = slug (UQ), name, category, item_ref (ITM-… FK→stock_items.public_id, nullable), description, story, fabric, care, price DECIMAL, compare_at_price DECIMAL NULL, color, badge NULL, image_position ('top-left'…'bottom-right'), audience ('men','women','unisex'), collection_slug, is_new, status ('Published','Scheduled','Draft'), tax_note NULL, position, created_at, updated_at, deleted_at` |
| 12 | `product_variants` | `id, public_id = sku (e.g. ADH-WSB-M, UQ), product_id FK, size ('XS','S','M','L','XL' or numeric waist), color, color_hex CHAR(7), material, status ('Active','Low','Out','Archived'), max_per_order TINYINT DEFAULT 3, position, created_at, updated_at, deleted_at` |
| 13 | `categories` | `id, public_id, name, position, created_at, updated_at, deleted_at` |
| 14 | `collections` | `id, public_id = slug, name, status ('Live','Scheduled','Draft'), position, created_at, updated_at, deleted_at` |
| 15 | `collection_products` | `collection_id FK, product_id FK, position` (PK pair) |
| 16 | `product_price_history` (ledger) | `id, product_id FK, price, compare_at_price, changed_by FK, created_at` |
| 17 | `media_assets` | `id, public_id, owner_type ('product','review','profile','cms'), owner_id, storage_key, mime, bytes, width, height, checksum, created_at, deleted_at` |
| 18 | `product_rating_summaries` | `product_id PK/FK, review_count, rating_avg DECIMAL(3,2), refreshed_at` |
| 19 | `search_queries` (ledger) | `id, q, results, session_kind, created_at` |
| 20 | `cms_*` → see §6.8 | |

### 6.3 Inventory (7 tables)

| # | Table | Key columns |
|---|---|---|
| 21 | `warehouses` | `id, public_id ('BLR-01','DEL-01','MUM-01',…), name, available_label, capacity_pct, cutoff, status ('Online','Draft','Disabled'), created_at, updated_at` |
| 22 | `stock_items` | `id, public_id ('ITM-001'…, UQ), item_name, category ('Top','Bottom'), item_type, sizes_csv, warehouse_id FK, total_units INT UNSIGNED, reserved_units INT UNSIGNED, version INT (optimistic lock), created_at, updated_at, deleted_at` — CHECK `reserved_units <= total_units`; **available is always derived** (`total - reserved`), never stored |
| 23 | `variant_inventory` | `id, variant_id FK UQ, stock_item_id FK, on_hand INT, reserved INT, available AS (on_hand - reserved) STORED, low_at TINYINT DEFAULT 4, version INT` — per-size truth for PDP (`IN_STOCK / LOW_STOCK / SOLD_OUT`, "Only N left") |
| 24 | `inventory_movements` (ledger) | `id, stock_item_id FK, variant_id FK NULL, type ('PURCHASE_IN','SALE_RESERVE','SALE_CONFIRM','RESERVE_EXPIRE','RETURN_IN','RTO_IN','TRANSFER_OUT','TRANSFER_IN','ADJUST_UP','ADJUST_DOWN','DAMAGE'), qty INT, on_hand_after, reserved_after, reference_type, reference_id, idempotency_key UQ NULL, actor_id, created_at` |
| 25 | `inventory_reservations` | `id, order_id FK, order_item_id FK, variant_id FK, qty, status ('HELD','CONFIRMED','RELEASED','EXPIRED'), expires_at, created_at, updated_at` — UQ `(order_item_id)` |
| 26 | `inventory_transfers` | `id, public_id ('TRF-001'…), from_warehouse_id FK, to_warehouse_id FK, units, dispatched_label, status ('Ready','In transit','Received','Cancelled'), created_at, updated_at` |
| 27 | `inventory_transfer_items` | `id, transfer_id FK, stock_item_id FK, qty` |

### 6.4 Cart, coupons, vouchers (6 tables)

| # | Table | Key columns |
|---|---|---|
| 28 | `carts` | `id, user_id FK, status ('ACTIVE','CONVERTED','ABANDONED'), coupon_code NULL, version, created_at, updated_at` — UQ one ACTIVE per user (generated key trick) |
| 29 | `cart_items` | `id, cart_id FK, product_id FK, variant_size, quantity TINYINT CHECK 1..10, price_at_add DECIMAL, created_at, updated_at` — UQ `(cart_id, product_id, variant_size)` |
| 30 | `checkout_drafts` | `user_id PK/FK, name, email, mobile, address, city, state, postal_code, delivery_method ('standard','express'), payment_method ('cod','card','razorpay'), updated_at` — mirrors `CheckoutDraft` |
| 31 | `coupons` | `id, code UQ, label, kind ('percent','amount'), value DECIMAL, min_subtotal DECIMAL, active, starts_at, ends_at, created_at, updated_at` |
| 32 | `vouchers` | `id, code UQ ('IOV072'), amount DECIMAL, return_public_id ('' if hand-issued), reason, customer_name, customer_user_id FK NULL, issued_on DATE, expires_on DATE, claimed_on DATE NULL, claimed_order VARCHAR NULL, created_at, updated_at` — UQ `(return_public_id)` where non-empty (idempotent issue per return) |
| 33 | `coupon_redemptions` (ledger) | `id, coupon_id FK NULL, voucher_id FK NULL, order_id FK, amount, created_at` — UQ `(order_id)` |

### 6.5 Orders & payments (10 tables)

| # | Table | Key columns |
|---|---|---|
| 34 | `orders` | `id, public_id ('ord-local-07' — slot pool §11, UQ), number ('IO-2026-1049', UQ), user_id FK, status ('Processing','Delivered','Payment failed','Cancelled'), console_state ('Placed','Confirmed','Cancelled'), cancelled_by NULL ('Store','Customer'), contact_name, contact_email, contact_mobile, addr_line, addr_city, addr_state, addr_postal, delivery_label, delivery_estimate, delivery_fee DECIMAL, subtotal DECIMAL, discount DECIMAL, total DECIMAL, coupon_code NULL, items_summary TEXT (' · ' joined), cancellation_eligible, placed_at DATETIME(6), version INT, created_at, updated_at` |
| 35 | `order_items` | `id, order_id FK, line_public_id, product_id FK, name, variant_label ('Washed black / M'), size, quantity, unit_price DECIMAL, line_total DECIMAL, return_eligible, returned_qty, created_at` |
| 36 | `order_status_history` (ledger) | `id, order_id FK, from_status, to_status, actor_type ('customer','staff','system'), actor_id, note, created_at, UQ(order_id, seq)` |
| 37 | `order_cancellation_requests` | `id, order_id FK, reason, note, status ('Received','Approved','Rejected'), created_at, updated_at` — backs the customer cancel form |
| 38 | `payments` | `id, public_id ('pay_ICE2003' — slot pool §11, UQ), order_id FK, customer_masked ('A•••• K••••'), gateway ('Razorpay','Stripe','Cashfree','On device','Courier'), method, amount DECIMAL, status ('Captured','Due','Failed','Refunded'), note, reference (gateway payment id, '' for COD), razorpay_order_id NULL, signature_verified TINYINT, created_at, updated_at` |
| 39 | `payment_attempts` (ledger) | `id, payment_id FK, operation ('initiate','verify','webhook','capture','refund','check'), request_json, response_json, outcome, created_at` |
| 40 | `refunds` | `id, public_id ('ref-…'), payment_id FK, order_number, amount DECIMAL, reason ('Return approved','Order cancelled','Payment mismatch','Goodwill'), status ('Requested','Processing','Succeeded','Failed'), gateway_refund_id NULL, requested_by FK, approved_by FK NULL, created_at, updated_at` |
| 41 | `payouts` | `id, public_id ('po-…'), gateway, period_label, gross DECIMAL, fees DECIMAL, status ('Pending','Paid'), paid_at NULL, created_at, updated_at` — `net` always derived `max(0, gross − fees)` |
| 42 | `idempotency_keys` | `id, scope, endpoint, key_hash BINARY(32), request_hash BINARY(32), response_status, response_body MEDIUMTEXT, expires_at, created_at` — UQ `(scope, endpoint, key_hash)` |
| 43 | `webhook_inbox` | `id, provider, event_id UQ per provider, signature_ok, payload MEDIUMTEXT, processed_at NULL, created_at` |

### 6.6 Shipping & tracking (5 tables)

| # | Table | Key columns |
|---|---|---|
| 44 | `shipments` | `id, public_id ('shp-1051', UQ), order_id FK, order_number, provider ('Blue Dart','Delhivery','Ecom Express'), awb, destination, dispatched_label ('05 Aug'), promise_label ('08–09 Aug'), status ('Dispatched','In transit','Delivered','Failed','Cancelled'), fail_reason NULL, handling NULL ('Needs action','Sending back','Back in store'), tracking_token ('track-local-07' — slot pool §11, UQ), created_at, updated_at` |
| 45 | `shipment_events` (cache) | `id, shipment_id FK, label, detail, time_label, is_complete, position, source ('internal','external'), created_at` — feeds the public tracking timeline. Internal rows come from console actions (dispatched/delivered); **external courier scans are cached here from the third-party tracking API placeholder (§9.8)** |
| 46 | `courier_pickups` | `id, public_id ('PICK-0412'…), provider, parcels, pickup_label, status ('Open','Handed over'), created_at, updated_at` |
| 47 | `shipment_labels` | `id, shipment_id FK, media_id FK, printed_count, created_at` |
| 48 | `ndr_cases` | `id, shipment_id FK UQ, reason, attempts TINYINT DEFAULT 0 CHECK <=3, status ('Open','Reattempting','RTO','Closed'), created_at, updated_at` |

### 6.7 Returns, reviews, support (7 tables)

| # | Table | Key columns |
|---|---|---|
| 49 | `return_requests` | `id, public_id ('ret-072', UQ), order_number, user_id FK, customer_name, item_label ('Bone Utility Overshirt · L'), order_item_id FK, reason ('Size / fit','Changed mind','Quality concern','Wrong item','Damaged in transit'), outcome ('Voucher','Exchange'), amount DECIMAL, replacement_product_id FK NULL, replacement_label, state ('New','Awaiting payment','Approved','Completed','Rejected'), customer_status ('Pickup scheduled','Voucher issued','Exchange on its way'), destination, reference, pickup_slot, created_at, updated_at` |
| 50 | `return_status_history` (ledger) | `id, return_id FK, from_state, to_state, actor_id, note, created_at` |
| 51 | `reviews` | `id, public_id ('REV-2041'), product_name, product_id FK NULL, rating TINYINT 1..5, customer_name, user_id FK NULL, headline, body, fit NULL, submitted_label, status ('Pending','Approved','Rejected'), origin ('Customer','Console'), order_number NULL, created_at, updated_at` — UQ `(order_number, product_id)` where both set |
| 52 | `review_moderation_history` (ledger) | `id, review_id FK, from_status, to_status, actor_id, created_at` |
| 53 | `support_queries` | `id, public_id ('IO-Q-1004', UQ), customer_name, email, topic ('Delivery','Return or exchange','Payment or refund','Product and fit','Something else'), order_number ('No order' sentinel allowed), message TEXT, sent_label, status ('Open','Resolved'), reply TEXT DEFAULT '', resolved_by FK NULL, created_at, updated_at` |
| 54 | `support_status_history` (ledger) | `id, query_id FK, from_status, to_status, actor_id, created_at` |
| 55 | `faqs` | `id, question, answer, position, is_active, created_at, updated_at` |

### 6.8 CMS, settings, platform (9 tables)

| # | Table | Key columns |
|---|---|---|
| 56 | `cms_pages` | `id, slug UQ ('home','shipping-policy','return-policy','privacy','terms'), title, type ('HOME','POLICY'), status ('Published','Draft'), current_version_id FK, updated_at, created_at` |
| 57 | `cms_page_versions` (immutable) | `id, page_id FK, version, body_json MEDIUMTEXT, published_at, created_by FK, created_at` |
| 58 | `cms_blocks` | `id, page_id FK, public_id, type ('hero','signal-strip','product-rail','destination-grid','brand-story','manifesto','service-grid'), position, is_active, config_json, created_at, updated_at` — **only those 7 types; the renderer skips anything else** |
| 59 | `store_settings` | `id, key UQ, value_json, version, updated_by FK, updated_at` — delivery fees, thresholds, COD rules, support SLAs; secrets forbidden |
| 60 | `notification_preferences` | `user_id FK, channel ('email','sms','whatsapp','push'), topic ('orders','marketing','security'), is_enabled, updated_at` — PK (user, channel, topic) |
| 60a | `inbox_messages` | `id, public_id ('msg-01'…), user_id FK, subject, preview, type ('Order','Delivery','Drop','Restock','Support'), sent_at, read_at NULL, deleted_at NULL, created_at` — the account inbox; deletes are soft so a re-seed never resurrects cleared messages |
| 61 | `contact_messages` | `id, name, email, topic, message, consent, converted_query_id FK NULL, created_at` |
| 62 | `audit_logs` (ledger) | `id, actor_id, actor_role, permission_used, action, entity_type, entity_id, before_json, after_json, request_id, ip, created_at` |
| 63 | `domain_events_outbox` | `id, event_id UQ, type, payload_json, occurred_at, processed_at NULL` |
| 64 | `job_queue` | `id, queue, type, payload_json, attempts, run_after, locked_by, locked_at, done_at, failed_at, last_error, created_at` |

### 6.9 Analytics & dashboard (3 tables)

| # | Table | Key columns |
|---|---|---|
| 65 | `trading_days` | `day DATE PK, revenue DECIMAL, orders INT, sessions INT, returns INT, refreshed_at` — 200-day rolling window the dashboard charts read |
| 66 | `ops_signals` | `id, kind ('order','payment','shipment','inventory','return','support','review'), tone ('mint','amber','rose','ink'), title, detail, href, entity_type, entity_id, created_at, cleared_at NULL` — the bell drawer (limit 40) |
| 67 | `activity_feed` (ledger) | `id, source ('Orders','Payments','Shipping','Inventory','Returns','Support'), action ('order.confirmed','payment.captured','shipment.dispatched','inventory.adjusted','return.approved','query.replied','payment.failed','stock.low'), title, detail, actor, state, tone ('good','warn','bad','info'), created_at` |

**Total: 68 tables** (+ `schema_migrations`). Views worth creating: `v_variant_availability`,
`v_order_timeline`, `v_dashboard_queues`.

---

## 7. Wire shapes

These are **the exact shapes the components render**. Presenters must emit them verbatim —
key names, casing, and formatting included. Internal storage is normalized (§6); formatting
happens only at the edge.

### 7.1 Formatting rules (Presenter layer, `en-IN`, `Asia/Kolkata`)

| Kind | Format | Example |
|---|---|---|
| Customer-facing money | `₹` + en-IN grouping, 0 decimals | `"₹17,800"` |
| Console register money | plain integer string | `"17800"` |
| Ledger amount | `String(round(amount))` | `"3499"` |
| Customer order date | `DD MMM YYYY` | `"04 Aug 2026"` |
| Ledger timestamp | `DD MMM, HH:mm` | `"04 Aug, 14:32"` |
| Short date | `DD MMM` | `"05 Aug"` |
| Date window | `DD – DD MMM` / `DD–DD MMM` | `"12 – 14 Aug"`, `"08–09 Aug"` |
| Voucher dates | ISO `YYYY-MM-DD` | `"2026-08-04"` |
| Order age | `"N h MM min"` / `"N d N h"` | `"1 h 04 min"` |
| Masked name | first letter + `••••` per word | `"A•••• K••••"` |
| Machine timestamps | epoch ms (`placedAt`) or ISO 8601 UTC | `1754899200000` |

### 7.2 Catalog

```ts
Product = { id, slug, name, category, description, story, fabric, care,
  price: number /* whole rupees */, compareAtPrice?: number, color, badge?,
  imagePosition: "top-left"|"top-right"|"bottom-left"|"bottom-right",
  audience: "men"|"women"|"unisex", collection: string, isNew: boolean,
  variants: ProductVariant[] }
ProductVariant = { id /* SKU */, size: "XS"|"S"|"M"|"L"|"XL", color, colorHex,
  material, stock: "IN_STOCK"|"LOW_STOCK"|"SOLD_OUT", available: number }
```

### 7.3 Customer order (`OrderRecord`)

```ts
OrderRecord = { id: "ord-local-07", number: "IO-2026-1049", date: "14 Aug 2026",
  total: "₹17,800", status: "Processing"|"Delivered"|"Payment failed",
  items: "Afterdark Hoodie · Core Heavy Tee",
  lines: [{ id, name, variant: "Washed black / M", quantity: 1,
            price: "₹8,900" /* line total, formatted */, returnEligible: true }],
  payment: { method: "Cash on delivery",
             status: "Captured"|"Due on delivery"|"Failed", reference: "", note? },
  shipment: { token: "track-local-07", service: "Iced_out Logistics · Surface",
              awb: "Held until payment clears" | "IOL84639201", destination: "Bengaluru 560001",
              estimate: "17 – 19 Aug" },
  cancellationEligible: boolean, placedAt: number /* epoch ms */, local: false,
  contact: { name, email, mobile }, address: { line, city, state, postalCode },
  money: { subtotal: number, discount: number, delivery: number, total: number,
           couponCode: string|null } }
```

### 7.4 Console register rows — **every value is a string** (`RecordRow`)

```ts
AdminOrderRow  = { id: "IO-2026-1049", customer, items: "2", value: "17800",
  payment: "Captured"|"Pending"|"Failed"|"Refunded",
  method: "UPI"|"Card"|"Netbanking"|"Cash on delivery",
  status: "Placed"|"Confirmed"|"Cancelled", destination, age: "1 h 04 min", cancelledBy? }
ShipmentRow    = { id: "shp-1051", order, provider: "Blue Dart"|"Delhivery"|"Ecom Express",
  awb, destination, dispatched: "05 Aug", promise: "08–09 Aug",
  status: "Dispatched"|"In transit"|"Delivered"|"Failed"|"Cancelled", reason?, handling? }
PaymentRow     = { id: "pay_ICE2003", order, customer /* masked */, gateway, method,
  amount: "3499", status: "Captured"|"Due"|"Failed"|"Refunded", note, reference,
  created: "14 Aug, 12:05" }
RefundRow      = { id, payment, order, amount, reason, status: "Requested"|"Processing"|"Succeeded"|"Failed" }
PayoutRow      = { id, gateway, period, gross, fees, net /* derived */, status: "Paid"|"Pending" }
CustomerRow    = { id: "cus-2051", name, email, phone, orders: "3", value: "₹42,600",
  state: "Active"|"Blocked", seen: "11 Aug, 18:40" }
AdminReturnRow = { id: "ret-072", order, customer, item: "Bone Utility Overshirt · L",
  reason, outcome: "Voucher"|"Exchange", amount: "11400", replacement,
  state: "New"|"Awaiting payment"|"Approved"|"Completed"|"Rejected" }
StockItemRow   = { id: "ITM-001", itemName, category: "Top"|"Bottom", itemType,
  sizes: "S,M,L,XL", warehouse: "BLR-01"|"DEL-01"|"MUM-01", totalUnits: "48", reservedUnits: "6" }
TransferRow    = { id: "TRF-004", from, to, units, dispatched,
  status: "Ready"|"In transit"|"Received"|"Cancelled" }
WarehouseRow   = { id: "BLR-01", name, available, capacity, cutoff, status: "Online"|"Draft"|"Disabled" }
CatalogProductRow = { id /* slug */, name, item /* ITM-… */, size, sku, price: "₹8,900",
  status: "Published"|"Scheduled"|"Draft", category, collection, tax?, description? }
CategoryRow    = { id, name, products }        CollectionRow = { id, name, pieces, status }
VariantRow     = { id /* SKU */, product /* slug */, size, colour, stock,
  status: "Active"|"Low"|"Out"|"Archived" }
PickupRow      = { id: "PICK-0412", provider, parcels, pickup, status: "Open"|"Handed over" }
```

### 7.5 Tracking (public)

```ts
TrackingFixture = { token, order: "IO-2026-1049", status: "Processing"|"In transit"|"Delivered",
  carrier, awb, estimate, destination /* city + PIN only — NO name/street/phone/payment */,
  events: [{ label, detail, time, complete: boolean }] }
```

### 7.6 Coupons, vouchers, reviews, support, returns (customer), CMS

```ts
Coupon  = { code /* UPPER */, label, kind: "percent"|"amount", value: number, minSubtotal: number }
Voucher = { code: "IOV072", amount: number, returnId: "ret-072"|"", reason, customer,
  issuedOn: "2026-08-04", expiresOn: "2026-11-04", claimedOn: ""|"2026-08-10", claimedOrder: ""|"IO-2026-1050" }
Review  = { id: "REV-2041", product, rating: "1".."5" /* string! */, customer, headline, body,
  submitted: "04 Aug 2026", status: "Pending"|"Approved"|"Rejected", origin: "Customer"|"Console" }
SupportQuery = { reference: "IO-Q-1004", customer, email, topic, order /* number or "No order" */,
  message, sentAt: "14 Aug 2026 · 09:18", status: "Open"|"Resolved", reply: "" }
ReturnFixture /* customer view */ = { id, order, item, variant, outcome: "Voucher"|"Exchange",
  amount: number, replacement, destination,
  status: "Pickup scheduled"|"Voucher issued"|"Exchange on its way", reference }
CmsPage  = { slug: "home", title, updatedAt /* ISO */, blocks: CmsBlock[] }
CmsBlock = { id, position: number, active: boolean,
  type: "hero"|"signal-strip"|"product-rail"|"destination-grid"|"brand-story"|"manifesto"|"service-grid" }
```

### 7.7 Dashboard & profile

```ts
TradingDay = { offset: number /* 0 = today */, revenue: number, orders: number,
  sessions: number, returns: number }                       // 200 rows deep
QueueCard  = { count: number, note: string }                // six named queues, §8.18
LogEntry   = { id, source, action, title, detail, actor, state,
  tone: "good"|"warn"|"bad"|"info", offset: number, born: number }
Signal     = { id, kind, tone: "mint"|"amber"|"rose"|"ink", title, detail,
  href /* real console route */, offset: number, born: number }
CustomerProfile = { name, email, mobile, photo: string|null /* data URL or CDN URL */ }
Address    = { id: "addr-…", label, name, lines: string[], phone }
AddressFields = { label, name, street, city, state, pincode, phone }
StaffActivityEntry = { id, when, day, action, resource, where, result }
```

---

## 8. Full endpoint catalogue

Legend: **Aud** = audience (`P` public, `C` customer cookie, `S` staff cookie) ·
**[idem]** = `Idempotency-Key` required · **Perm** = console permission code.
All paths are under `/api/v1`. All request/response bodies use the shapes of §7.

### 8.1 System (4)

| # | Method & path | Aud | Purpose |
|---|---|---|---|
| 1 | `GET /health` | P | liveness: `{ data: { ok: true } }` |
| 2 | `GET /ready` | P | DB + Redis reachable |
| 3 | `GET /version` | P | `{ data: { version, commit, built_at } }` |
| 4 | `GET /config/storefront` | P | `{ data: { currency: "INR", free_delivery_over: 4999, delivery: { standard: { fee: 199, window: [3,5] }, express: { fee: 499, window: [1,2] } }, razorpay_key_id } }` |

### 8.2 Customer auth (10)

| # | Method & path | Aud | Request → Response |
|---|---|---|---|
| 5 | `POST /auth/register` | P | `{ name, email, password (≥6) }` → sets `io_csess`; `{ data: { customer: CustomerProfile } }`. Upserts `CustomerRow` (band `cus-2050+`). 422 on duplicate email: field error `email`. |
| 6 | `POST /auth/login` | P | `{ email, password }` → sets cookie; `{ data: { customer: CustomerProfile } }`. Bumps register `seen`; Blocked stays Blocked (§5.3). 401 `ICE-AUTH-401` on bad credentials (same message for unknown email). |
| 7 | `POST /auth/logout` | C | clears cookie, revokes session → `204` |
| 8 | `GET /auth/session` | C | `{ data: { customer: CustomerProfile } }` or 401 |
| 9 | `POST /auth/google` | P | `{ id_token }` → verify OIDC, upsert user, set cookie (backs the "Continue with Google" button) |
| 10 | `POST /auth/password/forgot` | P | `{ email }` → always `202 { data: { accepted: true } }` (neutral) |
| 11 | `POST /auth/password/reset` | P | `{ token, password (≥6) }` → `204`; token single-use, 30 min |
| 12 | `POST /auth/intent` | P | `{ lines: [{ productId, size, quantity }] }` → `{ data: { intent_token } }` (signed, 15 min, no DB row) |
| 13 | `POST /auth/intent/resume` | C | `{ intent_token }` → merges into server cart → `{ data: Cart }` |
| 14 | `GET /auth/csrf` | P | reserved no-op returning `204` (future-proofing; UI sends no token) |

### 8.3 Profile / me (9)

| # | Method & path | Aud | Request → Response |
|---|---|---|---|
| 15 | `GET /me` | C | `{ data: CustomerProfile }` |
| 16 | `PATCH /me` | C | partial `{ name?, email?, mobile? }` → updated profile; email change re-validates uniqueness |
| 17 | `PUT /me/photo` | C | multipart `photo` (≤ 5 MB in, stored as 256 px JPEG) → `{ data: { photo } }` |
| 18 | `DELETE /me/photo` | C | → `{ data: { photo: null } }` |
| 19 | `POST /me/password` | C | `{ current, next (≥8) }` → `204`; rotates all other sessions |
| 20 | `GET /me/sessions` | C | `{ data: [{ id, created_at, last_active_at, ip, user_agent, current }] }` |
| 21 | `DELETE /me/sessions/{id}` | C | revoke one → `204` |
| 22 | `POST /me/sessions/revoke-others` | C | → `204` |
| 23 | `GET /me/inbox` | C | `{ data: [{ id, subject, preview, type: "Order"\|"Delivery"\|"Drop"\|"Restock"\|"Support", when, unread? }] }` — the account "Notifications" page is an **inbox** (newest first); `when` is a relative/short label ("2 hours ago", "12 Aug 2026") |
| 23a | `DELETE /me/inbox/{id}` | C | delete one message → `204` (deletions persist server-side) |
| 23b | `GET /me/notification-preferences` / `PUT` same | C | `{ data: { orders_email, orders_sms, marketing_email, marketing_sms, security_email } }` — booleans, PUT partial. No page renders this today (the old preferences panel was removed); the endpoint backs the notification engine's consent checks. |

### 8.4 Addresses (5)

| # | Method & path | Aud | Request → Response |
|---|---|---|---|
| 24 | `GET /me/addresses` | C | `{ data: { addresses: Address[], defaultId } }` |
| 25 | `POST /me/addresses` | C | `AddressFields + { makeDefault? }` → `{ data: Address }` (server mints `addr-…`; region line rendered `"City, State 560001"`) |
| 26 | `PATCH /me/addresses/{id}` | C | partial `AddressFields + { makeDefault? }` → `{ data: Address }` |
| 27 | `DELETE /me/addresses/{id}` | C | `204`; deleting the default promotes the next |
| 28 | `POST /me/addresses/{id}/default` | C | `204` |

Validation (server mirrors `checkout-validation.ts`): email `^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$`;
mobile normalizes `+91`/`0` prefix to 10 digits starting 6–9; street ≥ 6 chars; PIN exactly
6 digits not starting `0`.

### 8.5 Catalog — public (7)

| # | Method & path | Aud | Request → Response |
|---|---|---|---|
| 29 | `GET /products` | P | `?destination=all\|new-drop\|men\|women\|sale\|collection:<slug>&q=&page&per_page` → `{ data: Product[] }` (destination + free-text filter over name/category/color/collection, matching `listProducts`) |
| 30 | `GET /products/{slug}` | P | `{ data: Product }` — 404 `ICE-CAT-404` |
| 31 | `GET /products/{slug}/stock` | P | `{ data: [{ id /* SKU */, size, stock, available }] }` — polled by PDP for "Only 2 left" |
| 32 | `GET /products/{slug}/reviews` | P | approved-only `{ data: Review[], meta.pagination }` |
| 33 | `GET /collections` | P | `{ data: [{ slug, name, pieces, status }] }` |
| 34 | `GET /collections/{slug}` | P | `{ data: { collection, products: Product[] } }` |
| 35 | `GET /rating-summaries?product_ids=a,b` | P | `{ data: { [slug]: { count, average } } }` |

### 8.6 Search (2)

| # | Method & path | Aud | Request → Response |
|---|---|---|---|
| 36 | `GET /search` | P | `?q=` → `{ data: Product[] }` — case-insensitive substring over name/category/color/collection (parity with the fixture filter); logs to `search_queries` |
| 37 | `GET /search/suggest` | P | `?q=` → `{ data: [{ label, href }] }` (nav search dock, optional wire-up) |

### 8.7 Wishlist (4) — guest wishlist stays browser-local by design; these sync signed-in users

| # | Method & path | Aud | Request → Response |
|---|---|---|---|
| 38 | `GET /me/wishlist` | C | `{ data: { productIds: string[] } }` |
| 39 | `PUT /me/wishlist` | C | `{ productIds }` full replace (login merge: union) → same shape |
| 40 | `POST /me/wishlist/{productId}` | C | add → `{ data: { productIds } }` |
| 41 | `DELETE /me/wishlist/{productId}` | C | remove → `{ data: { productIds } }` |

**Ids are opaque strings.** The UI saves both real product slugs (`afterdark-hoodie`) **and
gender listing-tile ids** (`m01`–`m20`, `w01`–`w20` from `components/gender/data.ts`, each
tile mapping onto one of the real product slugs with its own display price/badge). The server
must store them verbatim without validating against the products table — resolution stays
client-side in `saved-items.ts`, which silently drops ids it can't resolve. Cap: 200 ids.

### 8.8 Cart (7) — one ACTIVE cart per customer; guests have no server cart (hard rule)

| # | Method & path | Aud | Request → Response |
|---|---|---|---|
| 42 | `GET /me/cart` | C | `{ data: { lines: [{ productId, size, quantity, product: Product }], itemCount, subtotal, coupon: Coupon\|null, discount, total } }` — lines whose product vanished are dropped server-side (parity with rehydration) |
| 43 | `POST /me/cart/items` | C | `{ productId, size, quantity=1 }` → cart payload; clamps to `min(3, available)`; 422 `ICE-CART-422` when sold out |
| 44 | `PATCH /me/cart/items` | C | `{ productId, size, quantity }` → cart; `quantity: 0` removes |
| 45 | `DELETE /me/cart/items` | C | `{ productId, size }` → cart |
| 46 | `DELETE /me/cart` | C | clear → `{ data: { lines: [], … } }` |
| 47 | `POST /me/cart/coupon` | C | `{ code }` → cart with `coupon`/`discount`, or 422 with the exact reason string the UI toasts (`redeemCoupon` messages: unknown code / below `minSubtotal` / voucher already claimed) |
| 48 | `DELETE /me/cart/coupon` | C | → cart |

Coupon engine (server-authoritative, parity with `coupons.ts` + `vouchers.ts`): table =
active promotional coupons + the signed-in customer's unclaimed vouchers
(`voucherToCoupon`: `kind:"amount", minSubtotal: 0`); `discountFor` clamps to subtotal, whole
rupees; percent rounds down.

### 8.9 Checkout & payment (9)

| # | Method & path | Aud | Request → Response |
|---|---|---|---|
| 49 | `GET /me/checkout/draft` | C | `{ data: CheckoutDraft }` (defaults: `deliveryMethod:"standard"`, `paymentMethod:"cod"`; unknown stored enums reset to defaults) |
| 50 | `PUT /me/checkout/draft` | C | partial draft → saved draft |
| 51 | `GET /checkout/delivery-options` | C | `?subtotal=` → `{ data: [{ id:"standard", label, fee /* 199 or 0 when merch subtotal ≥ 4999, computed pre-discount */, estimate:"17 – 19 Aug" }, { id:"express", fee: 499, estimate:"15 – 16 Aug" }] }` |
| 52 | `POST /checkout/orders` **[idem]** | C | **The place-order call** — body = `PlaceOrderInput` (§9.2). Validates contact/address/stock/coupon server-side, reserves stock, freezes prices, allocates `ord-local-*` slot + `IO-2026-*` number, writes payment row (COD → `Due`, failed → `Failed`, captured → `Captured`), claims voucher if used, converts cart → `{ data: OrderRecord }`. A failed gateway payment **still creates the order** with `status:"Payment failed"` (UI contract). |
| 53 | `POST /checkout/payment/initiate` **[idem]** | C | `{ order_id }` (or `{ amount_context:"cart" }` pre-order) → `{ data: { razorpay_order_id, key_id, amount /* paise */, currency:"INR", prefill: { name, email, contact }, notes } }` — **replaces `NEXT_PUBLIC_RAZORPAY_ORDER_API`**; server-side Razorpay Orders API call |
| 54 | `POST /checkout/payment/verify` **[idem]** | C | `{ order_id, razorpay_payment_id, razorpay_order_id, razorpay_signature }` → HMAC-SHA256 verify against key secret → settle payment `Captured`, append ledger row, order `Processing` → `{ data: OrderRecord }`. Bad signature → 422 `ICE-PAY-422`, payment stays unsettled, reconciliation case logged. **This is the server half of `settlePayment` — the client outcome is advisory only.** |
| 55 | `POST /checkout/payment/retry` **[idem]** | C | `{ order_id }` → fresh `razorpay_order_id` for an order whose payment is `Due`/`Failed` (refuses when already `Captured`, matching `settlePayment`'s guard) |
| 56 | `POST /checkout/cod/confirm` **[idem]** | C | `{ order_id }` → validates COD eligibility (order total ≤ 5000 by default settings) → payment `Due`, note `"Payment due at delivery"` |
| 57 | `GET /checkout/regions` | P | `{ data: { states: [{ name, cities: [] }] } }` — optional; UI has this data statically, endpoint exists for freshness |
| 58 | `POST /checkout/card/authorize` | C | `{ card_label /* "Visa ending 1111" only — NEVER PAN/CVV */, order_id }` → simulated-acquirer placeholder kept server-side; records method + label; PAN/CVV are **rejected with 400** if ever sent (SAQ-A guarantee) |

### 8.10 Customer orders (6)

| # | Method & path | Aud | Request → Response |
|---|---|---|---|
| 59 | `GET /me/orders` | C | `{ data: OrderRecord[] }` newest-first |
| 60 | `GET /me/orders/{idOrNumber}` | C | by `ord-local-*` id **or** `IO-*` number (parity with `findOrder`) → `{ data: OrderRecord }` |
| 61 | `POST /me/orders/{id}/cancel` | C | `{ reason, note? }` → `{ data: { status: "Received" } }` — backs the currently-preview cancellation form; only while `cancellationEligible` |
| 62 | `GET /me/orders/{id}/tracking` | C | `{ data: TrackingFixture }` (same presenter as public tracking, plus order linkage; courier data via the `TrackingProvider` placeholder, §9.8) |
| 63 | `GET /me/orders/{id}/invoice` | C | `application/pdf` stream (generated; GST fields from order lines) |
| 64 | `GET /me/orders/eligible-reviews` | C | `{ data: [{ order, lineId, product, variant }] }` — delivered lines minus already-reviewed (parity with `FeedbackWorkspace` derivation) |

### 8.11 Public tracking (1) — ⚠️ EXTERNAL API PLACEHOLDER

> **Delivery tracking is NOT built in-house.** A third-party tracking API (to be provided
> later) will supply live courier status and scan events. The backend keeps only a thin
> adapter seam: the endpoint below stays (the `/track/[token]` page depends on it), but its
> courier data comes from `TrackingProvider::fetch(awb)` — shipped as a **placeholder stub**
> until the external API's docs/credentials arrive. See §9.8.

| # | Method & path | Aud | Request → Response |
|---|---|---|---|
| 65 | `GET /track/{token}` | P | `{ data: TrackingFixture }` — token is the only credential; response **must never include** customer name, street, phone, or payment data (the page advertises this). Unknown token → 404 with neutral body. Pre-dispatch steps stay `complete:false`. **Implementation: resolve token → shipment internally, then merge courier `status`/`events` from the `TrackingProvider` placeholder (§9.8) — the backend never invents courier events** (parity with `trackingFromOrder`). |

### 8.12 Returns — customer (4)

| # | Method & path | Aud | Request → Response |
|---|---|---|---|
| 66 | `GET /me/returns` | C | `{ data: ReturnFixture[] }` |
| 67 | `POST /me/returns` **[idem]** | C | `{ order, lineId, variant, reason, outcome: "Voucher"\|"Exchange", replacement?, pickupSlot }` → `{ data: ReturnFixture }`; server mints `ret-NNN` (gap-filling, §11), computes `amount` from the order line, state `New`, customer status `Pickup scheduled` |
| 68 | `GET /me/returns/{id}` | C | `{ data: ReturnFixture }` |
| 69 | `GET /me/returns/eligibility?order=` | C | `{ data: [{ lineId, name, variant, returnEligible, window_ends }] }` |

### 8.13 Vouchers — customer (2)

| # | Method & path | Aud | Request → Response |
|---|---|---|---|
| 70 | `GET /me/vouchers` | C | `{ data: { vouchers: Voucher[], balance: number, redeemable: Coupon[] } }` |
| 71 | `GET /me/vouchers/{code}` | C | `{ data: Voucher }` (only own vouchers) |

Voucher claim is **not an endpoint** — placing an order with a voucher code claims it inside
the place-order transaction (`claimedOn`, `claimedOrder`), exactly as `claim(code, order)`
does today.

### 8.14 Reviews — customer (3)

| # | Method & path | Aud | Request → Response |
|---|---|---|---|
| 72 | `GET /me/reviews` | C | `{ data: Review[] }` (origin `Customer`, own) |
| 73 | `POST /me/reviews` | C | `{ product, rating: 1..5, headline, body, fit?, media_ids? }` → `{ data: Review }` — always lands `status:"Pending"`, `origin:"Customer"`, id `REV-####`; `fit` and media are accepted and stored (the UI already collects them) |
| 74 | `DELETE /me/reviews/{id}` | C | only while `Pending` → `204` |

### 8.15 Support — customer (4)

| # | Method & path | Aud | Request → Response |
|---|---|---|---|
| 75 | `GET /support/faqs` | P | `?q=` → `{ data: [{ question, answer }] }` |
| 76 | `POST /me/support/queries` | C | `{ topic /* SUPPORT_TOPICS */, order /* number or "No order" */, message (≥20 chars), consent: true }` → `{ data: SupportQuery }` — reference `IO-Q-<next>`, status `Open`, reply `""`; `customer`/`email` come from the session, not the body |
| 77 | `GET /me/support/queries` | C | own queries (matched by account, replacing the email-equality filter) |
| 78 | `GET /me/support/queries/{reference}` | C | `{ data: SupportQuery }` |

### 8.16 CMS & contact (4)

| # | Method & path | Aud | Request → Response |
|---|---|---|---|
| 79 | `GET /pages/home` | P | `{ data: CmsPage }` — blocks restricted to the 7 renderable types; inactive/unknown blocks may be present (renderer skips) but SHOULD be filtered |
| 80 | `GET /pages/{slug}` | P | policy pages (`shipping-policy`,`return-policy`,`privacy`,`terms`) → `{ data: { slug, title, updatedAt, version, sections: [{ heading, body_html }] } }`; unknown slug → 404 (UI falls back to privacy on its own) |
| 81 | `POST /contact` | P | `{ name, email, topic, message }` → `202 { data: { accepted: true } }`; stores `contact_messages`, queues a support query conversion (replaces the `setTimeout` fake submit) |
| 82 | `GET /navigation` | P | `{ data: { footer: [{ label, href }] } }` — optional; current footer is static |

### 8.17 Staff auth (6)

| # | Method & path | Aud | Request → Response |
|---|---|---|---|
| 83 | `POST /console/auth/login` | P | `{ email, password }` → sets `io_ssess` (15-min idle TTL) → `{ data: { name: "Aarav D.", role: "ADMIN", permissions: string[], expires_at } }` |
| 84 | `POST /console/auth/logout` | S | `204` |
| 85 | `GET /console/auth/session` | S | session payload or 401 (RouteGuard redirects to `/admin/login?returnTo=…`) |
| 86 | `POST /console/auth/touch` | S | slides idle expiry → `{ data: { expires_at } }` (UI throttles to 1/30 s) |
| 87 | `POST /console/auth/password/forgot` | P | `{ email }` → always `202` (neutral — the recovery page's copy documents exactly this) |
| 88 | `POST /console/auth/password/reset` | P | `{ email, token, password (≥12) }` → `204` |

### 8.18 Console dashboard (5) — Perm `dashboard.view`

| # | Method & path | Response `data` |
|---|---|---|
| 89 | `GET /console/dashboard/queues` | `{ ordersToConfirm: QueueCard, paymentExceptions, readyToDispatch, returnsToReview, stockAtRisk, openTickets }` — semantics fixed: ordersToConfirm = console_state `Placed` (note names oldest wait); paymentExceptions = payments `Failed` (notes joined `" · "`); readyToDispatch = `Confirmed` without live shipment (note counts `Failed` shipments); returnsToReview = returns `New` (note counts `Approved`); stockAtRisk = variants Low + Out; openTickets = queries `Open` (note counts those with an order) |
| 90 | `GET /console/dashboard/trading` | `?days=200` → `{ series: TradingDay[] }` (offset 0 = today; window math — current vs previous period — stays client-side in `periodFor`) |
| 91 | `GET /console/dashboard/activity` | `?after=<id>&limit=8` → `{ entries: LogEntry[] }` — poll every 15 s replaces the simulator |
| 92 | `GET /console/dashboard/pulse` | `?limit=40` → `{ signals: Signal[] }` sorted rose → amber → ink → mint; `href` points at real console routes |
| 93 | `GET /console/dashboard/summary` | headline KPIs `{ revenue_today, orders_today, sessions_today, returns_today }` |

### 8.19 Console orders (6) — Perm `orders.view` / `orders.manage`

| # | Method & path | Request → Response |
|---|---|---|
| 94 | `GET /console/orders` | `?status=&payment=&q=&page` → `{ data: AdminOrderRow[] }` (`age` recomputed at read time) |
| 95 | `GET /console/orders/{number}` | `{ data: { row: AdminOrderRow, lines: [{ productId, name, size, qty, price: number }], timeline: [{ label, at, actor }] } }` |
| 96 | `POST /console/orders/{number}/confirm` | → row with `status:"Confirmed"`; **409 `ICE-ORD-409` when payment is `Failed`** (UI disables the button; server enforces) |
| 97 | `POST /console/orders/{number}/cancel` | `{ by: "Store"\|"Customer" }` → cancels order **and atomically cancels its open shipments** (parity with `cancelOrder`), releases reservations, sets `cancelledBy` |
| 98 | `POST /console/orders/{number}/dispatch` | `{ provider, destination? }` → creates shipment `{ id: shp-<next>, status:"Dispatched", awb, tracking_token }`; **409 when a live (non-Failed/Cancelled) shipment exists** (parity with `dispatchOrder` guard); order timeline updated |
| 99 | `GET /console/orders/{number}/timeline` | append-only history |

### 8.20 Console shipments (10) — Perm `shipping.view` / `shipping.manage`

| # | Method & path | Request → Response |
|---|---|---|
| 100 | `GET /console/shipments` | `?tab=active\|failed\|all&q=` → `{ data: ShipmentRow[] }` (active = Dispatched + In transit; failed = Failed) |
| 101 | `GET /console/shipments/{id}` | `{ data: ShipmentRow & { events: [{ label, detail, time, complete }] } }` |
| 102 | `POST /console/shipments/{id}/transition` | `{ status: "In transit"\|"Delivered"\|"Failed"\|"Cancelled", reason? }` — legal moves only (§9.4); `Failed` requires `reason` from the fixed vocabulary; `Delivered` marks COD payment collectible & order `Delivered` |
| 103 | `POST /console/shipments/{id}/resend` | Failed → `In transit`, clears `handling` (NDR attempt +1, max 3) |
| 104 | `POST /console/shipments/{id}/return-to-store` | sets `handling:"Sending back"` (RTO initiated) |
| 105 | `POST /console/shipments/{id}/arrived-back` | → `status:"Cancelled"`, `handling:"Back in store"`, stock `RTO_IN` movement |
| 106 | `POST /console/shipments/{id}/label` | reprint → `{ data: { url } }` (4×6 PDF) |
| 107 | `POST /console/shipments/{id}/refresh` | **placeholder** — calls `TrackingProvider::fetch` (§9.8); with the stub bound it returns the current row unchanged + `{ refreshed: false, note: "External tracking API not yet connected" }`; once the real API lands it appends new events to the cache |
| 108 | `GET /console/pickups` + `POST /console/pickups` | list / create `{ provider, parcels, pickup }` → `PickupRow` (`PICK-04xx`) |
| 109 | `POST /console/pickups/{id}/handover` | `Open` → `Handed over` |

### 8.21 Console catalog (12) — Perm `catalog.view/edit/publish`

| # | Method & path | Request → Response |
|---|---|---|
| 110 | `GET /console/catalog/products` | `?q=&status=` → `{ data: CatalogProductRow[] }` |
| 111 | `POST /console/catalog/products` | row fields (`name, item /* ITM-… */, size, price, category, collection, tax?, description?`) → row; server mints slug + SKU (`mintSlug`/`mintSku` parity); **validates listing room against the stock item** (a listing claims one size + one piece — `listing.ts` rules verbatim, §9.6) |
| 112 | `GET /console/catalog/products/{slug}` | row + variants |
| 113 | `PATCH /console/catalog/products/{slug}` | partial row → row |
| 114 | `POST /console/catalog/products/{slug}/publish` | Draft/Scheduled → Published |
| 115 | `DELETE /console/catalog/products/{slug}` | soft delete; **cascades variants** (parity) |
| 116 | `GET /console/catalog/variants?product=` | `{ data: VariantRow[] }` |
| 117 | `POST /console/catalog/variants` | `{ product, size, colour, stock }` → row (SKU minted `<prod>-<col>-<size>`) |
| 118 | `PATCH /console/catalog/variants/{sku}` / `DELETE` | update/archive |
| 119 | `GET/POST /console/catalog/categories` + `PATCH/DELETE /{id}` | `CategoryRow` CRUD; `products` count derived |
| 120 | `GET/POST /console/catalog/collections` + `PATCH/DELETE /{id}` | `CollectionRow` CRUD |
| 121 | `GET /console/catalog/listing-room?item=ITM-001` | `{ data: { sizes: [{ size, room }] } }` — drives the editor's dropdowns |

### 8.22 Console inventory (10) — Perm `inventory.view/adjust/transfer`

| # | Method & path | Request → Response |
|---|---|---|
| 122 | `GET /console/inventory/items` | `{ data: StockItemRow[] }` (available derived; Low at `< 4`, Out at `0` — `LOW_STOCK_AT = 4`) |
| 123 | `POST /console/inventory/items` | row fields → row (`ITM-NNN` minted; sizes validated against category vocab: Top `S,M,L,XL,XXL`, Bottom `30..42`) |
| 124 | `PATCH /console/inventory/items/{id}` | partial → row; every unit change writes an `inventory_movements` ledger row |
| 125 | `DELETE /console/inventory/items/{id}` | soft delete; 409 if a published listing references it |
| 126 | `POST /console/inventory/items/{id}/reserve` | `{ reservedUnits }` clamped `0..totalUnits` → row (parity with the reserve dialog) |
| 127 | `GET /console/inventory/movements` | `?item=&page` → ledger rows |
| 128 | `GET/POST /console/inventory/transfers` | list / create `{ from, to, units, dispatched }` → `TransferRow` (`TRF-NNN`) |
| 129 | `POST /console/inventory/transfers/{id}/transition` | `{ status: "In transit"\|"Received"\|"Cancelled" }`; `Received` writes `TRANSFER_IN`/`TRANSFER_OUT` movements |
| 130 | `GET/POST /console/inventory/warehouses` + `PATCH /{id}` | `WarehouseRow` CRUD |
| 131 | `GET /console/inventory/at-risk` | `{ data: [{ item, size, level: "Low"\|"Out" }] }` (dashboard/pulse source) |

### 8.23 Console returns (8) — Perm `returns.view/approve`

| # | Method & path | Request → Response |
|---|---|---|
| 132 | `GET /console/returns` | `?tab=requests\|exchanges&state=&q=` → `{ data: AdminReturnRow[] }` (exchanges tab = `outcome:"Exchange"`) |
| 133 | `GET /console/returns/{id}` | `{ data: AdminReturnRow & { balance: { direction: "collect"\|"credit"\|"even", amount: number } } }` — balance = live catalogue price of `replacement` minus `amount` (`exchange.ts` arithmetic; replacement price is **always read live**, never stored) |
| 134 | `POST /console/returns/{id}/approve` | `New`/`Awaiting payment` → `Approved`; if exchange with `direction:"collect"` still unpaid → **422: must collect first**; `New` + collect-needed → `Awaiting payment` instead (state machine §9.5) |
| 135 | `POST /console/returns/{id}/reject` | `New` → `Rejected` |
| 136 | `POST /console/returns/{id}/collect-payment` **[idem]** | `Awaiting payment` → records difference collected → `Approved` |
| 137 | `POST /console/returns/{id}/settle` **[idem]** | `Approved` → `Completed`; **issues the voucher idempotently per return** (`voucherCodeFor`: `ret-072` → `IOV072`; UQ on `return_public_id` makes double-settle a no-op), or for exchanges creates the replacement dispatch task; stock `RETURN_IN` movement on received goods |
| 138 | `GET /console/returns/{id}/history` | append-only status history |

### 8.24 Console vouchers (4) — Perm `coupons.manage`

| # | Method & path | Request → Response |
|---|---|---|
| 139 | `GET /console/vouchers` | `?q=&state=` → `{ data: Voucher[] }` (+ derived `state: "Active"\|"Claimed"`, `source`, `purpose`) |
| 140 | `POST /console/vouchers` | `{ customer /* from live register */, amount, reason, expiresOn }` → `Voucher` (hand-issued: `returnId:""`; **expiry must be after issue date** — the register's validation) |
| 141 | `PATCH /console/vouchers/{code}` | amount/expiry/reason while unclaimed |
| 142 | `DELETE /console/vouchers/{code}` | void while unclaimed → `204` |

### 8.25 Console payments (10) — Perm `payments.view/reconcile`, `refunds.request/approve`

| # | Method & path | Request → Response |
|---|---|---|
| 143 | `GET /console/payments` | `?status=&gateway=&q=&page` → `{ data: PaymentRow[] }` |
| 144 | `GET /console/payments/{id}` | `{ data: PaymentRow & { timeline: [{ label, detail, at }] } }` |
| 145 | `POST /console/payments/{id}/collect-cod` **[idem]** | `Due` → `Captured`, note `"Cash collected on delivery"` (the ledger's one verb; e2e asserts this exact behavior) |
| 146 | `POST /console/payments/{id}/gateway-check` | live Razorpay fetch → `{ data: { gateway_status, matches: boolean } }`; mismatch opens a reconciliation case (replaces the toast-only button with the real thing) |
| 147 | `GET /console/refunds` | `{ data: RefundRow[] }` |
| 148 | `POST /console/refunds` **[idem]** | `{ payment, amount, reason }` → `Requested` |
| 149 | `POST /console/refunds/{id}/transition` | `{ status: "Processing"\|"Succeeded"\|"Failed" }`; `Succeeded` via gateway refund call (post-commit), sets payment `Refunded` when fully refunded |
| 150 | `GET /console/payouts` | `{ data: PayoutRow[] }` (`net` derived `max(0, gross − fees)`) |
| 151 | `POST /console/payouts/{id}/mark-paid` | `Pending` → `Paid` |
| 152 | `GET /console/payments/export` | `?from=&to=` → CSV stream (Perm `payments.exports.create`, rate-limited 5/hour) |

### 8.26 Console customers (6) — Perm `customers.view`

| # | Method & path | Request → Response |
|---|---|---|
| 153 | `GET /console/customers` | `?q=&state=&page` → `{ data: CustomerRow[] }` |
| 154 | `POST /console/customers` | `{ name, email, phone }` → row; **unique-email validation** with field error (parity with the add dialog); id from the `cus-2050+` band |
| 155 | `GET /console/customers/{id}` | `{ data: { row: CustomerRow, stats: { orders, value, since } } }` |
| 156 | `PATCH /console/customers/{id}` | `{ name?, phone?, state?: "Active"\|"Blocked" }` → row |
| 157 | `GET /console/customers/{id}/orders` | `{ data: [{ id, placed: "04 Aug", pieces, value: "₹17,800", status: "In fulfilment"\|"Delivered"\|"Cancelled" }] }` (read-only history table) |
| 158 | `GET /console/customers/{id}/activity` | sessions/logins summary (masked) |

### 8.27 Console reviews (4) — Perm `reviews.moderate`

| # | Method & path | Request → Response |
|---|---|---|
| 159 | `GET /console/reviews` | `?status=&q=` → `{ data: Review[] }` |
| 160 | `POST /console/reviews/{id}/approve` | → `status:"Approved"` (publishes to storefront/home) |
| 161 | `POST /console/reviews/{id}/reject` | → `status:"Rejected"` |
| 162 | `POST /console/reviews` | console-origin review `{ product, rating, customer, headline, body }` → `origin:"Console"` |

### 8.28 Console support (4) — Perm `support.tickets.manage`

| # | Method & path | Request → Response |
|---|---|---|
| 163 | `GET /console/support/queries` | `?status=open\|resolved\|all&q=` → `{ data: SupportQuery[] }` |
| 164 | `GET /console/support/queries/{reference}` | `{ data: SupportQuery }` |
| 165 | `POST /console/support/queries/{reference}/resolve` | `{ reply (required, non-empty) }` → `status:"Resolved"` — **answering IS resolving** (store semantics) |
| 166 | `POST /console/support/queries/{reference}/reopen` | → `Open`, **reply preserved** |

### 8.29 Console analytics (3) — Perm `reports.operational.view`

| # | Method & path | Response `data` |
|---|---|---|
| 167 | `GET /console/analytics/overview` | `{ registers: { orders: {...tallies by status}, payments: {...}, shipments: {...} }, period: { series: TradingDay[] } }` |
| 168 | `GET /console/analytics/breakdowns` | `{ order_status: {}, payment_state: {}, sellable_by_item: [], units_by_warehouse: [], returns_by_reason: {}, returns_by_outcome: {} }` |
| 169 | `POST /console/analytics/export` | `{ window }` → `202 { data: { job_id } }` then emailed/downloadable CSV (turns the toast-stub into a real export; permitted rows only) |

### 8.30 Console settings & staff profile (7) — Perm `settings.manage` (settings) / none (own profile)

**Route note:** the only settings page on disk is `/admin/settings/store`, and it renders the
signed-in staff member's **own account** — "Your details" (name/email/phone/photo ≤ 2 MB) and
"Password". The old seven-tab business/tax settings screen was deleted. So the page wires to
`/console/me/*` below; `/console/settings/store` still exists as the **policy value store**
(delivery fees, COD rules, thresholds) that pricing/checkout read internally — it just has no
dedicated screen today.

| # | Method & path | Request → Response |
|---|---|---|
| 170 | `GET /console/settings/store` | `{ data: { business: {...}, delivery: { standard_fee, express_fee, free_over }, cod: { max, fee, waive_over }, tax: { gstin, rates: [...] }, support_slas: [...] } }` |
| 171 | `PUT /console/settings/store` | versioned write (optimistic `version` check) → new settings; audited |
| 172 | `GET /console/me/profile` | `{ data: { name, email, phone, photo } }` |
| 173 | `PUT /console/me/profile` | partial (photo ≤ 2 MB — the settings screen's cap) → profile |
| 174 | `POST /console/me/password` | `{ current, next (≥8, ≠ current) }` → `204` |
| 175 | `GET /console/me/activity` | `?page=1&per_page=5` (preview) / `?per_page=12` (modal) → `{ data: StaffActivityEntry[], meta.pagination }` — the profile page shows 5 rows, the dialog 12 |
| 176 | `GET /console/audit-logs` | Perm `audit.view`; `?entity=&actor=&page` → audit rows (masked per role) |

### 8.31 Media (2)

| # | Method & path | Aud | Request → Response |
|---|---|---|---|
| 177 | `POST /me/media` | C | multipart (review images; ≤ 5 MB, jpeg/png/webp) → `{ data: { media_id, url } }` |
| 178 | `POST /console/media` | S | multipart (product/CMS assets) → `{ data: { media_id, url } }` |

### 8.32 Webhooks (2) — no cookies; HMAC verification; raw body persisted to `webhook_inbox` first

| # | Method & path | Verification → Effect |
|---|---|---|
| 179 | `POST /webhooks/razorpay` | `X-Razorpay-Signature` HMAC-SHA256 over raw body with `RAZORPAY_WEBHOOK_SECRET`; events `payment.captured` / `payment.failed` / `refund.processed`; **webhook and browser `verify` converge on the same settlement service — first writer wins, second is a no-op** (idempotent by `event_id` and payment reference) |
| 180 | `POST /webhooks/courier/{provider}` | **placeholder stub** — route exists, persists raw body to `webhook_inbox`, responds `202`, processes nothing. Wire the HMAC + event normalization when the external tracking API (§9.8) is provided. |

**Endpoint total: 183** (180 numbered + inbox pair `23/23a` + preference store `23b`).

---

## 9. Domain invariants & state machines

### 9.1 Money & pricing

- Merchandise subtotal = Σ (unit price × qty) in whole rupees. Coupon discount applies to the
  merchandise subtotal (`discountFor`: percent → floor; amount → clamp to subtotal).
- Delivery fee: standard ₹199 (**free when merchandise subtotal pre-discount ≥ ₹4999**),
  express ₹499 (never free). Estimates: standard 3–5 days, express 1–2 days, formatted
  `"17 – 19 Aug"`.
- `total = subtotal − discount + delivery_fee`. A ₹0-payable order settles as method
  `"Store credit"`, outcome `captured` (UI already does this — server must accept it).
- Server recomputes **everything** at place-order; the client's `money` block is
  cross-checked and a mismatch → 409 `ICE-CHK-409` (client shows a refresh prompt).

### 9.2 Place-order transaction (`POST /checkout/orders`) — the exact recipe

```
claim idempotency key
BEGIN
  lock customer's ACTIVE cart (FOR UPDATE) — must be non-empty and match request lines
  re-validate contact/address (rules §8.4) and blocked-customer check
  lock variant_inventory rows (ascending id) — for each line: available ≥ qty else 409 ICE-INV-409
  reserve: reserved += qty; write SALE_RESERVE movements; inventory_reservations HELD
           (expiry: 15 min prepaid, 10 min COD — release job §13)
  coupon/voucher: re-validate; voucher → mark claimed (claimedOn, claimedOrder)
  allocate ids: ord-local-* slot + IO-2026-<next> number + track-local-* token   (§11)
  insert orders + order_items (frozen snapshots) + status history (seq 1)
  insert payments row per outcome:
     captured → status Captured, reference = gateway payment id
     due      → status Due, gateway "Courier", reference ""
     failed   → status Failed (order status "Payment failed", awb label
                "Held until payment clears")
  cart → CONVERTED; write outbox events (order.placed, payment.recorded)
COMMIT
then (outside the transaction): notifications, ops signal, activity feed, rollups
```

Payment-first flows: the UI opens Razorpay **before** placing the order (initiate with
`amount_context:"cart"`), then places with `outcome:"captured"` + the payment id; `verify`
confirms the signature and is what actually flips server-side trust. An unverifiable
"captured" claim records the payment as `Due` pending verification and flags reconciliation —
the UI experience is unchanged.

### 9.3 Order status model (two projections, one truth)

Internal history drives two views the UI uses:
- **Customer** `status`: `Processing → Delivered` · `Payment failed` (retryable) ·
  cancelled orders show via console.
- **Console** `console_state`: `Placed → Confirmed → (dispatch → deliver)` · `Cancelled`
  (with `cancelledBy: Store|Customer`).
- Guards: confirm forbidden while payment `Failed`; dispatch forbidden while a live shipment
  exists; cancel releases reservations and cancels open shipments atomically; COD delivery
  marks payment collectible (ledger verb `collect-cod` completes it).

### 9.4 Shipment machine

```
Dispatched → In transit | Cancelled
In transit → Delivered | Failed
Failed     → In transit (resend, NDR attempt ≤ 3)
           → handling "Sending back" (RTO) → Cancelled + "Back in store" (RTO_IN stock)
```
`Failed` requires a `reason` from: `Nobody was home · Address was wrong · Customer said no ·
Could not reach the customer · Not shared yet`. `Delivered` sets order `Delivered` and COD
payment collectible.

### 9.5 Return machine (+ voucher issue)

```
New → Awaiting payment   (exchange where replacement price − amount > 0, i.e. "collect")
New → Approved | Rejected
Awaiting payment → Approved      (difference collected)
Approved → Completed             (settle: voucher issued idempotently — code IOV<NNN from ret-id>;
                                  or exchange replacement dispatched)
```
Exchange balance is always computed from the **live** catalogue price of the replacement.
Customer projection: `Pickup scheduled → Voucher issued | Exchange on its way`.

### 9.6 Stock & listing rules

- `available = total − reserved` (derived, never stored); `Low` when `0 < available < 4`,
  `Out` at 0. PDP badges: `LOW_STOCK` shows "Only N left in this size", `SOLD_OUT` disables.
- Only `StockService` writes stock; every write appends an `inventory_movements` row.
- Listing room (`listing.ts` parity): a published listing claims one size + one piece from its
  `ITM-*` stock item; the catalog editor's item/size dropdowns come from
  `/console/catalog/listing-room`; validation messages reuse the frontend's strings.
- Reservation expiry (15 min prepaid / 10 min COD unpaid) releases `reserved` via the
  scheduler with `RESERVE_EXPIRE` movements.

### 9.7 Coupon/voucher rules

Seed coupons: `AFTERDARK15` (15% ≥ ₹7500) · `FIRSTICE10` (10%, no minimum) · `FREEZE500`
(₹500 ≥ ₹4999). One coupon OR voucher per order (the UI holds a single code). Vouchers:
amount-type, no minimum, single-claim (`claimedOn` set exactly once, inside place-order);
expired vouchers excluded from `redeemable`.

### 9.8 External delivery-tracking integration — PLACEHOLDER (do not build)

Per project decision (2026-08-14): **live delivery tracking is delegated to a third-party
tracking API supplied later.** The backend implements only the seam, never the tracking logic:

```php
interface TrackingProvider {
    /** @return TrackingSnapshot { status, estimate, events: [{label, detail, time, complete}] } */
    public function fetch(string $awb, string $carrier): TrackingSnapshot;
}

final class PlaceholderTrackingProvider implements TrackingProvider {
    // TODO(EXTERNAL-TRACKING-API): replace with the real client once docs/credentials arrive.
    // Until then: returns the shipment's internally known state (Dispatched/Delivered from
    // console actions) with an empty courier-event tail — pages render, nothing is invented.
}
```

- Env placeholders (wire up later): `TRACKING_API_BASE_URL=`, `TRACKING_API_KEY=`,
  `TRACKING_API_WEBHOOK_SECRET=` — all optional; absent ⇒ placeholder provider is bound.
- What stays **internal** (it is fulfilment, not tracking): the shipments register, dispatch,
  the console state machine (§9.4), pickups, labels, tokens, and order↔shipment linkage.
- What is **deferred to the external API**: courier scan events, live in-transit status,
  EDD refresh, NDR detection from carrier data, and the courier webhook (§8.32 #180 is a
  stub route that 202-acks and logs until the provider is known).
- `shipment_events` (§6.6 #45) becomes a **cache** of externally fetched events (so `/track`
  survives provider downtime), not a system of record. The courier silence detector job
  (§13) is **deferred** until the API lands.

### 9.9 Sessions & guards (server enforces what RouteGuard draws)

Customer-only: `/me/**`, `/checkout/**`, orders/returns/vouchers/reviews/support "me" routes.
Staff-only: `/console/**` + permission per route. Public: catalog, search, CMS, tracking,
health. Audience header must match route class. The API is the real boundary; the client
guard is UX only.

---

## 10. Frontend wiring map

The integration work in the frontend is **confined to the files below** — components and
routes do not change. Each store keeps its exact public hook API; only the storage engine
switches from localStorage to the axios clients.

| Frontend seam (file) | localStorage key today | Replace with |
|---|---|---|
| `20-auth-security/auth-context.tsx` | `iced-out.customer-session` | `POST /auth/login·register·logout`, `GET /auth/session` |
| `20-auth-security` staff session | `iced-out.staff-session` (sessionStorage) | `POST /console/auth/login·logout·touch`, `GET /console/auth/session` |
| `01-users/profile-context.tsx` | `iced-out-profile-v1` | `GET /me`, `PATCH /me`, `PUT /me/photo` |
| `01-users/addresses-context.tsx` | `iced-out-addresses-v1` | §8.4 address CRUD |
| `01-users/customers-store.ts` | `iced-out.customers-v1` | §8.26 console customers (+ login upsert server-side) |
| `02-products/product-repository.ts` | fixtures | `GET /products`, `GET /products/{slug}` (query keys `productKeys.*` already exist) |
| `02-products/catalog-context.tsx` | `iced-out-catalog-v1` | §8.21 console catalog |
| `03-inventory/stock-context.tsx` | `iced-out-stock-v2` | §8.22 inventory |
| `04-cart/cart-context.tsx` | `iced-out.bag`, `iced-out.coupon` | §8.8 cart + coupon |
| `04-cart/checkout-context.tsx` | `iced-out.checkout` | §8.9 draft endpoints |
| `04-cart/checkout-flow.tsx` `complete()` | `placeOrder(...)` local | `POST /checkout/orders` (+ initiate/verify) |
| `05-wishlist` | `iced-out-wishlist-v1` | guest: keep local; signed-in: §8.7 sync |
| `06-search` | in-memory filter | `GET /search?q=` |
| `07-orders/orders-context.tsx` | `iced-out.orders` | `GET /me/orders`, `GET /me/orders/{id}`, verify/retry for `settlePayment` |
| `07-orders/fulfilment-context.tsx` | `iced-out-fulfilment-v1` | §8.19 console orders + §8.20 shipments |
| `08-tracking/tracking-from-order.ts` | derived | `GET /track/{token}` (file's own comment marks it as THE seam) — backend side is the `TrackingProvider` **placeholder** until the external tracking API arrives (§9.8) |
| `09-payment/payment-store.ts` | `iced-out-payments-v2` | §8.25 payments/refunds/payouts |
| `09-payment/razorpay.ts` `createGatewayOrder` | `NEXT_PUBLIC_RAZORPAY_ORDER_API` | `POST /checkout/payment/initiate` (+ new `verify` call after widget success) |
| `10-coupons/vouchers-context.tsx` | `iced-out.vouchers` | §8.13 customer + §8.24 console vouchers |
| `11-reviews/reviews-context.tsx` | `iced-out-reviews-v1` | §8.14 customer + §8.27 console reviews |
| `14-support/support-store.ts` | `iced-out.support-queries` | §8.15 customer + §8.28 console support |
| `15-dashboard/data/*` | computed fixtures | §8.18 dashboard endpoints |
| `16-analytics` | computed fixtures | §8.29 analytics |
| `17-shipping` fixtures | via fulfilment store | §8.20 shipments |
| `18-returns/returns-store.ts` | `iced-out-returns-v2` | §8.12 customer + §8.23 console returns |
| `19a-cms-read/api/cms-repository.ts` | fixture | `GET /pages/home` (query keys `cmsKeys.*` already exist) |
| `account/notifications` page (inbox) | `iced-out-inbox-v1` (deleted ids) | `GET /me/inbox`, `DELETE /me/inbox/{id}` |
| `20-auth-security/settings-workspace.tsx` (admin settings page) | `iced-out.admin-profile` | `GET/PUT /console/me/profile`, `POST /console/me/password` |
| `04-cart/checkout-modal-context.tsx` | — (no storage) | no new API — it gates on the auth context (`returnTo=/checkout`) and opens the same checkout flow |
| `/contact` page fake submit | `setTimeout` | `POST /contact` |

**Flow: checkout (prepaid)** — UI unchanged:
`PUT /me/checkout/draft` (each step) → `POST /checkout/payment/initiate` → Razorpay widget →
`POST /checkout/orders` `[idem]` (outcome captured + payment id) → `POST
/checkout/payment/verify` → navigate `/orders/{id}?placed=1`.
**Flow: COD** — draft → `POST /checkout/orders` (outcome `due`) → ledger row `Due` → admin
`collect-cod` after delivery → `Captured` (the e2e's pinned scenario).
**Flow: return → voucher** — customer `POST /me/returns` → console approve → settle → voucher
`IOV*` appears in `GET /me/vouchers` → applied as cart coupon → claimed at next place-order.

---

## 11. Static-export ID registry

`output: "export"` pre-renders dynamic routes **only** for the params baked at build time.
The frontend reserves spare slots for records created after the build; **the backend must
allocate public IDs from these same pools** (sequential, lowest-free-first; `IdAllocator`
service) or the new record has no page to land on:

| Route | Pre-rendered ids | Backend allocation rule |
|---|---|---|
| `/orders/[orderId]`, `/account/orders/[orderId]` | `ord-1027`, `ord-1048` + `ord-local-01…30` | new orders take `ord-local-*` slots; order **numbers** `IO-2026-<serial>` are unbounded (pages address by id, `findOrder` accepts number too) |
| `/track/[token]` | `track-1048-demo`, `track-1027-demo` + `track-local-01…30` | paired 1:1 with the order slot |
| `/admin/payments/[paymentId]` | seed ids incl. `pay_ICE1048` + `pay_ICE2001…2030` | ledger rows take `pay_ICE20xx` |
| `/admin/customers/[customerId]` | seeds + `cus-2050…2079` | new customers |
| `/admin/orders/[orderId]` | seeded `IO-2026-*` set + slots | console addresses orders by number |
| `/admin/returns/[returnId]`, `/account/returns/[returnId]` | `ret-0NN` fixture range + gap-filling | mint `ret-NNN` gap-filling (parity with `mintReturnId`) |
| `/admin/shipments/[shipmentId]` | `shp-*` seeds + slots | `shp-<next>` |
| `/admin/catalog/products/edit?id=` | query-param — **no constraint** | slugs are free |

Pool exhaustion → `503 ICE-SYS-503` with message "Order id pool exhausted — rebuild the
frontend with more slots", plus an ops alert. **Recommended:** at the first frontend rebuild,
raise the pools (e.g. 500 slots) and regenerate; the backend reads pool bounds from
`store_settings` so no code change is needed.

---

## 12. Seed parity

The UI (and the Playwright suite) expects specific records to exist. `bin/console.php seed`
must produce **exactly** these, idempotently:

| Domain | Required seed records |
|---|---|
| Users | customer `shopper@example.com` / password `secret1`, name "Iced_out Shopper", mobile `+91 98765 43210` · staff `admin@iced-out.example` / `preview1`, name **"Aarav D."**, role ADMIN |
| Products | the 4 fixture products with full variant/stock parity: `afterdark-hoodie` (XS SOLD_OUT, L available:2 LOW_STOCK, M IN_STOCK…), `bone-utility-overshirt`, `shadow-cargo-02` (category Bottoms), `core-heavy-tee` |
| Collections | Drop 001 / After Hours / Core Uniform |
| Coupons | `AFTERDARK15`, `FIRSTICE10`, `FREEZE500` (§9.7 exact params) |
| Vouchers | `IOV061` — ₹4600, returnId `ret-061`, unclaimed |
| Customer orders | `IO-2026-1027` (id `ord-1027`, **Delivered**, return-eligible line, token `track-1027-demo`) · `IO-2026-1048` (id `ord-1048`, Processing, token `track-1048-demo`); order-number serial starts **after 1048** |
| Console orders | the `admin-order-fixtures` register (statuses Placed/Confirmed/Cancelled, ages, payment states incl. at least one `Failed`) |
| Payments | seed ledger incl. **`pay_ICE1048`** (the e2e opens it) + refund and payout fixture rows |
| Shipments | fixture set incl. `shp-1045` (order IO-2026-1045) with the listed providers/statuses; failed rows carry reason/handling |
| Returns | admin fixture register (`ret-0NN`, incl. `ret-061` Completed) + customer return fixtures |
| Reviews | the 7 fixture reviews (mixed Pending/Approved) |
| Support | 3 fixture queries (`IO-Q-1001…1003`, statuses per fixture) |
| Stock | `ITM-001…` items across `BLR-01`/`DEL-01`/`MUM-01`; transfers `TRF-*`; the 3 warehouses |
| CMS | `home` page with the 7-block layout; policy pages `shipping-policy`, `return-policy` (with an "Evidence and quality control" section — e2e asserts it), `privacy`, `terms` |
| Dashboard | 200-day `trading_days` backfill; today = `{ revenue: 428420, orders: 48, sessions: 1249, returns: 5 }` for demo parity |
| FAQs | the customer-support FAQ list |
| Inbox | the 5 fixture messages (`msg-01…05`: Delivery/Drop/Restock/Support/Order, first two unread) for the seeded shopper |
| Settings | delivery ₹199/₹499/free ≥ 4999 · COD max 5000 · `LOW_STOCK_AT 4` · reservation TTLs 15/10 min · session TTLs §5.1 |

Dev seeds only — production gets real credentials and empty registers (minus settings/CMS).

---

## 13. Background jobs & scheduler

`bin/scheduler.php` from cron every minute; jobs run via `bin/worker.php` (queues:
`critical`, `notifications`, `search`, `documents`, `analytics`).

| Schedule | Task |
|---|---|
| every minute | expire `HELD` reservations past TTL → release stock (`RESERVE_EXPIRE`), mark unpaid prepaid orders `Payment failed` |
| every 5 min | refresh `trading_days` (today's row) + dashboard queue cache; payment reconciliation poller (fetch Razorpay state for `Due`/unverified payments) |
| every 15 min | ops signal compaction (clear resolved), activity-feed retention trim |
| hourly | courier silence detector — **DEFERRED** until the external tracking API (§9.8) is connected; the scheduler slot exists but the job body is a logged no-op |
| daily | payout ingestion stub, voucher expiry sweep, idempotency-key purge (>48 h), session purge, `audit/activity` retention, DB backup + restore-verify |
| on event (outbox) | notification emails (order placed/dispatched/delivered, return updates, voucher issued, support reply), rating summary refresh, search-log rollup |

Outbox pattern: services write `domain_events_outbox` inside the transaction; the worker
consumes with `FOR UPDATE SKIP LOCKED`, dedupes by `event_id`, and fans out jobs. No
domain event is ever emitted from inside an uncommitted transaction.

---

## 14. Security hardening checklist

- [ ] Only `public/` is web-reachable; `open_basedir` confined; `expose_php=Off`.
- [ ] Every query through PDO prepared statements; `PDO::ATTR_EMULATE_PREPARES=false`.
- [ ] Argon2id (`PASSWORD_ARGON2ID`) with tuned memory/time cost; peppered via `SESSION_SECRET` derivative.
- [ ] Session tokens: 32 random bytes, stored SHA-256; cookies `HttpOnly; Secure; SameSite=Lax; Path=/api/v1`.
- [ ] Origin check on all cookie-authenticated mutations (§5.2); audience check before auth (§5.1).
- [ ] Security headers: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Content-Security-Policy: default-src 'none'` (API responses are JSON), `Strict-Transport-Security` in prod.
- [ ] Rate limits per §4.7 with lockout ledger; neutral responses on auth probes (no user enumeration — matches the UI's recovery copy).
- [ ] No PAN/CVV columns anywhere; card endpoints reject PAN-shaped input (SAQ-A); only gateway references + `"Visa ending 1111"` labels stored.
- [ ] Public tracking responses contain **no PII** (name/street/phone/payment) — contract asserted by a contract test.
- [ ] Uploads: MIME sniff + re-encode images, size caps (5 MB customer / 2 MB staff photo / 8 MB console), randomized storage keys, no execution from media paths.
- [ ] Append-only ledgers enforced by DB grants (app user lacks UPDATE/DELETE on `*_history`, `*_logs`, `inventory_movements`, `payment_attempts`, `login_attempts`).
- [ ] Every console mutation writes `audit_logs` (actor, permission, before/after, request_id).
- [ ] Webhooks: raw-body HMAC before parsing, timestamp tolerance ± 5 min, replay guard on `event_id`, secrets never logged.
- [ ] Error responses never leak stack traces, SQL, or file paths; `request_id` is the support handle.
- [ ] Backups: nightly dump + binlog; restore drill documented; RPO ≤ 5 min, RTO ≤ 1 h.

---

## 15. Implementation phases & acceptance checks

Build in this order; each phase ends with contract tests green and the named e2e flows
passing against `frontend/out` served over the backend (single-origin, §3.1).

| Phase | Scope | Acceptance (mirrors `e2e/storefront.spec.ts`) |
|---|---|---|
| 0 | Kernel: router, pipeline, envelope, errors, migrations, seeds, health | `GET /health`, `/version`; envelope contract tests |
| 1 | Auth (customer + staff), sessions, guards, register upsert | login gates the bag; `returnTo` round-trip; staff console entry; recovery pages neutral |
| 2 | Catalog, search, stock read | PDP: "XS, sold out" disabled, "Only 2 left in this size", listing filter "Bottoms" hides Afterdark Hoodie |
| 3 | Cart, coupons/vouchers read, checkout draft | bag add/remove, coupon apply toasts exact reason strings |
| 4 | Place-order + payments (COD, Razorpay initiate/verify/retry) + ledger | **the COD e2e**: checkout → `/orders/ord-local-*` → heading `IO-2026-…` → admin ledger row "Cash on delivery · Due" → "Mark collected" → "Captured" |
| 5 | Console orders + shipments + inventory + tracking | confirm/cancel/dispatch guards; shipment transitions; `/track/track-1048-demo` shows privacy copy |
| 6 | Returns + vouchers + reviews + support | order `IO-2026-1027` → "Start a return"; settle issues `IOV*`; support resolve/reopen |
| 7 | Dashboard, analytics, settings, staff profile, CMS, inbox | queue counts match registers; profile activity 5/12 rows; `/pages/return-policy` sections. (Note: the e2e lines asserting "Business controls"/"Tax configuration" headings are **stale** — those settings pages were deleted from the tree; update the spec when wiring.) |
| 8 | Webhooks, jobs, reconciliation, exports, hardening pass | webhook replay is a no-op; reservation expiry releases stock; concurrency test: last unit → exactly one order + one `ICE-INV-409` |

**Definition of done:** every endpoint in §8 implemented with contract tests; the full
Playwright suite passes unmodified against the wired build; no UI file outside the seams in
§10 changed; PHPStan level 8 clean; concurrency suite green on money/stock paths.

---

*End of backend_setup.md — 183 endpoints, 68 tables, one rule: the frontend's rendered truth
is the contract.*
