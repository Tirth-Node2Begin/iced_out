# Iced_out Backend Architecture & API Contract

> **Document type:** Backend engineering and API blueprint
> **Status:** `Architecture baseline`
> **Brand:** Iced_out
> **Primary source:** [`product-blueprint.md`](./product-blueprint.md)
> **Persistence contract:** [`database.md`](./database.md)
> **Client contract:** [`frontend.md`](./frontend.md)
> **Design language:** [`../../design/docs/style-guide.md`](../../design/docs/style-guide.md)

**Version:** `1.0` · **Base URL:** `/api/v1` · **Runtime:** Core PHP 8.3+ · **Database:** MySQL 8.4 LTS (121 tables)

**Approved scope.** The backend serves **JSON only, never HTML**. A verified `CUSTOMER` session is a server-enforced precondition for cart mutation, checkout-session creation, payment initiation, and order creation; guest carts and guest orders do not exist in any form. Public catalog destinations are New Drop, Men, Women, Collections, and Sale, with About and Contact content pages. Categories remain internal classification and filter data.

---

## Table of Contents

1. Purpose and scope
2. Responsibilities and non-goals
3. Technology stack and runtime topology
4. Process entry points and bootstrap sequence
5. Layered architecture and source structure
6. Routing model — surfaces, prefixes, identifiers, versioning
7. Middleware pipeline
8. Request and response contract
9. Error model and the `ICE-*` code catalogue
10. Authentication, authorization, and scope
11. **Complete API endpoint catalogue**
12. Normative endpoint contracts — worked examples
13. Service layer catalogue and table ownership
14. Transaction recipes
15. Jobs, queues, and scheduled work
16. Integration adapters
17. Caching and invalidation
18. Search indexing
19. Media, documents, and exports
20. Observability
21. Security standards
22. Testing and quality gates
23. Configuration and environment
24. Deployment and release
25. Delivery phases and four-document cross-map
26. Backend acceptance checklist
27. Final backend principle

---

## 1. Purpose and scope

This document defines the complete backend to be built for Iced_out. It translates the 20 platform modules, the 22 end-to-end flows, and the 121-table schema into:

- process entry points, bootstrap order, and the layered request lifecycle;
- the five API surfaces, their prefixes, and every endpoint they expose;
- the request/response envelope, pagination, idempotency, rate limits, and the complete error catalogue;
- authentication, RBAC, resource scope, and field masking;
- service ownership of business rules, the transaction recipes that protect money and stock, and the queue/cron topology behind them;
- integration adapters, caching, search indexing, observability, security, testing, configuration, and release process.

The backend **is** the source of truth for price, stock, eligibility, discounts, shipping, tax, payment, permissions, and order transitions. `frontend.md` presents those rules; this document owns them.

Three rules from the blueprint govern every line below:

1. **The server owns truth.** The client sends intent (`variant_id`, `qty`, `coupon_code`); the server computes price, tax, shipping, stock, and eligibility. No client-supplied amount is ever trusted as a write input.
2. **The webhook is the truth, not the redirect.** Payment and courier state come from signed server-to-server callbacks; browser redirects only hint.
3. **Every money/stock write is idempotent and logged.** Same idempotency key → same result. Every stock change writes a ledger row. Every status change writes a history row.

---

## 2. Responsibilities and non-goals

### 2.1 Backend responsibilities

| Domain | Owned behaviour |
|---|---|
| Identity | Registration, OTP, login, social login, refresh rotation with reuse detection, staff sessions, MFA, account deletion (Module 1, 20) |
| Catalog | Products, variants, media, scheduled prices, categories, collections, size charts, publish gate (Module 2, 19b) |
| Inventory | Variant × warehouse stock, reservations, the append-only movement ledger, transfers, counts, warehouse tasks (Module 3) |
| Buying | Server-authoritative cart, pricing engine, coupon engine, tax engine, shipping rate engine, checkout sessions (Module 4, 10, 17) |
| Money | Order creation, payment initiation/verification, capture, refunds, credit notes, settlements, store credit, reconciliation (Module 7, 9, 18) |
| Fulfilment | Allocation, pick/pack/dispatch, AWB and labels, manifests, tracking normalization, NDR, RTO (Module 7, 8, 17) |
| Reverse | Return requests, reverse pickup, QC, restock, exchanges, refund arithmetic (Module 18) |
| Engagement | Reviews and moderation, notifications across email/SMS/WhatsApp/push, support tickets and chat (Module 11, 13, 14) |
| Content | CMS block read API, versioning, preview, scheduling, navigation, redirects (Module 19a, 19b) |
| Operations | Dashboard rollups, analytics reports, exports, audit trail, staff/role administration, settings (Module 15, 16, 20) |
| Platform | Idempotency, raw webhook capture, transactional outbox, queue workers, cron, search indexing, cache invalidation, media derivatives, PDF generation, sitemap/robots/redirect publication |

### 2.2 Non-goals

- No HTML rendering, no templating, no server-rendered pages. The backend returns JSON, plus a small set of non-API static documents (§11.9).
- No business logic in controllers, no SQL outside repositories, no ORM in the frontend.
- No external HTTP call inside a database transaction that holds a stock, order, invoice-sequence, or store-credit lock.
- No framework. Core PHP 8.3+ with Composer PSR-4 autoloading, PSR-12 style, PHPStan, and PHPUnit.
- No client-supplied final amount accepted anywhere on the money path.
- No anonymous cart identifier of any kind — no cart token, no cookie, no row.

---

## 3. Technology stack and runtime topology

| Layer | Technology | Notes |
|---|---|---|
| Language | PHP 8.3+ (8.4 acceptable) | `declare(strict_types=1)` in every file; typed properties, enums for constants |
| Runtime | Nginx → PHP-FPM | Zero-downtime symlink releases; opcache + JIT disabled for predictability |
| Autoload/deps | Composer, PSR-4 | No framework; libraries only for JWT, HTTP client, PDF, image, and provider SDKs |
| Style/static analysis | PSR-12, PHP_CodeSniffer, PHPStan level 8 | CI gate |
| Tests | PHPUnit, Newman (Postman collections), k6, OWASP ZAP | §22 |
| Database | MySQL 8.4 LTS, InnoDB, `utf8mb4_0900_ai_ci` | PDO with prepared statements only |
| Cache/locks/queue | Redis 7 | Catalog cache, cart read cache, session/refresh store, rate limits, distributed locks, job queue |
| Queue fallback | `job_queue` table | `FOR UPDATE SKIP LOCKED` claim; used on constrained hosting |
| Search | Meilisearch **or** Typesense (decision due before Phase 2) | Self-hosted, rebuilt from `domain_events_outbox`; MySQL `FULLTEXT` is an emergency fallback only |
| Object storage | S3-compatible + image CDN | Media, invoices, labels, exports; database stores object keys only |
| Secrets | Environment / secret manager | Never in `store_settings`, never in code, never returned by any API |

### 3.1 Runtime topology

```
                    CDN / WAF / rate limit
                             │
              ┌──────────────┴──────────────┐
              ▼                             ▼
      Static frontend bundle          Nginx → PHP-FPM (API)
      (output: 'export')                     │
                                   ┌─────────┼──────────┬────────────┐
                                   ▼         ▼          ▼            ▼
                                MySQL 8   Redis 7   Object store   Search
                                   ▲         ▲
                                   │         │
                        Queue workers    Scheduler (cron)
                        (bin/worker.php) (bin/scheduler.php)
                                   │
                        Outbound: gateways · couriers · messaging
                        Inbound:  /api/v1/webhooks/**  (HMAC verified)
```

Every process reads the same `config/`, connects to the same MySQL primary, and shares one service container. Web requests never execute long provider calls inline; workers do.

---

## 4. Process entry points and bootstrap sequence

The system has exactly **four executable entry points**. Nothing else may be invoked directly.

| # | Entry point | Invoked by | Responsibility |
|---|---|---|---|
| 1 | `backend/public/index.php` | Nginx (`try_files $uri /index.php?$query_string`) | HTTP front controller — the only web-reachable PHP file |
| 2 | `backend/bin/worker.php` | systemd / supervisor (N processes per queue) | Queue consumer — claims jobs, runs handlers, retries, dead-letters |
| 3 | `backend/bin/scheduler.php` | One system cron entry, every minute | Dispatches due scheduled tasks (§15.3) with a Redis lock per task |
| 4 | `backend/bin/console.php` | Operators / CI | CLI: migrations, seeds, reindex, cache flush, key rotation, one-off repairs |

Everything under `backend/app/**`, `backend/config/**`, and `backend/routes/**` is unreachable from the document root. Nginx exposes only `backend/public/`.

### 4.1 HTTP bootstrap — `public/index.php`

```
 1. require ../vendor/autoload.php
 2. Dotenv::load()                      → environment, fail fast on missing required keys
 3. Config::boot()                      → merge config/*.php, freeze immutable
 4. ErrorHandler::register()            → convert PHP errors/exceptions to the JSON envelope
 5. Clock::freeze()                     → one UTC request timestamp for the whole request
 6. Container::boot()                   → bind PDO, Redis, logger, providers, repositories, services
 7. RequestId::assign()                 → X-Request-Id (accept upstream, else generate UUIDv7)
 8. Request::capture()                  → method, path, query, headers, raw body, client IP
 9. Router::dispatch(Request)           → routes/*.php route table → [middleware…, controller@action]
10. MiddlewarePipeline::run()           → §7, ordered
11. Controller@action                   → validate → call service → shape response
12. ResponseEmitter::send(Envelope)     → §8 envelope, security headers, rate-limit headers
13. Terminate                           → flush deferred logs, metrics, and after-commit dispatches
```

**Failure at any step returns the standard envelope.** A bootstrap failure returns `500` with `ICE-SYS-500` and never leaks a stack trace, file path, or SQL fragment.

### 4.2 Route table registration

Route files are plain PHP arrays, one per surface, loaded in `routes/index.php`:

```
backend/routes/
├── index.php          # loads and merges the five surface tables
├── public.php         # no auth   — catalog, content, search, tracking, health
├── auth.php           # session issuance — customer + staff
├── customer.php       # customer JWT — /me, /cart, /checkout
├── console.php        # staff JWT + permission — /console/**
├── webhooks.php       # HMAC — /webhooks/**
└── partner.php        # scoped API key — /partner/**
```

```php
// routes/customer.php  (shape, not implementation)
return [
    ['POST',  '/cart/items',        CartController::class,     'addItem',
        'middleware' => ['auth:customer', 'csrf', 'rate:cart', 'validate:CartAddItem']],
    ['POST',  '/checkout/orders',   CheckoutController::class,  'placeOrder',
        'middleware' => ['auth:customer', 'csrf', 'rate:checkout', 'idempotency', 'validate:PlaceOrder']],
];
```

A route with no explicit `middleware` key still receives the global pipeline. **A route that mutates data and omits `auth:*` fails CI** — the route linter asserts that every non-`GET` route outside `public.php`/`webhooks.php` declares an audience.

### 4.3 Worker and scheduler bootstrap

Workers share steps 1–6, then loop: claim → handle → ack/retry → release. Each worker declares its queue(s), a max attempt count, and a memory ceiling after which it exits cleanly for the supervisor to restart. The scheduler shares steps 1–6, then evaluates the task table (§15.3), acquiring `lock:cron:<task>` in Redis so a multi-node deployment runs each task exactly once.

---

## 5. Layered architecture and source structure

```
            HTTP Request
                 ↓
     Router (Front Controller)          routes/*.php → controller@action
                 ↓
        Middleware Pipeline             §7 — auth · rbac · rate-limit · idempotency · csrf · validation
                 ↓
            Controllers                 thin, HTTP-only: parse, delegate, shape
                 ↓
             Services                   business rules, transactions, outbox writes
                 ↓
           Repositories                 all SQL, prepared statements, row locks
                 ↓
              Models                    typed entities and value objects
                 ↓
         MySQL 8 (InnoDB)
```

**Layer rules — enforced by PHPStan rules and CI greps:**

- A controller may not contain `SELECT`, `INSERT`, `beginTransaction`, or a pricing/eligibility decision.
- A service may not read `$_GET`, `$_POST`, headers, or emit HTTP status codes.
- A repository may not start a transaction, call another repository's write, or make an HTTP call.
- Only services open transactions. Only repositories build SQL. Only integrations call the network.
- One engine per concern: **one** pricing engine, **one** coupon engine, **one** stock engine. No controller, job, or report gets a private copy.

### 5.1 Source structure

```
backend/
├── public/
│   └── index.php                    # front controller — the only web-reachable file
├── bin/
│   ├── worker.php                   # queue consumer
│   ├── scheduler.php                # cron dispatcher
│   └── console.php                  # CLI (migrate, seed, reindex, repair)
├── app/
│   ├── Http/
│   │   ├── Router.php
│   │   ├── Request.php  Response.php  Envelope.php
│   │   └── ResponseEmitter.php
│   ├── Controllers/
│   │   ├── Storefront/              # Auth, Catalog, Search, Cms, Cart, Checkout,
│   │   │                            # Account, Orders, Returns, Reviews, Wishlist,
│   │   │                            # Notifications, Support, Tracking
│   │   ├── Console/                 # Dashboard, Orders, Fulfilment, Shipping, Catalog,
│   │   │                            # Inventory, Returns, Payments, Customers, Reviews,
│   │   │                            # Support, Marketing, Notifications, Cms, Analytics,
│   │   │                            # Access, Settings, System
│   │   ├── Webhooks/                # Payment, Courier, Messaging
│   │   └── Partner/                 # Catalog, Inventory, Orders, Subscriptions
│   ├── Middleware/                  # §7, one class per stage
│   ├── Validators/                  # request schemas mirrored against frontend Zod
│   ├── Services/
│   │   ├── Auth/  Users/  Rbac/
│   │   ├── Catalog/  Media/  Search/  Recommendations/
│   │   ├── Inventory/  Warehouse/
│   │   ├── Pricing/  Coupons/  Tax/  Shipping/
│   │   ├── Cart/  Checkout/  Orders/  Payments/  Refunds/  Settlements/
│   │   ├── Returns/  Exchanges/
│   │   ├── Reviews/  Notifications/  Support/
│   │   ├── Cms/  Analytics/  Reports/
│   │   └── Platform/                # Idempotency, Outbox, Audit, Cache, Locks, Documents
│   ├── Repositories/                # one per aggregate; all SQL lives here
│   ├── Models/                      # typed entities, value objects (Money, Sku, Pincode)
│   ├── Integrations/
│   │   ├── Gateways/                # RazorpayGateway, StripeGateway, PayPalGateway
│   │   ├── Couriers/                # ShiprocketCourier, DelhiveryCourier, BluedartCourier
│   │   ├── Messaging/               # SmtpChannel, SmsChannel, WhatsAppChannel, WebPushChannel
│   │   ├── Storage/                 # ObjectStorage, ImageDerivatives
│   │   └── Search/                  # SearchIndexer (Meilisearch|Typesense adapter)
│   ├── Jobs/                        # queue handlers + scheduled tasks
│   ├── Support/                     # Clock, Uuid, Hash, Money, Redaction, Result
│   └── Exceptions/                  # DomainException tree → ICE codes
├── config/                          # app, database, redis, queue, auth, payments, shipping,
│                                    # messaging, search, storage, rate-limits, features
├── routes/                          # §4.2
├── storage/                         # logs, tmp, invoices, labels, exports  (never web-reachable)
└── tests/
    ├── Unit/  Integration/  Contract/  Concurrency/  Security/
    └── Fixtures/
```

`database/` (migrations, seeds, views, procedures, triggers, diagrams) stays a **top-level sibling** of `backend/`, exactly as the blueprint's project structure specifies. The backend CLI runs it; it does not own it.

---

## 6. Routing model — surfaces, prefixes, identifiers, versioning

### 6.1 The five API surfaces

| # | Surface | Prefix | Authentication | Rate-limit class | Cache posture |
|---|---|---|---|---|---|
| 1 | Public catalog & content | `/api/v1/**` (unprefixed resources) | None | `public` | Public, CDN + Redis cacheable, `ETag` |
| 2 | Customer session | `/api/v1/{me,cart,checkout,auth}/**` | Customer JWT (in-memory access token) + CSRF on cookie-authenticated mutations | `customer` | `no-store`, never cached |
| 3 | Console | `/api/v1/console/**` | Staff JWT (separate audience) + permission + scope | `console` | `no-store`, never cached |
| 4 | Webhooks | `/api/v1/webhooks/**` | HMAC signature + timestamp window + replay guard | `webhook` | `no-store` |
| 5 | Partner | `/api/v1/partner/**` | Scoped API key (`api_clients.key_hash`) + IP allow-list | per-client profile | `no-store` |

A customer token presented to `/console/**` is rejected **on audience** before any role check runs; a staff token presented to `/me/**` is rejected the same way.

### 6.2 Path and identifier conventions

- Resources are **plural nouns**: `/products`, `/orders`, `/console/shipments`.
- Sub-resources nest one level: `/me/orders/{orderId}/timeline`. Deeper nesting becomes a filtered collection.
- **Public identifiers only.** Every `{...Id}` path parameter is a `public_id` (application-generated UUIDv7) — never the sequential `BIGINT` primary key, which `database.md` forbids as an authorization boundary. Two documented exceptions, both natural business keys: `{slug}` for catalog/CMS routes and `{orderNumber}` on the confirmation lookup.
- Actions that are not CRUD are a **sub-resource POST**, not a verb query string: `POST /console/returns/{returnId}/approve`, never `?action=approve`.
- Filtering `?destination=men&size=M&in_stock=true` · sorting `?sort=-created_at` · pagination `?page=1&per_page=24`.
- Query parameters are `snake_case`; JSON bodies and response fields are `snake_case`. The frontend maps to its own casing at the Zod boundary.

### 6.3 Versioning and deprecation

- URI versioning: `/api/v1`. A breaking change mints `/api/v2`; both run side by side during the sunset window.
- Additive changes (new optional field, new endpoint, new enum value on a documented open list) ship inside `v1`.
- Deprecating an endpoint sets `Deprecation: true`, `Sunset: <HTTP-date>`, and `Link: <docs-url>; rel="deprecation"` on every response for **at least 90 days** before removal.
- Status vocabularies (`orders.status`, `refunds.status`, …) are closed lists shared with `database.md` §5. Adding a value requires a migration, a service transition update, an API contract update, and tests **in the same release**.

---

## 7. Middleware pipeline

Ordered. Each stage may short-circuit with an envelope; none may swallow an error silently.

| # | Stage | Applies to | Behaviour |
|---:|---|---|---|
| 1 | `request_id` | all | Accept trusted upstream `X-Request-Id`, else generate UUIDv7. Bound to every log line, audit row, outbox event, and response `meta.request_id` |
| 2 | `security_headers` | all | HSTS, `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options: DENY`, `Cache-Control` per surface |
| 3 | `cors` | all | Strict allow-list from config; credentials allowed only for storefront and console origins; preflight answered here |
| 4 | `maintenance` | all except health | Read-only or maintenance mode returns `503 ICE-SYS-503` with `Retry-After` |
| 5 | `body_limit` | all | Reject bodies over the per-route cap (`413 ICE-REQ-413`); multipart handled by the signed-upload flow instead |
| 6 | `rate_limit:ip` | all | Coarse IP bucket before identity is known (blunt DoS guard) |
| 7 | `authenticate` | non-public | Resolve principal by audience: customer JWT · staff JWT · API key · webhook signature. Sets the immutable `Principal` |
| 8 | `csrf` | cookie-authenticated mutations | Double-submit token on `/auth/refresh` and **every** cookie-authenticated mutation. Mandatory, not conditional |
| 9 | `rate_limit:principal` | authenticated | Per-token / per-client buckets by class (§8.7); emits `X-RateLimit-*` |
| 10 | `authorize` | console, partner, owned resources | Permission check, then store/warehouse/queue scope, then row ownership. Deny by default |
| 11 | `validate` | all with input | Declarative schema per route; `422` with per-field errors. Mirrors the frontend Zod schema and is contract-tested against it |
| 12 | `idempotency` | money-path mutations | Claim/replay `idempotency_keys` on `(scope, endpoint, key_hash)`; same key + different request hash → `409 ICE-IDMP-409` |
| 13 | `feature_flag` | flagged routes | Unavailable feature returns `404`, never a partially built path |
| 14 | `audit` | privileged mutations | Records actor, permission used, reason, request ID, before/after JSON after the service commits |
| 15 | `respond` | all | Wrap in the envelope, attach rate-limit/deprecation headers, emit metrics, flush after-commit dispatches |

**Why 6 precedes 7 and 9 follows it.** A cheap IP bucket must reject floods before token verification burns CPU; the meaningful per-principal budget can only be applied once the principal exists. Both run on every authenticated request.

---

## 8. Request and response contract

### 8.1 Success envelope

```json
{
  "success": true,
  "message": "Order created successfully",
  "data": { },
  "errors": null,
  "meta": {
    "request_id": "req_9f2c81",
    "timestamp": "2026-08-03T10:30:00Z"
  }
}
```

### 8.2 Error envelope

```json
{
  "success": false,
  "message": "Size M is no longer available",
  "data": null,
  "errors": [
    { "code": "ICE-INV-409", "field": "variant_id", "detail": "Black / M sold out while you were checking out" }
  ],
  "meta": { "request_id": "req_9f2c82", "timestamp": "2026-08-03T10:31:00Z" }
}
```

`message` is the human sentence the UI may show verbatim. `errors[].detail` is the specific, actionable explanation — "Add ₹450 more to use ICE20", not "Invalid coupon". Every rejection on the coupon, stock, checkout, and refund paths carries a sentence a customer can act on.

### 8.3 Pagination

```json
"meta": { "page": 2, "per_page": 24, "total": 486, "total_pages": 21,
          "request_id": "req_9f2c83", "timestamp": "2026-08-03T10:32:00Z" }
```

`per_page` defaults to 24 (catalog) or 50 (console lists) and is capped at 100. Console exports over the cap go through the async export flow (§19.3), never through a larger page. Deep, hot lists (orders, movements, analytics events) also accept `?cursor=` and return `meta.next_cursor`; cursor and page are mutually exclusive.

### 8.4 Types and formatting

| Concern | Contract |
|---|---|
| Dates | ISO 8601 **UTC** with `Z` (`2026-08-03T10:30:00Z`). Store timezone `Asia/Kolkata` is applied for display and for quiet-hours logic only |
| Money | String decimal + currency: `{ "amount": "3499.00", "currency": "INR" }`. Never a float, never a client-supplied write input |
| Quantity | Integer. Signed only on ledger deltas |
| Booleans | `is_*` naming, real JSON booleans |
| Enums | Uppercase snake constants matching `database.md` §5 exactly |
| Null vs absent | A field the caller is not permitted to see is **absent**, not `null`; `null` means "known to be empty" |
| Masking | Masked values return a display form plus a capability hint: `{ "masked": "•••• 4242", "can_reveal": false }` |

### 8.5 Caching headers

| Surface | Headers |
|---|---|
| Public catalog/CMS | `Cache-Control: public, max-age=60, stale-while-revalidate=300` + strong `ETag`; `If-None-Match` → `304` |
| Availability (`/products/{slug}/availability`) | `Cache-Control: public, max-age=5` — short TTL by design; add-to-bag rechecks live regardless |
| Customer, console, webhook, partner | `Cache-Control: no-store` |

### 8.6 Idempotency

Required on: **order creation, payment initiate/verify, refund creation and approval, COD confirmation, label/AWB generation, settlement import, and every partner write.** Optional and honoured on any other POST.

- Header: `Idempotency-Key: <uuid>` (client-generated, per logical attempt).
- Scope key: `(principal scope, endpoint, key_hash)` in `idempotency_keys` with the request body hash.
- Replay with the **same** request hash → the stored response code and body, byte-identical.
- Replay with a **different** request hash → `409 ICE-IDMP-409`.
- In-flight duplicate (`PROCESSING`) → `409 ICE-IDMP-409` with `Retry-After: 2`.
- Records expire per config (24 h default; 7 days on refunds) and are swept by cron.

### 8.7 Rate limits

Buckets are Redis token buckets keyed by class and principal, returning `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`, and on rejection `429 ICE-RATE-429` with `Retry-After`.

| Class | Applies to | Limit |
|---|---|---|
| `auth_register` | register, OTP request, password reset request | 5/min per IP · 10/hour per identifier |
| `auth_login` | login, OTP verify | 10/min per IP; progressive delay at 3 failures, CAPTCHA at 5, 15-min lockout at 10 |
| `public_read` | catalog, CMS, collections | 120/min per IP |
| `search` | search, suggest, facets | 60/min per IP; suggestions debounce-friendly |
| `cart` | cart and wishlist mutations | 60/min per customer |
| `checkout` | checkout session, order, payment | 20/min per customer |
| `contact` | public contact form, newsletter | 3/hour per IP + per contact hash |
| `console_read` / `console_write` | console | 300/min · 60/min per staff token |
| `export` | any export creation | 5/hour per staff token |
| `webhook` | provider callbacks | 1000/min per provider, never rejected on signature-valid replays |
| `partner` | partner API | Per `api_clients.rate_limit_profile` |

---

## 9. Error model and the `ICE-*` code catalogue

### 9.1 HTTP status usage

`200` read/update · `201` created · `202` accepted (queued) · `204` deleted · `400` malformed · `401` unauthenticated · `403` unauthorized · `404` missing or feature-off · `409` conflict/state/idempotency · `410` expired · `422` validation/business-rule · `429` throttled · `500` server · `503` maintenance or provider-degraded.

### 9.2 Code format

`ICE-<MODULE>-<HTTP>` — stable, documented, and the join key between backend errors, frontend copy, and support runbooks.

| Module code | Domain | Representative codes |
|---|---|---|
| `AUTH` | Authentication, sessions | `ICE-AUTH-401` invalid credentials · `ICE-AUTH-403` blocked/unverified · `ICE-AUTH-409` account exists · `ICE-AUTH-410` OTP/reset expired · `ICE-AUTH-429` throttled |
| `USR` | Profile, addresses, deletion | `ICE-USR-404` · `ICE-USR-409` deletion blocked by open order/return/refund · `ICE-USR-422` |
| `RBAC` | Permission, scope | `ICE-RBAC-403` permission or scope denied · `ICE-RBAC-409` cannot grant a permission the actor lacks |
| `CAT` | Catalog, publish gate | `ICE-CAT-404` unpublished/archived · `ICE-CAT-409` slug/SKU conflict · `ICE-CAT-422` publish checklist failed |
| `INV` | Stock | **`ICE-INV-409` insufficient stock for an exact variant** · `ICE-INV-422` invalid movement · `ICE-INV-409` reservation expired |
| `CART` | Cart | `ICE-CART-401` guest mutation · `ICE-CART-409` line conflict · `ICE-CART-422` quantity cap (10 per variant, lower if `product_variants.max_per_order` says so) |
| `CPN` | Coupon | `ICE-CPN-404` invalid · `ICE-CPN-410` expired · `ICE-CPN-409` limit reached / stacking · `ICE-CPN-403` not eligible · `ICE-CPN-422` minimum not met |
| `CHK` | Checkout session | `ICE-CHK-409` stale step/version · `ICE-CHK-410` session expired · `ICE-CHK-422` step incomplete |
| `ORD` | Order lifecycle | **`ICE-ORD-409` illegal or out-of-sequence transition** · `ICE-ORD-403` not owner · `ICE-ORD-422` not cancellable |
| `PAY` | Payment | **`ICE-PAY-409` amount/currency mismatch** · `ICE-PAY-402` declined · `ICE-PAY-410` intent expired · `ICE-PAY-503` gateway unavailable |
| `REF` | Refund | `ICE-REF-403` approval permission required · `ICE-REF-409` exceeds refundable balance · `ICE-REF-503` gateway retry pending |
| `SHIP` | Shipping, AWB | `ICE-SHIP-422` unserviceable pincode · `ICE-SHIP-409` AWB already generated · `ICE-SHIP-503` courier unavailable |
| `TRK` | Tracking token | `ICE-TRK-404` unknown/expired token |
| `RET` | Returns, QC | `ICE-RET-403` outside window / non-returnable · `ICE-RET-409` already returned · `ICE-RET-422` evidence required |
| `EXC` | Exchanges | `ICE-EXC-409` replacement variant unavailable · `ICE-EXC-422` price difference unpaid |
| `RVW` | Reviews | `ICE-RVW-403` not a verified purchaser · `ICE-RVW-409` already reviewed for this order |
| `WSH` | Wishlist | `ICE-WSH-404` · `ICE-WSH-409` duplicate subscription |
| `NTF` | Notifications | `ICE-NTF-403` consent/suppression · `ICE-NTF-429` frequency cap |
| `SUP` | Support | `ICE-SUP-409` cannot close with an in-flight return/refund · `ICE-SUP-403` action not permitted for role |
| `CMS` | Content | `ICE-CMS-404` unpublished route · `ICE-CMS-422` missing media/alt/redirect · `ICE-CMS-410` preview token expired |
| `MEDIA` | Uploads | `ICE-MEDIA-415` type rejected · `ICE-MEDIA-413` too large · `ICE-MEDIA-422` quarantined |
| `RPT` | Reports, exports | `ICE-RPT-403` financial permission required · `ICE-RPT-202` export queued |
| `IDMP` | Idempotency | `ICE-IDMP-409` key reused with a different payload, or still processing |
| `RATE` | Throttling | `ICE-RATE-429` |
| `REQ` | Request shape | `ICE-REQ-400` malformed · `ICE-REQ-413` body too large · `ICE-REQ-422` validation failed |
| `WEBHOOK` | Inbound callbacks | `ICE-WEBHOOK-401` signature invalid · `ICE-WEBHOOK-409` duplicate event (no-op, logged) |
| `SYS` | Platform | `ICE-SYS-500` · `ICE-SYS-503` maintenance/degraded |

### 9.3 Exception mapping

Every service throws from a `DomainException` tree; a single handler maps exception class → `(HTTP status, ICE code, message, field, detail)`. Controllers never build error responses by hand, and an unmapped exception is a **test failure**, not a `500` in production.

---

## 10. Authentication, authorization, and scope

### 10.1 Token placement — normative

| Token | Placement | Rules |
|---|---|---|
| Access (15 min) | **JavaScript memory only** | Returned in the response body. Never `localStorage`, never `sessionStorage`, never a non-`HttpOnly` cookie. Lost on refresh, recovered by a silent refresh call |
| Refresh (30 d) | **`HttpOnly; Secure; SameSite=Lax` cookie**, path-scoped to `/api/v1/auth/refresh` | Rotates on every use, with reuse detection and family revocation |

Staff tokens follow the same shape with a **different cookie name** and a **different JWT audience**, path-scoped to `/api/v1/console/auth/refresh`.

### 10.2 JWT claims

```
iss  iced-out            aud  storefront | console        sub  <user public_id>
sid  <session public_id> fam  <family id>                 typ  access
rol  ["CUSTOMER"]        scp  { store: "...", warehouses: [...] }
iat  exp (15 min)        jti  <uuid>
```

Permissions are **not** embedded in the access token — they are resolved per request from `user_roles` → `role_permissions`, so a revocation takes effect on the next request rather than at token expiry. The console session endpoint returns the resolved permission set for UI rendering only.

### 10.3 Session lifecycle

- Refresh rotation consumes the old token. **Reuse revokes the entire family**, forces re-login, and emits a security notification (F1.4).
- `login_attempts` is append-only: progressive delay at 3 failures, CAPTCHA at 5, 15-minute lockout at 10. The response for "wrong password" and "no such user" is identical — no account enumeration.
- Password reset always returns `200` regardless of existence; on success every session is revoked and `audit_logs` is written.
- Production `ADMIN` requires active MFA; sensitive settings changes require step-up re-authentication (`POST /console/auth/reauth`) inside a 5-minute window.

### 10.4 Authorization order

For every request, in this order — first failure wins:

1. **Audience** — token `aud` matches the surface, else `401`.
2. **Authentication** — signature, expiry, session not revoked, user not blocked, else `401`.
3. **Permission** — the route's declared permission is in the resolved set, else `403 ICE-RBAC-403`.
4. **Store scope** — the record's `store_id` is in the principal's scope.
5. **Resource scope** — warehouse assignment, queue assignment, or `user_id` ownership.
6. **Record state** — the requested transition is legal from the current status under the current `version`, else `409`.
7. **Field scope** — the response projection masks or omits fields the permission does not cover.

Hidden UI is never a security control; step 3–7 run identically whether or not the client rendered the button.

### 10.5 Permission codes

Exactly the seeded set from `database.md` §11.1 and `frontend.md` §4.3 — no additions, no renames:

```text
dashboard.view
orders.view · orders.manage · orders.cancel
customers.view_masked · customers.view_pii
fulfilment.view · fulfilment.allocate · fulfilment.pick · fulfilment.pack · fulfilment.dispatch
shipping.view · shipping.manage · shipping.manifests.manage · shipping.ndr.manage
inventory.view · inventory.adjust · inventory.transfer
catalog.view · catalog.create · catalog.edit · catalog.publish · pricing.manage
returns.view · returns.approve · returns.qc
payments.view · payments.reconcile · payments.mismatches.manage · payments.exports.create · refunds.request · refunds.approve
reviews.view · reviews.moderate
support.tickets.view · support.tickets.manage · support.escalate
marketing.view · coupons.manage · campaigns.manage · recommendations.manage
notifications.view · notifications.manage
cms.view · cms.edit · cms.publish
reports.operational.view · reports.financial.view
staff.manage · roles.manage · settings.manage · audit.view
```

Role bundles: `ADMIN` receives all · `MANAGER` never receives `staff.manage`, `roles.manage`, `settings.manage`, or `reports.financial.view` by default · `WAREHOUSE` is warehouse-scoped and receives no pricing or financial permission · `SUPPORT` may hold `refunds.request` but **never** `refunds.approve`.

### 10.6 Field masking by role

| Field class | CUSTOMER (own) | SUPPORT | WAREHOUSE | MANAGER | ADMIN |
|---|---|---|---|---|---|
| Email / mobile | Full | Masked | Ship-to only | Masked, reveal with `customers.view_pii` | Full |
| Delivery address | Full | Masked | Fulfilment fields only | Masked/reveal | Full |
| Payment provider reference | Last 4 / masked | Masked | — | Operational read | Full |
| Bank / UPI refund destination | Own, masked after save | — | — | Masked | Reveal, audited |
| Customer risk / RTO flags | — | Read | — | Read | Full |
| Financial totals, margin | Own order only | — | — | `reports.financial.view` only | Full |

Revealing PII, exporting data, approving a refund, changing a price, assigning a role, changing settings, or reading financial reports each require the explicit permission **and** write an `audit_logs` row.

---

## 11. Complete API endpoint catalogue

All paths are relative to **`/api/v1`**. `Auth` column: `—` public · `C` customer JWT · `S` staff JWT · `K` partner API key · `H` HMAC webhook signature. `Idem` marks endpoints where `Idempotency-Key` is **required**.

### 11.1 System and platform

| Method & path | Purpose | Auth | Notes |
|---|---|---|---|
| `GET /health` | Liveness — process is up | — | No dependency checks; never rate-limited |
| `GET /ready` | Readiness — MySQL, Redis, search, storage reachable | — | Used by the load balancer; degraded returns `503 ICE-SYS-503` |
| `GET /version` | Build SHA, release tag, migration head | — | Safe metadata only |
| `GET /config/storefront` | Public non-secret policy config: currency, locale, free-shipping threshold, COD limits/fee, cart cap, return window, feature flags | — | Sourced from `store_settings`; secrets are structurally excluded |

### 11.2 Customer authentication and session — Module 1, 20 (F1)

| Method & path | Purpose | Auth | Notes |
|---|---|---|---|
| `GET /auth/csrf` | Issue the double-submit CSRF token | — | Required before any cookie-authenticated mutation |
| `POST /auth/register` | Create an `UNVERIFIED` user, queue an OTP | — | F1.1; `409 ICE-AUTH-409` if verified duplicate; unverified duplicate resends, never a second row |
| `POST /auth/otp/request` | Request/resend an OTP for register, login, or verification | — | Max 3 resends/hour; hashed, 10-minute expiry |
| `POST /auth/otp/verify` | Verify OTP → mark `VERIFIED`, issue tokens | — | Max 5 attempts then burn; runs the post-auth side-effects (F1.1 step 6) |
| `POST /auth/login` | Password login | — | Argon2id, constant-time; identical response for wrong password and unknown user |
| `POST /auth/social/{provider}` | Exchange a Google/Apple authorization code server-side | — | `provider ∈ {google, apple}`; verifies signature, issuer, audience, expiry; links by verified email, never duplicates |
| `POST /auth/refresh` | Rotate the refresh token, issue a new access token | Cookie + CSRF | Reuse detection revokes the whole family and notifies (F1.4) |
| `POST /auth/logout` | Revoke the current session | C | Clears the refresh cookie |
| `POST /auth/logout-all` | Revoke every session in the family | C | Security action; audited |
| `POST /auth/password/forgot` | Queue a single-use 30-minute reset token | — | **Always** `200` — no enumeration |
| `POST /auth/password/reset` | Set a new password using the token | — | Strength + breached-password check; revokes every session |
| `GET /auth/session` | Current identity, verification state, and safe profile | C | The client's post-refresh recovery call |
| `POST /auth/intent` | Sign a short-lived bag intent (variant, qty, safe return path) | — | F3.4; creates **no** cart row, cookie, or token |
| `POST /auth/intent/resume` | Revalidate and consume at most one signed intent after login | C | Re-checks role, signature, expiry, publication, and stock before one idempotent add |

### 11.3 Staff authentication — Module 20

| Method & path | Purpose | Auth | Notes |
|---|---|---|---|
| `POST /console/auth/login` | Staff login (separate cookie name and JWT audience) | — | Customer credentials can never create a staff session |
| `POST /console/auth/mfa/verify` | Complete the MFA challenge | — | Mandatory for production `ADMIN` |
| `POST /console/auth/refresh` | Rotate the staff refresh token | Cookie + CSRF | Path-scoped cookie; same reuse detection |
| `POST /console/auth/logout` | Revoke the staff session | S | |
| `POST /console/auth/password/forgot` | Staff reset request | — | Always `200` |
| `POST /console/auth/password/reset` | Staff reset completion | — | Revokes every staff session |
| `GET /console/auth/session` | Staff identity, roles, **resolved permissions**, and scopes | S | Drives permission-generated navigation; UI rendering only |
| `POST /console/auth/reauth` | Step-up re-authentication for sensitive actions | S | Opens a 5-minute window for settings/roles/PII reveal |

### 11.4 Public catalog, discovery, and content — Modules 2, 3, 6, 12, 19a (F2)

| Method & path | Purpose | Auth | Notes |
|---|---|---|---|
| `GET /cms/home` | Ordered, currently-scheduled home blocks | — | F2.1; typed block list, unknown types are the client's problem to fail safely |
| `GET /cms/pages/{slug}` | About, Contact, policy, and standard CMS pages | — | `404 ICE-CMS-404` when unpublished; honours redirects |
| `GET /cms/navigation` | Menu tree by menu key and locale | — | Internal targets validated at publish |
| `GET /cms/preview/{token}` | Signed, non-crawlable preview of a page version | — | `410 ICE-CMS-410` past 24 h; never cached, always `noindex` |
| `GET /products` | Published product list with filters, sort, pagination | — | Facet-aware; out-of-stock ranks last unless `in_stock=true` |
| `GET /products/{slug}` | PDP payload: product, variants, media, price, rating summary, size chart, SEO/JSON-LD source | — | F2.4; `404` for draft/archived with a redirect hint when one exists |
| `GET /products/{slug}/availability` | Live availability per variant | — | 5-second TTL; add-to-bag still rechecks (F2.4 step 3) |
| `GET /products/{slug}/size-chart` | Immutable size-chart version bound to the product | — | Required for apparel publish |
| `GET /products/{slug}/reviews` | Approved reviews, paged, with fit distribution | — | Never runs a live aggregate — reads `product_rating_summaries` |
| `GET /products/{slug}/recommendations` | Similar products and complete-the-look | — | Degrades to empty; never blocks the PDP |
| `GET /catalog/destinations/{destination}/products` | New Drop / Men / Women / Sale listing | — | F2.2; `destination ∈ {new-drop, men, women, sale}`; Sale returns only variants with an effective price below the comparison price |
| `GET /facets` | Facet options and counts for the active filter set | — | F2.2; zero-result options are returned disabled, never hidden |
| `GET /collections` | Published collection index | — | |
| `GET /collections/{slug}` | Collection detail: campaign media, metadata, ordered products | — | |
| `GET /categories` | Internal category tree for filters and facets | — | No public `/category/{slug}` page exists — this is filter data only |
| `GET /search` | Full search results with the same facet rail | — | Typo tolerance and synonyms; logs to `search_queries` |
| `GET /search/suggest` | Grouped suggestions: products, collections, destinations, trending | — | F2.3; ≤200 ms budget, cancel-safe |
| `GET /recommendations` | Context recommendations (trending, recently-viewed-driven, cart rail) | — | Personalized only when a customer token is present |
| `GET /faqs` | Published FAQ list by category and locale | — | Deflection events go to analytics |
| `GET /faqs/{slug}` | Single FAQ entry | — | |
| `GET /shipping/serviceability` | Pincode serviceability, EDD, and COD eligibility | — | F2.4 step 5; PDP and checkout share this engine |
| `POST /contact` | Public contact form → support ticket | — | `contact` rate class; never places PII in a URL or analytics event |
| `POST /newsletter/subscribe` | Marketing consent capture | — | Writes `user_consents` with source, IP, and locale |
| `POST /notifications/unsubscribe/{token}` | One-tap unsubscribe | — | Honoured within 60 seconds; suppression recorded |
| `GET /track/{token}` | Tokenized order tracking (recipient is often not the buyer) | — | F8.2; unguessable token hash; `noindex`, `no-store` |
| `GET /track/{token}/events` | Normalized shipment scan timeline for that token | — | Exposes exactly one shipment |
| `POST /analytics/events` | Consent-safe client event ingestion | — / C | Batched; no raw PII; deduplicated by `event_id` |

### 11.5 Customer session — Modules 1, 4, 5, 7, 8, 9, 10, 11, 13, 14, 18

#### 11.5.1 Account and profile (F1.5, F1.6)

| Method & path | Purpose | Auth | Notes |
|---|---|---|---|
| `GET /me` | Profile, verification state, preferences | C | |
| `PATCH /me` | Update name, contact, preferences | C | Contact change re-verifies through OTP |
| `POST /me/password` | Change password with current-password proof | C | Revokes other sessions |
| `GET /me/addresses` | Saved addresses | C | |
| `POST /me/addresses` | Add an address | C | Validation result stored |
| `PATCH /me/addresses/{addressId}` | Edit an address | C | Never mutates an order's frozen snapshot |
| `DELETE /me/addresses/{addressId}` | Soft-delete an address | C | |
| `POST /me/addresses/{addressId}/default` | Set default per address type | C | One default per type, enforced transactionally |
| `GET /me/sessions` | Active devices/sessions | C | |
| `DELETE /me/sessions/{sessionId}` | Revoke one session | C | |
| `GET /me/consents` | Current consent records | C | Versioned evidence, append-only |
| `PUT /me/consents` | Record a new consent decision | C | Appends, never overwrites |
| `GET /me/payment-methods` | Saved gateway tokens (references only) | C | No PAN, no CVV, ever |
| `DELETE /me/payment-methods/{methodId}` | Revoke a saved token | C | |
| `GET /me/store-credit` | Balance by currency | C | |
| `GET /me/store-credit/transactions` | Append-only credit ledger | C | |
| `POST /me/deletion` | Request account deletion | C | F1.6; re-auth required; `409 ICE-USR-409` with the exact blocker |
| `DELETE /me/deletion` | Cancel a pending deletion | C | Logging in during the 30-day grace also cancels it |
| `GET /me/recently-viewed` | Recently viewed products | C | |
| `POST /me/recently-viewed` | Record a view | C | |
| `POST /me/uploads/sign` | Signed upload grant for review/return evidence | C | Type, size, and count capped; assets quarantined until validated and EXIF-stripped |

#### 11.5.2 Wishlist — Module 5 (F13)

| Method & path | Purpose | Auth | Notes |
|---|---|---|---|
| `GET /me/wishlist` | Wishlist with live price and stock state | C | Sold-out items are preserved — that is the point |
| `POST /me/wishlist/items` | Add product (+ optional exact variant) | C | Remembers the viewed colour/size |
| `DELETE /me/wishlist/items/{itemId}` | Remove | C | |
| `POST /me/wishlist/sync` | Merge the guest-local wishlist after login | C | F1.1 step 6; idempotent, additive, never destructive |
| `POST /me/wishlist/items/{itemId}/subscriptions` | Subscribe to restock / price-drop / low-stock alerts | C | Fair fan-out is subscription-ordered |
| `DELETE /me/wishlist/items/{itemId}/subscriptions` | Unsubscribe | C | |
| `POST /me/wishlist/items/{itemId}/move-to-bag` | Move to bag | C | Hard authentication boundary; revalidates stock and price first |

#### 11.5.3 Cart and coupon — Modules 4, 10 (F3, F4)

| Method & path | Purpose | Auth | Notes |
|---|---|---|---|
| `GET /cart` | Full server-priced cart | C | F3.5 — revalidates price, publication, stock, coupon, and shipping on **every** read and reports each change |
| `POST /cart/items` | Add `{ variant_id, qty }` | C | F3; never a price. `401 ICE-CART-401` for guests, `403` for non-customer principals |
| `PATCH /cart/items/{itemId}` | Update quantity | C | Over-request clamps to available and says exactly what happened |
| `DELETE /cart/items/{itemId}` | Remove a line | C | Client offers a 5-second undo; the restore is revalidated server-side |
| `DELETE /cart` | Empty the cart | C | |
| `POST /cart/coupon` | Apply a coupon code | C | F4 eight-gate ladder; every rejection returns a human sentence |
| `DELETE /cart/coupon` | Remove the applied coupon | C | Applying never consumes usage, so removing never releases any |
| `POST /cart/shipping-estimate` | Estimate shipping for a pincode | C | Recomputed on every cart mutation regardless |
| `POST /cart/restore` | Restore an abandoned cart from a signed recovery token | C | F14; unavailable lines are flagged, never silently dropped |

**Cart invariant.** Every mutation response is the **complete** cart — items, discounts, shipping, tax, totals, and change flags. The client replaces state rather than patching it, so client and server can never drift.

#### 11.5.4 Checkout and payment — Modules 9, 17 (F5)

| Method & path | Purpose | Auth | Idem | Notes |
|---|---|---|---|---|
| `POST /checkout/sessions` | Create or resume the five-step session | C | | One `ACTIVE` session per cart; `409 ICE-CHK-409` on a stale version |
| `GET /checkout/sessions/current` | Current step, saved progress, totals | C | | Resumable across devices for the same customer |
| `PATCH /checkout/sessions/{sessionId}/contact` | Step 1 — contact | C | | Prefilled from the verified identity |
| `PATCH /checkout/sessions/{sessionId}/delivery` | Step 2 — delivery address | C | | Serviceability + EDD + COD eligibility computed here |
| `GET /checkout/sessions/{sessionId}/shipping-options` | Step 3 — eligible services with price and EDD | C | | Zone × weight × value |
| `PATCH /checkout/sessions/{sessionId}/shipping` | Step 3 — choose a service | C | | Snapshots the chosen rate |
| `GET /checkout/sessions/{sessionId}/payment-methods` | Step 4 — eligible methods, COD fee, saved tokens | C | | COD eligibility per §11 policy settings |
| `PATCH /checkout/sessions/{sessionId}/payment` | Step 4 — choose a method | C | | Never stores raw card fields |
| `GET /checkout/sessions/{sessionId}/review` | Step 5 — final itemized total | C | | The exact number they will be charged |
| `POST /checkout/orders` | **Create the order and reserve stock** | C | **Yes** | F5.2; whole-transaction recipe in §14.1; replay returns the original order |
| `POST /checkout/payment/initiate` | Create the gateway order/intent | C | **Yes** | Runs **after** the order transaction commits |
| `POST /checkout/payment/verify` | Browser-side verification path | C | **Yes** | F5.3; signature check + server-to-server fetch; converges with the webhook, first writer wins |
| `POST /checkout/payment/retry` | Retry a failed payment on the same order | C | **Yes** | Order stays `PENDING_PAYMENT`; reservation held for the remaining TTL |
| `POST /checkout/cod/confirm` | COD OTP / risk confirmation | C | **Yes** | F5.4; converts the 10-minute reservation to a deduction |

#### 11.5.5 Orders, tracking, cancellation — Modules 7, 8 (F6, F8, F10)

| Method & path | Purpose | Auth | Idem | Notes |
|---|---|---|---|---|
| `GET /me/orders` | Order history with filters | C | | |
| `GET /me/orders/{orderId}` | Frozen order snapshot: items, totals, payment, shipment, documents | C | | Nothing downstream re-prices a placed order |
| `GET /me/orders/{orderId}/timeline` | The canonical union timeline | C | | `v_order_timeline` — order, shipment, return, refund, support events |
| `GET /me/orders/{orderId}/invoice` | Signed, expiring invoice PDF URL | C | | Issued documents are immutable |
| `GET /me/orders/{orderId}/cancel-eligibility` | Whether, how, and with what consequence | C | | F10; `< PACKED` self-serve, `PACKED` manager approval, `≥ SHIPPED` not cancellable |
| `POST /me/orders/{orderId}/cancel` | Cancel whole order or selected lines | C | **Yes** | State re-checked under lock; coupon discount re-prorated across remaining items |
| `GET /me/orders/{orderId}/return-eligibility` | Server-computed return eligibility per line | C | | F11.1 — the button only exists when this passes |
| `GET /me/orders/{orderId}/shipments` | Shipment list with AWB and courier | C | | |
| `GET /me/shipments/{shipmentId}/events` | Scan timeline for one shipment | C | | Same rows the console reads |

#### 11.5.6 Returns, exchanges, refunds — Module 18 (F11, F12)

| Method & path | Purpose | Auth | Idem | Notes |
|---|---|---|---|---|
| `POST /me/returns` | Create a return request for selected items and quantities | C | **Yes** | Reason code required; photos mandatory for `DAMAGED_IN_TRANSIT` and `QUALITY_ISSUE` |
| `GET /me/returns` | Return history | C | | |
| `GET /me/returns/{returnId}` | Return detail with refund estimate arithmetic | C | | Estimate shown **before** confirmation |
| `GET /me/returns/{returnId}/timeline` | Reverse-leg timeline including QC outcome and evidence | C | | Partial/failed QC shows the evidence |
| `POST /me/returns/{returnId}/evidence` | Attach photos to a return item | C | | Signed upload; quarantined until validated |
| `POST /me/returns/{returnId}/cancel` | Withdraw a return before pickup | C | | Releases any exchange reservation |
| `GET /me/returns/{returnId}/pickup-slots` | Available reverse-pickup windows | C | | |
| `POST /me/returns/{returnId}/pickup` | Schedule or reschedule pickup | C | | Max 3 attempts, then auto-close with notification |
| `GET /me/refunds` | Refund list with status | C | | "Refund initiated" is a state, not a one-time email |
| `GET /me/refunds/{refundId}` | Arithmetic, destination, reference, expected completion | C | | Traceable order → payment → refund → gateway ID → settlement line |
| `POST /me/refunds/{refundId}/destination` | Submit a bank/UPI destination for a COD refund | C | | Application-encrypted; one-time verification |
| `GET /me/exchanges/{exchangeId}` | Exchange status and replacement tracking | C | | Replacement stock is reserved at approval, not dispatch |
| `POST /me/exchanges/{exchangeId}/pay-difference` | Pay a higher-priced replacement difference | C | **Yes** | Lower-priced differences are refunded automatically |

#### 11.5.7 Reviews, notifications, support — Modules 11, 13, 14 (F15, F17, F18)

| Method & path | Purpose | Auth | Notes |
|---|---|---|---|
| `GET /me/reviews/pending` | Delivered items eligible for review | C | Drives the t+3d invite deep links |
| `POST /products/{productId}/reviews` | Submit a review | C | F15; requires a `DELIVERED` order item; one review per product per order |
| `GET /me/reviews` | Own reviews with moderation state and reason | C | Rejections show the policy reason |
| `PATCH /me/reviews/{reviewId}` | Edit a review before approval | C | Re-enters screening |
| `DELETE /me/reviews/{reviewId}` | Withdraw a review | C | Never deletes moderation history |
| `POST /me/reviews/{reviewId}/media` | Attach up to five images | C | Photo reviews surface first because they convert |
| `GET /me/notifications` | In-app notification feed | C | |
| `POST /me/notifications/{notificationId}/read` | Mark read | C | |
| `GET /me/notification-preferences` | Channel and event preferences, quiet hours | C | Transactional and marketing never share a switch |
| `PUT /me/notification-preferences` | Update preferences | C | Marketing off never suppresses transactional messages |
| `POST /me/push/subscriptions` | Register a Web Push endpoint (VAPID) | C | Endpoint stored hashed + encrypted |
| `DELETE /me/push/subscriptions/{subscriptionId}` | Remove an endpoint | C | Invalid endpoints auto-suppress |
| `GET /me/tickets` | Own support tickets | C | |
| `POST /me/tickets` | Open a ticket with order/return/payment context | C | F18; context travels with it so nobody repeats themselves |
| `GET /me/tickets/{ticketId}` | Thread, attachments, SLA expectation | C | Internal notes are never projected |
| `POST /me/tickets/{ticketId}/messages` | Reply | C | Resumes a paused SLA clock |
| `POST /me/tickets/{ticketId}/reopen` | Reopen within 7 days | C | |
| `POST /me/tickets/{ticketId}/csat` | Submit CSAT after resolution | C | Reported per agent and per category |
| `POST /support/chat/sessions` | Start a chatbot session | — / C | Answers only from live order/refund/fit data |
| `POST /support/chat/messages` | Send a chat message; hand off with full transcript | — / C | Handoff creates a ticket carrying the transcript |

### 11.6 Console — `/console/**` (staff JWT + permission + scope)

#### 11.6.1 Dashboard and global search — Module 15 (F19)

| Method & path | Purpose | Permission | Notes |
|---|---|---|---|
| `GET /console/dashboard/summary` | KPI tiles from `dashboard_rollups` | `dashboard.view` | Never scans live order/payment tables; financial tiles require `reports.financial.view` |
| `GET /console/dashboard/queues` | The ten action queues with counts | `dashboard.view` | Each entry deep-links to a prefiltered list |
| `GET /console/dashboard/alerts` | Breaches, provider failures, stale rollups | `dashboard.view` | Includes rollup freshness watermark |
| `GET /console/search` | Global lookup: order, payment reference, product, customer, SKU, AWB, ticket | `dashboard.view` | Results filtered by the caller's scope and masking |

#### 11.6.2 Orders — Module 7

| Method & path | Purpose | Permission | Notes |
|---|---|---|---|
| `GET /console/orders` | Filterable, cursor-paged order list | `orders.view` | |
| `GET /console/orders/queues/{queue}` | Named operational queue | `orders.view` | `queue ∈ {awaiting-confirmation, ready-to-pack, awaiting-dispatch, on-hold, payment-pending}` |
| `GET /console/orders/{orderId}` | Full order: items, payment attempts, shipments, returns, documents, activity | `orders.view` | Field masking per role |
| `GET /console/orders/{orderId}/timeline` | Status history + linked aggregate events | `orders.view` | Same rows the customer timeline reads |
| `POST /console/orders/{orderId}/status` | Legal state transition with reason | `orders.manage` | Guarded by the F6.2 machine; illegal → `409 ICE-ORD-409`; appends `order_status_history` |
| `POST /console/orders/{orderId}/cancel` | Cancel the order | `orders.cancel` | **Idem** · §14.3; releases stock and coupon, queues the refund |
| `POST /console/orders/{orderId}/items/{itemId}/cancel` | Cancel one line | `orders.cancel` | **Idem** · re-prorates the coupon; drops it if the minimum is no longer met |
| `POST /console/orders/{orderId}/notes` | Internal note | `orders.view` | Never customer-visible |
| `GET /console/orders/{orderId}/documents` | Invoice, credit notes, packing slip, label links | `orders.view` | Signed, expiring URLs |
| `POST /console/orders/{orderId}/documents` | Regenerate a document | `orders.manage` | Regenerates the PDF; never re-allocates a number |
| `POST /console/orders/exports` | Queue an order export | `payments.exports.create` | **Idem** · async, audited |

#### 11.6.3 Fulfilment and warehouse — Modules 3, 7 (F7, F21)

| Method & path | Purpose | Permission | Notes |
|---|---|---|---|
| `GET /console/fulfilment/allocations` | Allocation queue | `fulfilment.view` | Warehouse-scoped |
| `POST /console/fulfilment/allocations` | Allocate an order to a warehouse | `fulfilment.allocate` | Ship-complete + nearest zone; splitting is a last resort |
| `GET /console/fulfilment/waves` | Pick waves | `fulfilment.view` | |
| `POST /console/fulfilment/waves` | Create a wave batched by bin sequence | `fulfilment.pick` | |
| `GET /console/fulfilment/tasks` | Scanner work queue (`PICK`, `PACK`, `DISPATCH`, `RETURN_QC`) | `fulfilment.view` | Assigned-warehouse scope only |
| `GET /console/fulfilment/tasks/{taskId}` | Task with expected lines and bins | `fulfilment.view` | |
| `POST /console/fulfilment/tasks/{taskId}/assign` | Claim or assign a task | `fulfilment.pick` | |
| `POST /console/fulfilment/tasks/{taskId}/scan` | Record one barcode scan | `fulfilment.pick` / `.pack` | A wrong SKU raises an exception and **never** increments the expected line |
| `POST /console/fulfilment/tasks/{taskId}/complete` | Complete a task | `fulfilment.pack` | Pack completes only on an exact accepted match |
| `POST /console/fulfilment/tasks/{taskId}/exception` | Raise `SHORT_PICK`, damage, or mismatch | `fulfilment.pick` | Triggers a cycle count and reroute/hold |
| `POST /console/fulfilment/pack/{orderId}/measure` | Capture actual weight and dimensions | `fulfilment.pack` | Variance beyond tolerance flags the product's stored weight |

#### 11.6.4 Shipping, tracking, NDR — Modules 8, 17 (F8)

| Method & path | Purpose | Permission | Notes |
|---|---|---|---|
| `GET /console/shipments` | Shipment list with direction and status | `shipping.view` | |
| `GET /console/shipments/{shipmentId}` | Shipment detail and normalized events | `shipping.view` | |
| `POST /console/shipments` | Create a parcel and generate the AWB | `shipping.manage` | **Idem** · idempotent per parcel — a reprint reuses the same AWB |
| `POST /console/shipments/{shipmentId}/label` | (Re)generate the 4×6 label | `shipping.manage` | Retry queue after 3 failures alerts ops; never silently stuck |
| `POST /console/shipments/{shipmentId}/cancel` | Void a pre-handover shipment | `shipping.manage` | Only before courier handover |
| `POST /console/shipments/{shipmentId}/refresh` | Poll the courier for authoritative status | `shipping.view` | Also driven automatically by the silence detector |
| `GET /console/manifests` | Manifests per courier per day | `shipping.manifests.manage` | |
| `POST /console/manifests` | Open a manifest | `shipping.manifests.manage` | |
| `POST /console/manifests/{manifestId}/close` | Close for handover | `shipping.manifests.manage` | |
| `POST /console/manifests/{manifestId}/handover` | Record the courier pickup scan | `shipping.manifests.manage` | Moves every shipment on the manifest to `SHIPPED` in one event |
| `GET /console/ndr` | NDR queue by response deadline | `shipping.ndr.manage` | |
| `GET /console/ndr/{caseId}` | Case detail, attempts, customer response | `shipping.ndr.manage` | |
| `POST /console/ndr/{caseId}/attempts` | Log a contact or delivery reattempt | `shipping.ndr.manage` | Max 3 delivery reattempts, enforced |
| `POST /console/ndr/{caseId}/resolution` | Reschedule, correct the address, or send to RTO | `shipping.ndr.manage` | Reason captured; no response in 48 h defaults to RTO |
| `GET /console/shipping/providers` | Adapter configuration and health (no secrets) | `shipping.view` | |
| `PATCH /console/shipping/providers/{providerId}` | Enable/disable, priority, capabilities | `shipping.manage` | Credentials stay in the secret manager |
| `GET /console/shipping/zones` | Zones and postal serviceability | `shipping.view` | |
| `PUT /console/shipping/zones/{zoneId}` | Update a zone and its postal ranges | `shipping.manage` | Postal codes are strings, never numbers |
| `GET /console/shipping/rates` | Effective rate cards | `shipping.view` | |
| `PUT /console/shipping/rates/{rateId}` | Update a rate card | `shipping.manage` | Checkout snapshots the chosen result |

#### 11.6.5 Catalog — Module 2 (F20)

| Method & path | Purpose | Permission | Notes |
|---|---|---|---|
| `GET /console/products` | Catalog list with status filters | `catalog.view` | |
| `POST /console/products` | Create a draft | `catalog.create` | |
| `GET /console/products/{productId}` | Full editor payload across the eight steps | `catalog.view` | |
| `PATCH /console/products/{productId}` | Update details, SEO, policy, shipping dimensions | `catalog.edit` | |
| `GET /console/products/{productId}/publish-checklist` | Every blocker, field-addressable | `catalog.view` | ≥1 variant · ≥1 image with alt · price · category · weight & dimensions · size chart · unique slug |
| `POST /console/products/{productId}/publish` | Run the hard gate and publish | `catalog.publish` | `422 ICE-CAT-422` lists every failure; success fires reindex, cache invalidation, sitemap, feeds, restock alerts |
| `POST /console/products/{productId}/archive` | Archive (never delete once ordered) | `catalog.publish` | Requires a 301/410 disposition |
| `GET /console/products/{productId}/variants` | Variant matrix | `catalog.view` | |
| `POST /console/products/{productId}/variants` | Generate or add size × colour × material variants | `catalog.edit` | SKU auto-generated; unique on `(product, size, colour, material)` |
| `PATCH /console/variants/{variantId}` | Edit SKU, barcode, status, per-order cap, overrides | `catalog.edit` | `max_per_order` may lower the cart cap, never raise it |
| `DELETE /console/variants/{variantId}` | Remove an unordered variant | `catalog.edit` | Ordered variants archive instead |
| `POST /console/media/uploads/sign` | Signed upload grant for catalog media | `catalog.edit` | Validated, malware-scanned, EXIF-stripped, quarantined |
| `POST /console/products/{productId}/media` | Attach media to a product/colourway | `catalog.edit` | Alt text required for publishable imagery |
| `PATCH /console/media/{mediaId}` | Reorder, re-role, edit alt text | `catalog.edit` | |
| `DELETE /console/media/{mediaId}` | Detach media | `catalog.edit` | Published content can never reference quarantined media |
| `GET /console/products/{productId}/prices` | Effective and scheduled prices | `catalog.view` | |
| `POST /console/products/{productId}/prices` | Set or schedule a price window | `pricing.manage` | `discount_price < selling_price ≤ mrp`; overlapping windows rejected |
| `GET /console/products/{productId}/price-history` | Append-only change log | `pricing.manage` | Feeds margin reporting |
| `GET /console/categories` | Category tree | `catalog.view` | |
| `POST /console/categories` | Create a category | `catalog.edit` | Cycles rejected |
| `PATCH /console/categories/{categoryId}` | Rename, move, publish | `catalog.edit` | Renaming a published slug requires a redirect |
| `GET /console/collections` | Collections and drops | `catalog.view` | |
| `POST /console/collections` | Create a collection with a schedule | `catalog.edit` | |
| `PATCH /console/collections/{collectionId}` | Update metadata, schedule, SEO | `catalog.edit` | |
| `PUT /console/collections/{collectionId}/products` | Set ordered membership | `catalog.edit` | Position-ordered |
| `GET /console/size-charts` | Chart versions | `catalog.view` | |
| `POST /console/size-charts` | Create a new immutable chart version | `catalog.edit` | Published products bind to a version |
| `GET /console/catalog/vocabularies/{axis}` | Sizes, colours, materials, tags | `catalog.view` | `axis ∈ {sizes, colors, materials, tags}` |
| `POST /console/catalog/vocabularies/{axis}` | Add a vocabulary value | `catalog.edit` | Codes are stable once used; a new sellable **axis** requires a migration |
| `GET /console/catalog/imports` | CSV import jobs | `catalog.view` | |
| `POST /console/catalog/imports` | Start an import | `catalog.create` | Same validation as the UI; per-row results |
| `GET /console/catalog/imports/{importId}` | Status, counts, downloadable correction file | `catalog.view` | Row results live in the object store, not in SQL |

#### 11.6.6 Inventory and warehouses — Module 3 (F21)

| Method & path | Purpose | Permission | Notes |
|---|---|---|---|
| `GET /console/inventory` | Stock by variant × warehouse: `on_hand`, `reserved`, `available` | `inventory.view` | The three values are always presented distinctly |
| `GET /console/inventory/{variantId}` | Per-variant detail, thresholds, velocity | `inventory.view` | |
| `GET /console/inventory/movements` | Append-only ledger | `inventory.view` | Immutable in the UI; corrections are new movements |
| `GET /console/inventory/reservations` | Active and expiring reservations | `inventory.view` | |
| `GET /console/inventory/low-stock` | At/below threshold, with reorder signal | `inventory.view` | Alerts fire once per threshold crossing |
| `POST /console/inventory/adjustments` | `ADJUST_UP` / `ADJUST_DOWN` / `DAMAGE` with a mandatory reason | `inventory.adjust` | **Idem** · one movement row per adjustment; no direct `UPDATE` to stock exists anywhere |
| `GET /console/warehouses` | Warehouses and service flags | `inventory.view` | |
| `POST /console/warehouses` | Create a warehouse | `settings.manage` | |
| `PATCH /console/warehouses/{warehouseId}` | Update address, timezone, flags | `settings.manage` | |
| `GET /console/warehouses/{warehouseId}/bins` | Bin/pick-sequence map | `inventory.view` | |
| `PUT /console/warehouses/{warehouseId}/bins` | Replace the bin map | `inventory.transfer` | |
| `GET /console/transfers` | Inter-warehouse transfers | `inventory.view` | |
| `POST /console/transfers` | Request a transfer | `inventory.transfer` | Source ≠ destination |
| `POST /console/transfers/{transferId}/dispatch` | `TRANSFER_OUT` | `inventory.transfer` | In-transit stock is never storefront-available |
| `POST /console/transfers/{transferId}/receive` | `TRANSFER_IN` with damage capture | `inventory.transfer` | |
| `GET /console/cycle-counts` | Count batches | `inventory.view` | |
| `POST /console/cycle-counts` | Open a count with a freeze snapshot | `inventory.adjust` | |
| `POST /console/cycle-counts/{countId}/items` | Post counted quantities per bin/variant | `inventory.adjust` | Offline scans queue client-side; posting waits for connectivity |
| `POST /console/cycle-counts/{countId}/post` | Close and post variances | `inventory.adjust` | Nonzero variance requires a reason before posting |

#### 11.6.7 Returns, QC, exchanges — Module 18 (F11)

| Method & path | Purpose | Permission | Notes |
|---|---|---|---|
| `GET /console/returns` | Return queue by status | `returns.view` | |
| `GET /console/returns/{returnId}` | Items, reasons, evidence, customer return history, refund estimate | `returns.view` | History is shown; it never auto-rejects the customer |
| `POST /console/returns/{returnId}/approve` | Approve; schedule reverse pickup; reserve exchange stock | `returns.approve` | **Idem** · exchange stock reserved at approval, not dispatch |
| `POST /console/returns/{returnId}/reject` | Reject with a written, appealable reason | `returns.approve` | Reason always recorded |
| `POST /console/returns/{returnId}/pickup` | Create or retry the reverse pickup | `returns.approve` | 3 attempts, then auto-close |
| `POST /console/returns/{returnId}/receive` | Record warehouse receipt | `returns.qc` | Receipt alone never restocks |
| `POST /console/returns/{returnId}/items/{itemId}/qc` | `PASS` / `PARTIAL` / `FAIL` with evidence and disposition | `returns.qc` | §14.4; only accepted restockable quantity writes `RETURN_IN` |
| `POST /console/returns/{returnId}/close` | Close the return | `returns.approve` | Blocked while a linked refund is nonterminal |
| `GET /console/exchanges` | Exchange queue | `returns.view` | |
| `POST /console/exchanges/{exchangeId}/dispatch` | Release the replacement after QC pass | `returns.approve` | Replacement is an `orders.type = EXCHANGE` order with its own AWB |

#### 11.6.8 Payments, refunds, reconciliation — Module 9 (F5.3, F12)

| Method & path | Purpose | Permission | Notes |
|---|---|---|---|
| `GET /console/payments/overview` | Captured, pending verification, failed, mismatches, refunds pending, unreconciled, COD awaiting remittance, provider health | `payments.view` | Rollup-backed; no destructive action on a KPI card |
| `GET /console/payments` | Server-paginated transactions | `payments.view` | Masked customer and provider references |
| `GET /console/payments/{paymentId}` | Frozen amount, order link, verification state, immutable attempt/webhook timeline, refunds, settlement matches | `payments.view` | Browser redirects are labelled **provisional**, never capture truth |
| `GET /console/payments/{paymentId}/attempts` | Append-only provider call ledger | `payments.view` | Redacted request/response payloads |
| `POST /console/payments/{paymentId}/requery` | Re-fetch authoritative provider status | `payments.reconcile` | Audited; never writes an amount by hand |
| `POST /console/payments/{paymentId}/cases` | Open a reconciliation case for this payment | `payments.mismatches.manage` | At most one `OPEN` case per `(payment, case_type)` |
| `GET /console/refunds` | Refund queue by status | `payments.view` | |
| `GET /console/refunds/{refundId}` | Item/discount/fee/tax arithmetic, destination, attempts | `payments.view` | Destination masked unless permitted |
| `POST /console/refunds` | **Request** a refund | `refunds.request` | **Idem** · `SUPPORT` may reach exactly this endpoint and no further |
| `POST /console/refunds/{refundId}/approve` | Approve and queue execution | `refunds.approve` | **Idem** · §14.5; reason + permission + before/after audited |
| `POST /console/refunds/{refundId}/reject` | Reject with a reason | `refunds.approve` | |
| `POST /console/refunds/{refundId}/retry` | Retry a failed gateway refund | `refunds.approve` | 3 failures auto-create a pre-populated support ticket |
| `GET /console/mismatches` | `payment_reconciliation_cases` workqueue | `payments.view` | Assignee, severity, SLA clock, decision, resolution actor |
| `GET /console/mismatches/{caseId}` | Internal vs provider fact comparison | `payments.view` | The case links to the authoritative fact; it never stores a replacement amount |
| `POST /console/mismatches/{caseId}/assign` | Assign an owner | `payments.mismatches.manage` | |
| `POST /console/mismatches/{caseId}/resolve` | Resolve or write off, with a mandatory reason | `payments.mismatches.manage` | Requires the permission **and** an `audit_logs` row |
| `GET /console/settlements` | Gateway settlements and COD remittance batches | `payments.view` | Gross, fees, tax, refunds, net, match progress, variance |
| `POST /console/settlements/imports` | Upload/import a settlement or remittance file | `payments.reconcile` | **Idem** · row-level validation errors reported, never silently dropped |
| `GET /console/settlements/{settlementId}` | Header, source file, totals, variance, reconciliation history | `payments.view` | |
| `GET /console/settlements/{settlementId}/lines` | Matched, unmatched, and duplicate lines | `payments.view` | |
| `POST /console/settlements/{settlementId}/auto-match` | Run automatic matching | `payments.reconcile` | |
| `POST /console/settlements/lines/{lineId}/match` | Manually link a line, with a reason | `payments.reconcile` | Retains both internal and external references |
| `POST /console/settlements/lines/{lineId}/unmatch` | Compensating unmatch, with a reason | `payments.reconcile` | Never an in-place edit |
| `GET /console/reconciliation/summary` | Unreconciled value by provider, age, and type | `payments.view` | |
| `POST /console/payments/exports` | Queue a finance export | `payments.exports.create` | **Idem** · audited; async |

#### 11.6.9 Customers — Module 1

| Method & path | Purpose | Permission | Notes |
|---|---|---|---|
| `GET /console/customers` | Customer list, masked by default | `customers.view_masked` | |
| `GET /console/customers/{customerId}` | Profile, addresses, order/return/refund summary, risk flags | `customers.view_masked` | Fields absent — not `null` — without permission |
| `POST /console/customers/{customerId}/reveal` | Unmask PII for a stated reason | `customers.view_pii` | Writes `audit_logs` with the reason and request ID |
| `GET /console/customers/{customerId}/orders` | Order history in scope | `orders.view` | |
| `GET /console/customers/{customerId}/activity` | Customer-visible activity trail | `customers.view_masked` | |
| `POST /console/customers/{customerId}/block` | Block an account | `staff.manage` | Audited |
| `POST /console/customers/{customerId}/unblock` | Unblock | `staff.manage` | Audited |
| `GET /console/customers/{customerId}/store-credit` | Balance and ledger | `payments.view` | |
| `POST /console/customers/{customerId}/store-credit` | Issue or expire credit with a reason | `refunds.approve` | **Idem** · balance moves only beside an append-only ledger row |

#### 11.6.10 Reviews and support — Modules 11, 14

| Method & path | Purpose | Permission | Notes |
|---|---|---|---|
| `GET /console/reviews` | Moderation queue with screening flags | `reviews.view` | |
| `GET /console/reviews/{reviewId}` | Review, media, order context | `reviews.view` | |
| `POST /console/reviews/{reviewId}/approve` | Approve and recompute the rating summary | `reviews.moderate` | Invalidates the rating cache; the PDP never runs a live aggregate |
| `POST /console/reviews/{reviewId}/reject` | Reject with a **policy** reason | `reviews.moderate` | Negative sentiment alone is not a valid reason |
| `POST /console/reviews/{reviewId}/reply` | Publish a brand reply | `reviews.moderate` | Attributed to the brand, never an individual |
| `GET /console/tickets` | Queues: mine, unassigned, SLA risk, waiting on customer | `support.tickets.view` | |
| `GET /console/tickets/{ticketId}` | Thread plus full order/payment/shipment/return context | `support.tickets.view` | Masked per role |
| `POST /console/tickets` | Create a ticket on the customer's behalf | `support.tickets.manage` | |
| `POST /console/tickets/{ticketId}/assign` | Assign or reassign | `support.tickets.manage` | |
| `POST /console/tickets/{ticketId}/status` | Change status; pause/resume the SLA clock | `support.tickets.manage` | SLA pauses only in `WAITING_ON_CUSTOMER`; `409 ICE-SUP-409` if a linked return/refund is in flight |
| `POST /console/tickets/{ticketId}/messages` | Public reply or internal note | `support.tickets.manage` | Visibility is explicit |
| `POST /console/tickets/{ticketId}/escalate` | Escalate to the manager queue | `support.escalate` | Breaches auto-escalate too |
| `GET /console/faqs` | FAQ management list | `support.tickets.view` | |
| `POST /console/faqs` | Create an FAQ | `support.tickets.manage` | |
| `PATCH /console/faqs/{faqId}` | Edit, publish, reorder | `support.tickets.manage` | |
| `DELETE /console/faqs/{faqId}` | Retire an FAQ | `support.tickets.manage` | |

#### 11.6.11 Marketing — Modules 10, 12, 14 (F4, F14)

| Method & path | Purpose | Permission | Notes |
|---|---|---|---|
| `GET /console/coupons` | Coupon list with performance | `marketing.view` | |
| `POST /console/coupons` | Create a coupon and its condition rows | `coupons.manage` | Percentage `0..100`; caps and windows validated |
| `GET /console/coupons/{couponId}` | Definition, conditions, usage | `marketing.view` | |
| `PATCH /console/coupons/{couponId}` | Edit rules or window | `coupons.manage` | Reserved/consumed redemptions are never rewritten |
| `POST /console/coupons/{couponId}/status` | Activate, pause, or expire | `coupons.manage` | |
| `GET /console/coupons/{couponId}/redemptions` | Reserved / consumed / released ledger | `marketing.view` | One vocabulary across all documents |
| `GET /console/campaigns` | Campaigns and results | `marketing.view` | |
| `POST /console/campaigns` | Create a campaign | `campaigns.manage` | |
| `PATCH /console/campaigns/{campaignId}` | Edit or schedule | `campaigns.manage` | Sending still passes consent, suppression, quiet hours, and the frequency cap |
| `GET /console/abandoned-carts` | Recovery sequences and attribution | `marketing.view` | F14; recovery revenue is reported separately |
| `POST /console/abandoned-carts/{abandonedCartId}/touch` | Trigger or re-trigger a touch | `campaigns.manage` | Sequence stops the moment the cart converts |
| `GET /console/segments` | Customer segments | `marketing.view` | Never an authorization source |
| `POST /console/segments` | Create or re-evaluate a segment | `campaigns.manage` | |
| `GET /console/recommendations/config` | Algorithm weights and slot configuration | `marketing.view` | |
| `PUT /console/recommendations/config` | Update configuration | `recommendations.manage` | |
| `POST /console/recommendations/rebuild` | Queue a recommendation rebuild | `recommendations.manage` | Async, batch-versioned |

#### 11.6.12 Notifications — Module 13 (F17)

| Method & path | Purpose | Permission | Notes |
|---|---|---|---|
| `GET /console/notification-templates` | Template versions by event, channel, locale | `notifications.view` | |
| `POST /console/notification-templates` | Create a new **version** | `notifications.manage` | Used templates are immutable — publishing creates a version |
| `POST /console/notification-templates/{templateId}/publish` | Publish a version into an effective window | `notifications.manage` | |
| `GET /console/notifications` | Dispatch log with status and channel | `notifications.view` | |
| `GET /console/notifications/{notificationId}/logs` | Append-only delivery events and provider IDs | `notifications.view` | Send, delivered, bounced, complained are separate events |
| `POST /console/notifications/{notificationId}/resend` | Resend a transactional message | `notifications.manage` | Marketing resends are blocked by the frequency cap |
| `GET /console/suppressions` | Suppressed endpoints with reason and source | `notifications.view` | Bounce/complaint feedback protects sender reputation |
| `DELETE /console/suppressions/{suppressionId}` | Lift a suppression with a reason | `notifications.manage` | Audited |

#### 11.6.13 CMS authoring — Module 19b (F22)

| Method & path | Purpose | Permission | Notes |
|---|---|---|---|
| `GET /console/cms/pages` | Routes with status and current version | `cms.view` | |
| `POST /console/cms/pages` | Create a route | `cms.edit` | Slug unique per store/locale |
| `GET /console/cms/pages/{pageId}` | Page with version list | `cms.view` | |
| `PATCH /console/cms/pages/{pageId}` | Update SEO, schedule, locale, status | `cms.edit` | Renaming or removing a published route **requires** a redirect |
| `POST /console/cms/pages/{pageId}/versions` | Create a draft version (optionally copied from an old one) | `cms.edit` | Revert = a new version copied from the selected version |
| `PUT /console/cms/versions/{versionId}/blocks` | Set the ordered block list with validated configuration | `cms.edit` | Hero/banner requires desktop + mobile creative and alt text |
| `POST /console/cms/versions/{versionId}/preview` | Mint a signed, non-crawlable preview token | `cms.view` | Max 24 h; draft content never leaks to crawlers |
| `POST /console/cms/versions/{versionId}/schedule` | Schedule activation/expiry | `cms.publish` | Activates in the store timezone by cron |
| `POST /console/cms/versions/{versionId}/publish` | Publish now | `cms.publish` | Validates product/collection/destination targets; invalidates cache; regenerates sitemap |
| `GET /console/cms/navigation` | Menu tree | `cms.view` | |
| `PUT /console/cms/navigation` | Replace the menu tree | `cms.edit` | Cycles rejected; internal targets validated |
| `GET /console/cms/redirects` | Redirect table with hit counts | `cms.view` | |
| `POST /console/cms/redirects` | Create a redirect (301/302/307/308) | `cms.edit` | Loops rejected |
| `DELETE /console/cms/redirects/{redirectId}` | Remove a redirect | `cms.publish` | Blocked if it would orphan a published route |

#### 11.6.14 Analytics and reports — Module 16

| Method & path | Purpose | Permission | Notes |
|---|---|---|---|
| `GET /console/analytics/{report}` | One report family per key | `reports.operational.view` | `report ∈ {overview, sales, products, customers, inventory, returns, search, shipping, support}`; financial datasets additionally require `reports.financial.view` |
| `POST /console/analytics/exports` | Queue a report export | `reports.operational.view` | **Idem** · financial exports require `reports.financial.view`; audited |
| `GET /console/analytics/exports/{exportId}` | Export status and signed download URL | `reports.operational.view` | Expiring URL |

Every report reads `dashboard_rollups` or an approved view — never a live scan of orders, payments, or analytics events. Net revenue is the default metric; gross is an explicit parameter.

#### 11.6.15 Access, settings, and system — Module 20

| Method & path | Purpose | Permission | Notes |
|---|---|---|---|
| `GET /console/staff` | Staff list with roles and scopes | `staff.manage` | `ADMIN` only |
| `POST /console/staff` | Invite/create a staff user | `staff.manage` | MFA required before production `ADMIN` activation |
| `PATCH /console/staff/{staffId}` | Update profile, status, warehouse scope | `staff.manage` | |
| `PUT /console/staff/{staffId}/roles` | Assign roles and scopes | `roles.manage` | `409 ICE-RBAC-409` — nobody may grant a permission they do not hold |
| `GET /console/roles` | Roles and their permission bundles | `roles.manage` | System roles cannot be deleted |
| `POST /console/roles` | Create a role | `roles.manage` | |
| `PUT /console/roles/{roleId}/permissions` | Set a role's permissions | `roles.manage` | Same grant restriction applies |
| `GET /console/permissions` | Permission catalogue with sensitivity | `roles.manage` | Seeded, global |
| `GET /console/audit-logs` | Immutable audit trail with filters | `audit.view` | Read/export only |
| `POST /console/audit-logs/exports` | Queue an audit export | `audit.view` | **Idem** · audited in turn |
| `GET /console/settings` | Versioned non-secret settings by namespace | `settings.manage` | Gateway credentials are structurally excluded |
| `PUT /console/settings/{namespace}` | Update a settings namespace | `settings.manage` | Step-up re-auth required; every change is an audited policy change |
| `GET /console/tax/classes` | Tax classes and HSN codes | `settings.manage` | |
| `PUT /console/tax/classes/{taxClassId}` | Update a tax class | `settings.manage` | |
| `GET /console/tax/rates` | Effective GST rules | `settings.manage` | No overlapping rule with identical dimensions |
| `PUT /console/tax/rates/{taxRateId}` | Update a rate window | `settings.manage` | Production rates require Finance approval |
| `GET /console/api-clients` | Partner/automation clients | `settings.manage` | Key hashes only |
| `POST /console/api-clients` | Issue a scoped API key (shown once) | `settings.manage` | Scoped keys never inherit staff permissions |
| `POST /console/api-clients/{clientId}/revoke` | Revoke a key | `settings.manage` | Immediate |
| `GET /console/integrations` | Adapter status and health (no secrets) | `settings.manage` | |
| `PATCH /console/integrations/{provider}` | Enable, disable, or reprioritize an adapter | `settings.manage` | Feature-flagged rollout |
| `GET /console/system/queues` | Queue depth, dead letters, worker health | `settings.manage` | Alert-backed |
| `POST /console/system/jobs/{jobId}/retry` | Retry or requeue a dead-lettered job | `settings.manage` | Idempotent handler required |
| `GET /console/system/webhooks` | Raw inbound webhook inbox with signature status | `settings.manage` | Payloads immutable |
| `POST /console/system/webhooks/{inboxId}/replay` | Replay a stored webhook | `settings.manage` | Consumers are idempotent; replay is always safe |
| `GET /console/system/outbox` | Outbox lag and unpublished events | `settings.manage` | Freshness watermark for every projection |

### 11.7 Webhooks — inbound, HMAC verified

| Method & path | Purpose | Auth | Notes |
|---|---|---|---|
| `POST /webhooks/payment/{provider}` | Gateway callbacks — authorized, captured, failed, refunded, dispute | H | F5.3; `provider ∈ {razorpay, stripe, paypal}`. Raw payload stored **before** parsing; idempotent on `event_id`; converges with `/checkout/payment/verify`, first writer wins |
| `POST /webhooks/courier/{provider}` | Scan events, delivery, NDR, RTO | H | F8.1; `provider ∈ {shiprocket, delhivery, bluedart, indiapost}`. Idempotent on `(provider, awb, event_code, event_time)` |
| `POST /webhooks/messaging/{provider}` | Delivery, bounce, complaint, unsubscribe | H | `provider ∈ {email, sms, whatsapp, push}`. Feeds endpoint suppression |
| `POST /webhooks/settlement/{provider}` | Settlement/remittance file availability notice | H | Queues the import; never trusted as the amount source |

**Webhook contract, identical for all four:** verify HMAC and the timestamp window → persist the raw body to `webhook_inbox` → return `200` immediately → process asynchronously and idempotently. A signature failure returns `401 ICE-WEBHOOK-401` and is alerted; a duplicate returns `200` and is recorded as a no-op. **The transport never decides business state — the service does.**

### 11.8 Partner API — scoped API key

| Method & path | Purpose | Auth | Scope |
|---|---|---|---|
| `GET /partner/products` | Published catalog projection | K | `catalog:read` |
| `GET /partner/inventory` | Availability by SKU | K | `inventory:read` |
| `GET /partner/orders` | Orders since a cursor | K | `orders:read` |
| `GET /partner/orders/{orderId}` | Single order projection | K | `orders:read` |
| `POST /partner/orders/{orderId}/fulfilment` | Push an external fulfilment/tracking update | K | `orders:write` · **Idem** |
| `GET /partner/shipments` | Shipment status feed | K | `shipping:read` |
| `GET /partner/webhooks/subscriptions` | Current outbound subscriptions | K | `webhooks:manage` |
| `POST /partner/webhooks/subscriptions` | Subscribe to `order.created`, `order.shipped`, `stock.low`, `return.created` | K | `webhooks:manage` |
| `DELETE /partner/webhooks/subscriptions/{subscriptionId}` | Unsubscribe | K | `webhooks:manage` |

Outbound partner webhooks are signed with the client's secret, retried with exponential backoff, and dead-lettered with an ops alert. Partner keys are IP allow-listed, rate-limited per client profile, and **never** inherit staff permissions.

### 11.9 Non-API routes served by the backend/CDN

Not part of `/api/v1`, and explicitly **never** served by a Next.js route handler:

| Path | Purpose |
|---|---|
| `GET /sitemap.xml` | Sitemap index |
| `GET /sitemap-products.xml` · `GET /sitemap-destinations.xml` · `GET /sitemap-collections.xml` · `GET /sitemap-content.xml` | Split sitemaps, regenerated on publish (F20, F22) |
| `GET /robots.txt` | Crawl directives, environment-aware |
| `GET /.well-known/**` | Domain verification, Apple app-site association |

The redirect table (`redirects`) is published to the CDN by a scheduled sync job and served as real `301/302/307/308` responses at the edge. `GET /api/v1/redirects?since=` exposes the delta for that job.

### 11.10 Endpoint count summary

| Surface | § | Endpoints |
|---|---|---:|
| System and platform | 11.1 | 4 |
| Customer authentication | 11.2 | 14 |
| Staff authentication | 11.3 | 8 |
| Public catalog, discovery, content | 11.4 | 27 |
| **Customer-facing subtotal** | | **53** |
| Customer session — account and profile | 11.5.1 | 21 |
| Customer session — wishlist | 11.5.2 | 7 |
| Customer session — cart and coupon | 11.5.3 | 9 |
| Customer session — checkout and payment | 11.5.4 | 14 |
| Customer session — orders, tracking, cancellation | 11.5.5 | 9 |
| Customer session — returns, exchanges, refunds | 11.5.6 | 13 |
| Customer session — reviews, notifications, support | 11.5.7 | 20 |
| **Customer session subtotal** | 11.5 | **93** |
| Console — dashboard and search | 11.6.1 | 4 |
| Console — orders | 11.6.2 | 11 |
| Console — fulfilment and warehouse | 11.6.3 | 11 |
| Console — shipping, tracking, NDR | 11.6.4 | 20 |
| Console — catalog | 11.6.5 | 32 |
| Console — inventory and warehouses | 11.6.6 | 19 |
| Console — returns, QC, exchanges | 11.6.7 | 10 |
| Console — payments, refunds, reconciliation | 11.6.8 | 25 |
| Console — customers | 11.6.9 | 9 |
| Console — reviews and support | 11.6.10 | 16 |
| Console — marketing | 11.6.11 | 16 |
| Console — notifications | 11.6.12 | 8 |
| Console — CMS authoring | 11.6.13 | 14 |
| Console — analytics and reports | 11.6.14 | 3 |
| Console — access, settings, system | 11.6.15 | 26 |
| **Console subtotal** | 11.6 | **224** |
| Webhooks | 11.7 | 4 |
| Partner | 11.8 | 9 |
| **Total (`/api/v1`)** | | **383** |
| Non-API backend/CDN route families | 11.9 | 4 |

> **Reconciling with the blueprint's 180–260 estimate.** That range was written in Phase 3, before `frontend.md` §4.2 decomposed the console to page level and before `payment_reconciliation_cases` added the mismatch workqueue. The catalogue above is the *complete* enumeration needed to serve that page inventory with deny-by-default permissions, and the shape of the overrun is entirely one-sided: **the customer-facing surface is 146 endpoints** (53 public/auth + 93 session), comfortably inside the original range, while **224 of the 383 are console endpoints backing the 60+ admin pages the blueprint itself specifies**. The count is already consolidated wherever one controller with a typed discriminator serves a family — `GET /console/analytics/{report}` covers nine reports, `POST /console/orders/{orderId}/status` covers the whole F6.2 machine, `GET /console/catalog/vocabularies/{axis}` covers four vocabularies — rather than inflated into one route per variation. **This enumeration supersedes the estimate**; `product-blueprint.md` §API Standards and §Expected Documentation Size are updated to point here, and any future endpoint is added to this catalogue with its surface, permission, scope, idempotency posture, and tests before implementation.

---

## 12. Normative endpoint contracts — worked examples

Every endpoint is documented in `docs/05-api/` with: URL · method · authentication · permissions · validation rules · request example · response example · database changes · business rules · error catalogue · rate limits. Five worked examples fix the pattern.

### 12.1 `POST /api/v1/cart/items` — add to bag

| Field | Contract |
|---|---|
| **Auth** | Verified `CUSTOMER` JWT + CSRF. Guest → `401 ICE-CART-401`. Staff principal → `403 ICE-RBAC-403` |
| **Permission** | None beyond the customer audience; ownership resolved from `carts.user_id` only |
| **Rate limit** | `cart` — 60/min per customer |
| **Idempotency** | Not required; the upsert is naturally idempotent per `(cart, variant)` |
| **Request** | `{ "variant_id": "01927f…", "qty": 1 }` — **never** a price |
| **Validation** | `variant_id` UUIDv7 and existing; `qty` integer `1..10` |
| **Business rules** | Order of checks: customer authorized → variant exists → product published → stock available → per-variant cap (`cart.max_quantity_per_variant = 10`, lowered by `product_variants.max_per_order` but never raised) → line upsert (merge quantity) → **re-price the entire cart** |
| **DB writes** | `carts` (create if absent, one `ACTIVE` per customer), `cart_items` upsert, `cart_coupons` revalidation |
| **Response `200`** | The **complete** cart: lines with current and at-add prices, availability flags, coupon state, shipping estimate, tax, grand total |
| **Errors** | `401 ICE-CART-401` · `403 ICE-RBAC-403` · `404 ICE-CAT-404` unpublished · `409 ICE-INV-409` insufficient stock, with the exact variant named and alternatives · `422 ICE-CART-422` cap exceeded |

### 12.2 `POST /api/v1/checkout/orders` — place order (F5.2)

| Field | Contract |
|---|---|
| **Auth** | Verified `CUSTOMER` + CSRF. Missing/unverified identity returns `401`/`403` **before any row is written** |
| **Headers** | `Idempotency-Key: <uuid>` **required** |
| **Request** | `{ "checkout_session_id": "…", "accepts_terms": true }` — no items, no amounts; the server re-reads everything |
| **Business rules** | §14.1 in full. Re-price from scratch, re-validate the coupon (third time), lock inventory rows in ascending ID order, reserve for 15 min (COD 10), freeze every snapshot |
| **DB writes** | `orders`, `order_items`, `inventory_reservations`, `inventory_movements` (`SALE_RESERVE`), `inventory`, `coupon_redemptions` (`RESERVED`), `order_status_history` (`PENDING_PAYMENT`), `domain_events_outbox`, `idempotency_keys` |
| **Response `201`** | `{ "order_id", "order_number", "payable": { "amount": "3548.00", "currency": "INR" }, "reservation_expires_at" }` |
| **Errors** | `409 ICE-INV-409` per-variant shortage with alternatives · `409 ICE-CHK-409` stale session · `410 ICE-CHK-410` expired session · `409 ICE-CPN-409` coupon capacity · `409 ICE-IDMP-409` key reused with a different payload |
| **Replay** | Same key + same payload → the original `201` body, byte-identical. **One order, one charge.** |

### 12.3 `POST /api/v1/webhooks/payment/razorpay` — payment truth (F5.3)

| Field | Contract |
|---|---|
| **Auth** | HMAC signature over the raw body + timestamp window; replay outside the window rejected |
| **Order of operations** | 1. Verify signature → 2. Persist the **raw** payload to `webhook_inbox` → 3. Return `200` → 4. Process asynchronously |
| **Processing** | Retrieve authoritative provider state server-to-server → open a transaction → lock payment, order, reservations, inventory → if already captured, return the original result → **compare amount and currency exactly** → on mismatch: append the attempt, open a `payment_reconciliation_cases` row, set `payments.status = 'MISMATCH'`, stop → otherwise capture, convert reservations with `SALE_CONFIRM`, append `PLACED` then `PAYMENT_CONFIRMED`, consume the coupon, allocate the invoice number under a row lock, create the invoice, convert the cart |
| **Response** | `200` always on a valid signature, including for duplicates (`ICE-WEBHOOK-409` recorded as a no-op) |
| **Convergence** | `POST /checkout/payment/verify` runs the identical service. Whichever arrives first wins; the second is a no-op. The customer is never punished for a flaky network |

### 12.4 `POST /api/v1/console/refunds/{refundId}/approve` — money out (F12)

| Field | Contract |
|---|---|
| **Auth** | Staff JWT (console audience) + CSRF |
| **Permission** | `refunds.approve`. `SUPPORT` holds `refunds.request` only and receives `403 ICE-REF-403` here — the separation is structural, not a UI convention |
| **Idempotency** | `Idempotency-Key` required |
| **Request** | `{ "reason": "QC passed — size ran small", "amount_confirmation": "1749.00" }` — the amount is a **display assertion**, compared to the server's computed value and rejected on mismatch; it is never used as the write input |
| **Business rules** | Amount ≤ remaining refundable balance; the refund row and its outbox event commit **before** any gateway call; the external call happens after commit, keyed on the refund public ID |
| **DB writes** | `refunds`, `refund_items`, `order_status_history`/`return_status_history`, `credit_notes` + `credit_note_items` where applicable, `coupon_redemptions` release, `audit_logs`, `domain_events_outbox` |
| **Errors** | `403 ICE-REF-403` · `409 ICE-REF-409` exceeds balance · `409` stale state · `503 ICE-REF-503` provider degraded (queued, not failed) |
| **After 3 provider failures** | A pre-populated support ticket is auto-created with the full payment reference chain (F18) |

### 12.5 `GET /api/v1/products/{slug}` — the PDP read

| Field | Contract |
|---|---|
| **Auth** | Public. A customer token, when present, adds wishlist state only |
| **Cache** | `public, max-age=60, stale-while-revalidate=300` + strong `ETag`; Redis-cached, invalidated on publish, price change, media change, and review approval |
| **Response** | Product, colourway-grouped media, variant matrix, effective price with compare-at, rating summary from `product_rating_summaries`, size-chart version, return policy, SEO/OG fields, and JSON-LD source values for `Product`, `Offer`, `AggregateRating`, `BreadcrumbList` |
| **Explicitly excluded** | Live stock. Availability is a **separate**, short-TTL endpoint, and add-to-bag rechecks stock inside the mutation regardless. A stale catalog cache can therefore never sell a dead SKU |
| **Errors** | `404 ICE-CAT-404` for draft/archived, with the redirect target in `errors[].detail` when `redirects` holds one |
| **Budget** | p95 ≤ 150 ms cached, ≤ 300 ms cold |

---

## 13. Service layer catalogue and table ownership

One engine per concern. Every rule below lives in exactly one service; controllers, jobs, and reports all call it.

| Service | Owns | Primary tables |
|---|---|---|
| `Auth\SessionService` | Tokens, rotation, reuse detection, family revocation, audiences | `user_sessions`, `auth_challenges`, `login_attempts` |
| `Auth\IdentityService` | Registration, OTP, social linking, password, deletion lifecycle | `users`, `user_identities`, `user_consents` |
| `Rbac\PermissionService` | Permission resolution, scope evaluation, grant restrictions | `roles`, `permissions`, `role_permissions`, `user_roles` |
| `Catalog\ProductService` | Draft/publish/archive, the publish gate, slug and redirect discipline | `products`, `product_variants`, `product_categories`, `collections`, `size_charts` |
| `Catalog\PriceService` | Effective price resolution, scheduled windows, history | `product_prices`, `product_price_history` |
| `Media\MediaService` | Signed uploads, validation, EXIF strip, derivatives, ownership links | `media_assets`, `media_links` |
| `Inventory\StockService` | **The only writer of stock.** Reserve, confirm, expire, restock, adjust, transfer | `inventory`, `inventory_movements`, `inventory_reservations`, `inventory_transfers*` |
| `Warehouse\TaskService` | Waves, pick/pack/dispatch/QC tasks, scan validation, counts | `pick_waves`, `warehouse_tasks`, `warehouse_task_items`, `cycle_counts*`, `warehouse_bins` |
| `Pricing\PricingEngine` | Line totals, item discounts, subtotal, rounding policy | reads catalog + cart |
| `Coupons\CouponEngine` | The eight-gate ladder, discount computation and caps, reserve → consume → release | `coupons`, `coupon_conditions`, `coupon_redemptions` |
| `Tax\TaxEngine` | GST split by place of supply, HSN, inclusive/exclusive, rounding boundary | `tax_classes`, `tax_rates` |
| `Shipping\RateEngine` | Serviceability, zone × weight × value rates, EDD, COD eligibility and fee | `shipping_zones*`, `shipping_rates`, `shipping_providers` |
| `Cart\CartService` | Cart resolution by `user_id`, mutations, integrity revalidation on every read | `carts`, `cart_items`, `cart_coupons` |
| `Checkout\CheckoutService` | Five-step session state, step validation, resume | `checkout_sessions` |
| `Orders\OrderService` | Order creation, the F6.2 state machine, cancellation, snapshots | `orders`, `order_items`, `order_status_history` |
| `Orders\DocumentService` | Invoice/credit-note number allocation under lock, PDF generation | `invoice_sequences`, `invoices`, `invoice_items`, `credit_notes`, `credit_note_items` |
| `Payments\PaymentService` | Initiate, verify, capture, mismatch detection, COD confirmation | `payments`, `payment_attempts`, `payment_reconciliation_cases` |
| `Refunds\RefundService` | Refund arithmetic, approval, execution, retry, store credit | `refunds`, `refund_items`, `store_credit_accounts`, `store_credit_transactions` |
| `Settlements\ReconciliationService` | Settlement import, matching, variance, case resolution | `settlements`, `settlement_lines` |
| `Shipping\ShipmentService` | AWB, labels, manifests, event normalization, silence detection, NDR/RTO | `shipments`, `shipment_items`, `shipment_events`, `shipping_manifests`, `ndr_cases`, `ndr_attempts` |
| `Returns\ReturnService` | Eligibility, approval, reverse logistics, QC, restock decisions | `return_requests`, `return_items`, `return_status_history`, `return_qc` |
| `Exchanges\ExchangeService` | Replacement reservation at approval, price difference, dispatch gating | `exchanges` |
| `Reviews\ReviewService` | Eligibility, screening, moderation, rating summary recomputation | `reviews`, `review_moderation_history`, `product_rating_summaries` |
| `Notifications\DispatcherService` | Consent, quiet hours, frequency cap, channel selection, template render, retry | `notification_templates`, `notification_preferences`, `notifications`, `notification_logs` |
| `Support\TicketService` | Ticket lifecycle, SLA clock and pauses, escalation, closure blocking | `support_tickets`, `ticket_messages`, `ticket_status_history`, `faqs` |
| `Cms\ContentService` | Versions, blocks, preview tokens, scheduling, publish, revert, redirects | `cms_pages`, `cms_page_versions`, `cms_blocks`, `navigation_items`, `redirects`, `preview_tokens` |
| `Search\IndexService` | Document projection, incremental and full reindex from the outbox | search index + `search_synonyms`, `search_queries` |
| `Recommendations\RecoService` | Batch rebuild, context resolution, expiry | `recommendation_items` |
| `Analytics\RollupService` | Five-minute/hour/day rollups, watermarks, report queries | `analytics_events`, `dashboard_rollups` |
| `Platform\IdempotencyService` | Claim, replay, conflict | `idempotency_keys` |
| `Platform\OutboxService` | Transactional event write and claim | `domain_events_outbox` |
| `Platform\AuditService` | Actor, permission, reason, before/after, request ID | `audit_logs`, `activity_logs` |
| `Platform\WebhookInboxService` | Raw capture, dedupe, replay | `webhook_inbox` |

**Cross-cutting invariant.** `Inventory\StockService` is the *only* code path that changes stock, and it always writes the matching `inventory_movements` row in the same transaction. There is no direct `UPDATE inventory` anywhere in the codebase, and a CI grep enforces it.

---

## 14. Transaction recipes

These mirror `database.md` §7 exactly. Where the two documents describe the same write, the database document is the persistence contract and this one is the service contract; they are released together.

### 14.1 Place order and reserve stock

Inside **one** transaction:

1. Require a verified `CUSTOMER`; claim or replay `idempotency_keys` on `(user scope, endpoint, key_hash)` and verify the request hash. Missing or unverified identity returns `401`/`403` **before** any order, payment, coupon redemption, or reservation row exists.
2. Lock the customer-owned active cart and checkout session; re-read every catalog, price, coupon, tax, shipping, and stock fact. Lock the coupon row when enforcing global/per-user capacity.
3. Lock all required `inventory` rows **in ascending `inventory.id` order** — the deterministic order that limits deadlocks.
4. If any exact variant is short, roll back with a variant-specific `ICE-INV-409`.
5. Create `orders` and immutable `order_items` with frozen contact, delivery, billing, shipping, pricing, coupon, policy, and GST snapshots.
6. Create `inventory_reservations`, append `SALE_RESERVE` movements, update each inventory snapshot.
7. Create the `coupon_redemptions` reservation if applicable.
8. Append the initial `PENDING_PAYMENT` history row.
9. Write `order.created` to `domain_events_outbox` and store the replayable response in `idempotency_keys`.
10. **Commit.** Gateway initiation happens strictly afterwards.

Reservations expire after 15 minutes (prepaid) or 10 minutes (COD). The expiry worker locks the reservation and inventory row, appends `RESERVE_EXPIRE`, releases the quantity, expires the unpaid order, appends history, and emits the recovery event exactly once.

### 14.2 Confirm prepaid payment

The browser verification path and the signed webhook call the **same service**:

1. Persist/claim the raw webhook or verification idempotency record before parsing.
2. Verify the signature, then retrieve authoritative provider state server-to-server when required.
3. Begin a transaction; lock payment, order, reservations, and inventory rows.
4. If already captured and confirmed, return the original result.
5. Compare provider amount and currency **exactly**. A mismatch appends the attempt, opens a `payment_reconciliation_cases` row, sets `payments.status = 'MISMATCH'`, and stops — the order does not advance.
6. Mark the payment captured; append its `payment_attempts` fact.
7. Convert each reservation with `SALE_CONFIRM`, reducing `on_hand` and `reserved` together.
8. Append `PLACED` then `PAYMENT_CONFIRMED`; consume the coupon redemption; allocate the invoice number under a row lock; create the invoice and lines; convert/clear the cart.
9. Add confirmation, invoice, ops-alert, analytics, and integration events to the outbox.
10. **Commit.** Whichever confirmation path arrives second becomes a no-op.

COD follows the same stock and order transaction but deducts immediately after the required OTP/risk checks. Its payment stays `PENDING` until the delivery event records cash collection; settlement lines reconcile the later courier remittance.

### 14.3 Cancel an order or line

Lock the order and the selected items, recheck state and `version`, compute the previewed revision, then: append `CANCELLED` history or line cancellation quantities · release the reservation or write the compensating movement · release eligible coupon usage and void a pre-handover AWB · create a queued refund and credit note when money was captured · append outbox events and audit the actor, permission, reason, and before/after state. External refund and courier-void calls execute **after** commit. A `PACKED` order requiring manager approval does not mutate until the approval is recorded.

### 14.4 Return QC

Lock the return item, return request, warehouse task, and target inventory row. Save the immutable QC result and evidence link. Accepted restockable quantity appends `RETURN_IN` and updates inventory; failed disposition appends `RETURN_SCRAP` without changing available stock. Update return history, create the refund/store-credit/replacement release work, append outbox events, commit. **Stock is restocked only after QC passes** — an item in reverse transit is never counted as available.

### 14.5 Refund execution

Creation and approval commit first. A worker then calls the gateway using the internal refund public ID as the idempotency key and appends every call to `payment_attempts`. A signed webhook or reconciliation poll locks the refund, marks it complete **once**, updates payment refunded totals and status, creates the credit note and settlement association, appends customer-visible history and outbox events, and commits. Three failed provider attempts create a pre-populated support ticket.

### 14.6 Outbox consumption

Workers claim unpublished rows with `FOR UPDATE SKIP LOCKED`, publish with `event_id = domain_events_outbox.public_id`, and mark success. Consumers deduplicate by event ID. Notification dispatch, search reindex, feeds, PDFs, integration webhooks, dashboard refresh, and recommendation rebuilds all ride this one pattern.

### 14.7 Transaction rules that apply everywhere

1. Financial and stock writes always run inside an explicit transaction.
2. **A transaction never spans an external HTTP call.** Provider calls happen after commit, driven by the outbox or a job.
3. Row locks are taken in a documented, deterministic order.
4. Optimistic `version` plus current status are checked under the lock; a stale or illegal action returns `409` and appends no history.
5. Terminal states never transition backward. Corrections are compensating records — never edits.

---

## 15. Jobs, queues, and scheduled work

### 15.1 Queues

| Queue | Consumers | Priority | Typical jobs |
|---|---|---|---|
| `critical` | 4 | Highest | Payment confirmation follow-up, refund execution, reservation expiry |
| `notifications` | 4 | High | Email, SMS, WhatsApp, Web Push dispatch and retries |
| `fulfilment` | 2 | High | AWB generation, label rendering, manifest close, courier polling |
| `documents` | 2 | Normal | Invoice/credit-note PDFs, packing slips, exports |
| `search` | 2 | Normal | Incremental reindex, full rebuild, synonym reload |
| `media` | 2 | Normal | Validation, EXIF strip, AVIF/WebP derivatives |
| `analytics` | 2 | Low | Rollup refresh, feed generation, recommendation rebuild |
| `webhooks_out` | 2 | Normal | Partner webhook delivery with backoff |

Every handler is **idempotent** and keyed on a durable identifier. Retries use exponential backoff (3 attempts default, 5 on money paths), then dead-letter with an ops alert. A dead-lettered money-path job also opens a support ticket where a customer is waiting.

### 15.2 Job catalogue (representative)

`ConfirmPaymentJob` · `ExpireReservationsJob` · `ExecuteRefundJob` · `GenerateInvoicePdfJob` · `GenerateLabelJob` · `CloseManifestJob` · `PollCourierJob` · `PollPendingPaymentsJob` · `ImportSettlementJob` · `DispatchNotificationJob` · `FanOutRestockJob` · `AbandonedCartTouchJob` · `ReindexProductJob` · `RebuildRecommendationsJob` · `RefreshRollupsJob` · `GenerateSitemapJob` · `GenerateFeedJob` · `ProcessMediaJob` · `RunExportJob` · `AnonymizeAccountJob` · `PublishOutboxJob` · `DeliverPartnerWebhookJob`.

### 15.3 Scheduled tasks

`bin/scheduler.php` runs every minute and dispatches due tasks under a per-task Redis lock.

| Task | Cadence | Behaviour |
|---|---|---|
| Reservation expiry sweep | Every minute | Releases expired reservations, expires unpaid orders, emits recovery events |
| CMS schedule activation | Every minute | Activates and expires scheduled pages/blocks in the store timezone |
| Payment reconciliation poller | Every 5 min | Polls the gateway for `PENDING_PAYMENT` orders under 24 h old; auto-confirms on `captured` (F5.5) |
| Dashboard rollup refresh | Every 5 min | Rebuilds `dashboard_rollups` with a source watermark |
| Abandoned-cart sweep | Every 15 min | Opens sequences after 60 min of inactivity; schedules the `[1, 24, 72]`-hour touches |
| Courier silence detector | Hourly | No scan for 6 h → poll the courier; 48 h → auto-create a support ticket and notify the customer proactively |
| Low-stock scan | Hourly | Emits once per threshold crossing; rearms on restock above the threshold |
| Outbox lag check | Every 5 min | Alerts when unpublished events exceed the threshold |
| Settlement import | Daily | Fetches provider settlement and COD remittance files |
| Sitemap and feed regeneration | Daily + on publish | Split sitemaps, Google/Meta feeds |
| Nightly reports | Daily | Operational digests to the owner |
| Account deletion anonymization | Daily | Anonymizes accounts past the 30-day grace with no remaining blocker |
| Retention purge | Daily | Expired challenges, revoked sessions, idempotency keys, archived webhooks |
| Backup verification | Daily | Confirms a **restorable artifact** — a job that succeeded without one is a failure |
| Restore drill | Monthly / quarterly | Automated restore monthly; full timed DR exercise quarterly |

---

## 16. Integration adapters

Every provider sits behind an interface, so a new provider is a new adapter class — **never** a change to checkout, fulfilment, or notification code.

| Interface | Implementations | Contract |
|---|---|---|
| `PaymentGateway` | Razorpay (primary, India), Stripe, PayPal | `createOrder`, `fetchPayment`, `capture`, `refund`, `verifySignature`. Idempotent on our reference; every call appends `payment_attempts` |
| `ShippingProvider` | Shiprocket, Delhivery, Bluedart, India Post, self-ship | `checkServiceability`, `rateShop`, `createShipment`, `label`, `cancel`, `schedulePickup`, `track`, `normalizeEvent` |
| `MessagingChannel` | SMTP/ESP, DLT-registered SMS, WhatsApp Business API, Web Push (VAPID) | `send`, `supports`, `normalizeCallback`. Suppression is honoured before send |
| `ObjectStorage` | S3-compatible | `signUpload`, `put`, `signedUrl`, `delete`. Database stores keys only |
| `SearchIndex` | Meilisearch, Typesense | `upsert`, `delete`, `search`, `rebuild`. Rebuilt from the outbox |
| `IdentityProvider` | Google OIDC, Apple Sign-In | Server-side code exchange and ID-token verification |
| `AnalyticsSink` | GA4, Meta CAPI | Server-side conversion events, deduplicated by event ID, consent-gated |
| `AccountingExport` | Tally XML, CSV/Excel | Clean ledger hand-off |

**Adapter rules.** Timeouts are explicit (connect 3 s, read 10 s; 30 s for file imports). Every call is retried with backoff on transport errors only — never on a definitive business rejection. Credentials live in the secret manager, never in `store_settings`. Provider payloads are redacted before logging. A degraded provider is detected by health checks and, where the blueprint allows, an alternate is offered (gateway down → alternate gateway or COD if eligible).

---

## 17. Caching and invalidation

| Cache | Key | TTL | Invalidated by |
|---|---|---|---|
| Product detail | `pdp:{store}:{slug}:{locale}` | 300 s | Publish, price change, media change, review approval |
| Destination/collection listing | `list:{scope}:{filters_hash}:{page}` where `scope` is a destination or collection slug | 120 s | Publish, membership change, price change |
| Facet counts | `facets:{scope}:{filters_hash}` | 120 s | Same as listing |
| CMS route | `cms:{locale}:{slug}:{version}` | 600 s | Publish, schedule activation, revert |
| Rating summary | `rating:{product}` | 600 s | Review approval/rejection |
| Cart read | `cart:{user}` | 60 s | Every cart mutation (write-through) |
| Session/permission | `perm:{user}:{store}` | 60 s | Role/permission/scope change |
| Rate limits, locks | `rl:*`, `lock:*` | Window | — |

**Rules.** Invalidation is emitted **after** a successful commit, never before. Availability is deliberately near-uncached (5 s) and never authoritative for a write — the mutation rechecks stock under a row lock. Cache loss must never lose a confirmed business fact: every cached value is reconstructible from MySQL. Cache keys carry the store and locale so a multi-store future does not require a redesign.

---

## 18. Search indexing

- The index is a **projection**, rebuilt from `domain_events_outbox` — never the authorization or availability source.
- Document shape: product, slug, name, description, brand, categories, collections, tags, colour/size/material axes, effective price range, discount percentage, rating summary, published flag, in-stock flag, destination flags, popularity score.
- Incremental updates on `product.published`, `product.updated`, `price.changed`, `stock.crossed_zero`, `review.approved`, `collection.membership_changed`.
- Full rebuild is a CLI command with a shadow index and an atomic alias swap — zero-downtime, and safe to run during a drop.
- Typo tolerance, synonyms from `search_synonyms` (`hoody → hoodie`, `tshirt → t-shirt`, `sneaker → sneakers`), and locale-aware analysis.
- Zero-result queries are logged to `search_queries` and surface in the weekly report (F19).
- **PDP stock always comes from live inventory, never from the search document.** A stale index can therefore never sell a dead SKU.
- Budget: faceted results ≤ 200 ms at 100k SKUs. MySQL `FULLTEXT` is an emergency fallback only and is never the target.

---

## 19. Media, documents, and exports

### 19.1 Media

Uploads are **always** two-phase: `POST …/uploads/sign` returns a signed, short-lived, content-type- and size-constrained grant; the client uploads directly to object storage; the backend then validates. Assets stay **quarantined** until type-checked, malware-scanned, size-capped, and EXIF-stripped. Derivatives (AVIF/WebP, responsive widths) are generated asynchronously. Published product and CMS content can never reference a quarantined asset, and publishable imagery requires alt text. Media is served from a separate origin.

### 19.2 Documents

Invoices, credit notes, packing slips, and shipping labels are generated asynchronously into object storage, and exposed only through **signed, expiring URLs**. Invoice and credit-note numbers are allocated under a row lock from `invoice_sequences`, are never reused, and issued documents are immutable — a correction is a credit note, never an edit. Labels are 4×6 PDF/ZPL from the courier adapter; a reprint reuses the existing AWB.

### 19.3 Exports

Every export is asynchronous: `POST …/exports` returns `202` with an export ID, a worker builds the file, and the status endpoint returns a signed URL. Financial exports require `reports.financial.view` or `payments.exports.create`, and creation, completion, and download are all audited. Exports are capped, chunked, and never assembled in a web request.

---

## 20. Observability

### 20.1 Structured logging

Every log line is JSON with `timestamp`, `level`, `request_id`, `principal_type`, `principal_id` (public ID), `route`, `status`, `duration_ms`, `db_ms`, and `queries`. **Never logged:** passwords, tokens, OTPs, card data, CVV, full PAN, gateway secrets, unredacted provider payloads, or raw customer PII. Provider request/response bodies are stored redacted in `payment_attempts` and `webhook_inbox`, and MySQL general/slow logs are configured to avoid or redact parameter values that can contain PII.

### 20.2 Metrics

Latency p50/p95/p99 per route class · error rate by `ICE-*` code · **payment success rate** · checkout funnel drop-off by step · **oversell attempts** (should be structurally zero) · reservation expiry rate · webhook lag and failure rate · outbox lag · queue depth and dead letters · job duration · search latency · cache hit ratio · rollup freshness · DB connections, slow queries, deadlocks.

### 20.3 Alerts — the things that cost money

| Alert | Threshold |
|---|---|
| Payment success rate | < 92% over 15 min |
| Checkout error rate | > 2% over 5 min |
| Webhook backlog | > 100 unprocessed or > 5 min old |
| Outbox lag | > 500 unpublished or > 5 min |
| Queue depth / dead letters | Depth > 1000, or **any** money-path dead letter |
| Oversell event | **Any** — page immediately |
| Reservation expiry spike | > 3× the 7-day baseline |
| Provider health | Any gateway or courier adapter failing repeatedly |
| Rollup staleness | > 15 min |
| Restore artifact missing | Any backup job without a verified restorable artifact |

Error tracking (Sentry) is wired on both tiers with `request_id` correlation; uptime checks watch checkout specifically. A status page and incident runbooks accompany the documented drop-day playbook (scale up, cache warm, queue drain, war room).

---

## 21. Security standards

**Application.** OWASP Top 10 compliance · **prepared statements only**, zero string-built SQL · input validation mirrored between backend validators and frontend Zod, contract-tested · output encoding · strict CORS allow-list · security headers (HSTS, CSP, `X-Frame-Options: DENY`, `X-Content-Type-Options`, `Referrer-Policy`) · uploads type-checked, size-capped, EXIF-stripped, malware-scanned, served from a separate origin.

**Authentication and access.** Argon2id password hashing · rotating refresh tokens with reuse detection and family revocation · access token in JavaScript memory only · refresh token `HttpOnly; Secure; SameSite=Lax`, path-scoped · **CSRF double-submit mandatory** on refresh and every cookie-authenticated mutation · separate cookie names and JWT audiences for customer and staff · deny-by-default RBAC with row and field scope · mandatory MFA for production `ADMIN` · step-up re-auth for settings, roles, and PII reveal.

**Money and data.** PCI-DSS SAQ-A posture — card data never touches our servers; gateway-hosted fields and network tokenization only, and no PAN or CVV column exists in the schema · payout destinations application-encrypted with searchable hashes stored separately · TLS 1.2+ everywhere · encrypted backups and replicas in a separate failure domain · secrets in environment/secret manager only, never in code, never in `store_settings`, never returned by any API · DPDP-aware consent capture, purpose limitation, and deletion on request.

**Operations.** Webhook HMAC verification with a timestamp window and replay rejection · per-endpoint-class rate limits with `429` + `Retry-After` · least-privilege database users (`iced_app_rw`, `iced_worker_rw`, `iced_reporting_ro`, `iced_migrator`, `iced_backup`) with **no `UPDATE`/`DELETE` on the 17 append-only ledgers** · dependency vulnerability scanning in CI · separate credentials per environment · audit rows for every privileged mutation.

**IDOR posture.** Every path parameter is a UUIDv7 public ID; every read and write re-checks ownership or scope server-side. Security tests assert that a customer cannot read another customer's order, a warehouse user cannot read finance or unmasked PII, a support agent cannot approve a refund, and a manager cannot reach staff, roles, or protected settings.

---

## 22. Testing and quality gates

| Layer | Tooling | Scope | Target |
|---|---|---|---|
| Unit | PHPUnit | Pricing, coupons, tax, shipping rates, store credit, stock math, state machines | **≥ 85% of Services** |
| Repository | PHPUnit + MySQL | SQL correctness, index usage, lock ordering | All hot paths |
| Contract | PHPUnit + shared schema fixtures | Envelope shape, error codes, validator ↔ Zod parity | **All endpoints** |
| API/integration | PHPUnit + Postman/Newman | Endpoint contracts, RBAC, validation, idempotency, masking | All endpoints |
| Concurrency | PHPUnit + parallel harness | Last-unit purchase, double-submit, duplicate webhook, refund replay | 100% of money/stock paths |
| Performance | k6 | Drop-day traffic, checkout under load | p95 ≤ 300 ms; catalog ≤ 150 ms |
| Security | OWASP ZAP + manual review | Top-10, authz bypass, IDOR on every public ID | Every release |
| Migration | CLI harness | Up/down, checksum, production-size clone timing | Every migration |
| UAT | Pilot with real orders | A full week of live operations | Owner sign-off |

### 22.1 Backend tests that must always pass

Register → OTP → login → refresh rotation → **reuse detection revokes the family** · guest `POST /cart/items` returns `401` and writes **no** row · guest `/checkout/**` and order creation return `401`/`403` and write no row · signed bag intent resumes **exactly once** after login · **concurrent purchase of the last unit produces exactly one order and one `ICE-INV-409`** · duplicate `Idempotency-Key` returns the original order, one charge · duplicate payment webhook is a no-op · amount mismatch opens a reconciliation case and blocks the order · reservation expiry releases stock and expires the order once · coupon reserve → consume → release across cancel and full refund · cancel → refund → credit note arithmetic reconciles to the paise · return QC pass restocks, QC fail does not · refund cannot exceed the remaining refundable balance · support cannot approve a refund · warehouse cannot read finance or unmasked PII · customer cannot read another customer's order · staff token rejected on `/me/**` and customer token rejected on `/console/**` **on audience** · append-only ledgers reject `UPDATE`/`DELETE` from the application role · every `ICE-*` code in §9.2 is produced by at least one test.

Additional practices: seeded demo data for every module · the regression suite runs in CI · **every fixed bug gets a failing test first**.

---

## 23. Configuration and environment

12-Factor: all configuration is environment-driven; no secret is ever committed, and no secret is ever returned by any API. `config/*.php` reads environment variables, applies typed defaults, and **fails fast at boot** on a missing required key.

| Group | Keys |
|---|---|
| App | `APP_ENV`, `APP_URL`, `API_URL`, `APP_DEBUG` (never `true` in production), `APP_TIMEZONE=UTC`, `STORE_TIMEZONE=Asia/Kolkata` |
| Database | `DB_HOST`, `DB_PORT`, `DB_DATABASE`, `DB_USERNAME`, `DB_PASSWORD`, `DB_SSL_CA` |
| Redis | `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`, `REDIS_DB_CACHE`, `REDIS_DB_QUEUE`, `REDIS_DB_SESSION` |
| Auth | `JWT_PRIVATE_KEY`, `JWT_PUBLIC_KEY`, `JWT_ACCESS_TTL=900`, `JWT_REFRESH_TTL=2592000`, `CUSTOMER_COOKIE_NAME`, `STAFF_COOKIE_NAME`, `CSRF_SECRET` |
| Payments | `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `STRIPE_*`, `PAYPAL_*` |
| Shipping | `SHIPROCKET_*`, `DELHIVERY_*`, `BLUEDART_*` |
| Messaging | `SMTP_*`, `SMS_*` (DLT IDs), `WHATSAPP_*`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` |
| Storage/CDN | `S3_ENDPOINT`, `S3_BUCKET`, `S3_KEY`, `S3_SECRET`, `CDN_BASE_URL`, `MEDIA_ORIGIN` |
| Search | `SEARCH_ENGINE` (`meilisearch` or `typesense`), `SEARCH_HOST`, `SEARCH_API_KEY` |
| Security | `CORS_ALLOWED_ORIGINS`, `TRUSTED_PROXIES`, `RATE_LIMIT_PROFILE`, `ENCRYPTION_KEY` |
| Features | `FEATURE_*` flags for drops, payment providers, and new checkout steps — ship dark, enable deliberately |

**Business policy is not environment configuration.** The values in `database.md` §11.2 — cart cap, reservation minutes, free-shipping threshold, COD limits and fee, return window, NDR timings, quiet hours, frequency caps, review invite timing, deletion grace — live in versioned `store_settings`, are changed through `PUT /console/settings/{namespace}`, and every change is an audited business decision rather than an untracked code edit.

---

## 24. Deployment and release

**Environments:** `local` (Docker Compose parity) · `dev` · `staging` (production mirror for UAT, load tests, release rehearsal) · `production`.

**Pipeline:** lint (PSR-12) → static analysis (PHPStan level 8) → unit → contract → integration → concurrency → security scan → build artifact → migrate → deploy → smoke.

**Release mechanics.** Nginx + PHP-FPM with zero-downtime symlink releases; opcache reset after the symlink swap; workers drained and restarted **after** the web tier so a new job payload never meets an old handler. Protected `main`, `develop`, `feature/*`, `fix/*`; Conventional Commits → auto-generated CHANGELOG; Semantic Versioning. Money-path changes require two reviewers.

**Migrations.** Gated, checksum-verified, reversible, applied under an advisory lock by `bin/console.php migrate`. Expand → backfill → switch → constrain → contract. A migration is never destructive in the same release as the code that depends on the removal. Every migration ships with expected row count, lock/space impact, verification SQL, rollback or forward-fix procedure, and PITR confirmation for financial, stock, or identity changes.

**Reliability.** Nightly full backups plus binlog point-in-time recovery (**RPO ≤ 5 min, RTO ≤ 1 h**), encrypted and offsite, restore-tested monthly and drilled quarterly per `database.md` §13.

---

## 25. Delivery phases and four-document cross-map

The backend ships in 10 steps that follow the blueprint's build order `20 → 1 → 19a → 2 → 3 → 6 → 4 → 10 → 9 → 7 → 17 → 8 → 18 → 13 → 5 → 11 → 12 → 15 → 16 → 19b → 14`.

| Step | Scope | Exit outcome |
|---|---|---|
| 0 | Kernel: front controller, router, middleware pipeline, envelope, error mapping, config, logging, health | A route can be added and tested end to end |
| 1 | Module 20 + 1: auth, sessions, RBAC, audit, rate limits, CSRF, idempotency, outbox | Identity and the security spine are real |
| 2 | Module 19a + 2 + 3: CMS read API, catalog, media, prices, inventory reads | A browsable, CMS-driven storefront with live availability |
| 3 | Module 6 + 12: search indexing, facets, suggestions, recommendations | Discovery meets the ≤200 ms facet budget |
| 4 | Module 4 + 10 + 17 (rates): cart, pricing, coupon, tax, shipping rate engines | A server-priced cart that cannot be argued with |
| 5 | Module 9 + 7: checkout sessions, order creation, reservations, payments, webhooks, invoices | **The money path**, with the concurrency suite green |
| 6 | Module 7 + 17 + 8: allocation, warehouse tasks, AWB/labels/manifests, tracking, NDR | Parcels leave the building and report themselves |
| 7 | Module 18 + 9 (refunds): returns, QC, exchanges, refunds, credit notes, settlements, reconciliation | Reverse logistics and finance close cleanly |
| 8 | Module 13 + 5 + 11 + 14: notifications, wishlist alerts, reviews, support | The lifecycle retains customers |
| 9 | Module 15 + 16 + 19b: rollups, reports, exports, CMS authoring, staff/roles/settings, partner API | The full control plane |
| 10 | Hardening: performance, security review, DR drill, load test, UAT | Launch gates pass |

### 25.1 Four-document phase cross-map

The four planning documents count phases differently because they measure different things. They are not in conflict; this is the mapping.

| Blueprint phase (13) | `frontend.md` phase (11) | `database.md` step (10) | `backend.md` step (10) |
|---|---|---|---|
| 1 · Vision & requirements | — | — | — |
| 2 · Business flows | — | — | — |
| 3 · Module documentation | — | 1 · Stores, identity, RBAC, audit | 0 · Kernel |
| 4 · Database design | — | 2 · Catalog, variants | — |
| 5 · API documentation | — | 3 · Warehouses, inventory | — |
| 6 · Design system | 0 · Tooling, tokens, primitives | — | — |
| 7 · Frontend architecture | 1 · Auth, users, storefront shell, CMS read (19a) | 4 · Carts, checkout, coupons, wishlist | 1–2 · Auth/RBAC, CMS read, catalog, inventory |
| 8 · Backend architecture | 2–3 · Catalog, PDP, cart, checkout | 5 · Tax, orders, invoices | 3–4 · Search, cart, pricing, coupon, tax, shipping |
| 9 · Commerce build-out | 4–6 · Orders, payments, fulfilment, returns | 6–7 · Payments, refunds, shipping, returns | 5–7 · Money path, fulfilment, reverse logistics |
| 10 · Growth build-out | 7–8 · Wishlist, reviews, recommendations, admin shell | 8 · Reviews, notifications, support | 8 · Notifications, reviews, support |
| 11 · Ops build-out | 9 · CMS authoring (19b), coupons, analytics, RBAC | 9 · CMS, navigation, redirects | 9 · Rollups, reports, CMS authoring, access, partner |
| 12 · Testing & hardening | 10 · Hardening, accessibility, performance | 10 · Idempotency, outbox, analytics, DR | 10 · Hardening, load, security, DR |
| 13 · Launch & operate | 10 · Launch gates | 10 · Launch gates | 10 · Launch gates |

---

## 26. Backend acceptance checklist

- [ ] Exactly four executable entry points exist; only `backend/public/` is web-reachable.
- [ ] Every route declares an audience, a permission where applicable, a validator, and a rate-limit class; the route linter fails CI otherwise.
- [ ] Every response uses the standard envelope with `request_id` and ISO-8601 UTC timestamp; money is always a string decimal plus currency.
- [ ] Every error carries an `ICE-<MODULE>-<HTTP>` code and a human sentence; every code in §9.2 is produced by at least one test.
- [ ] Guests receive `401` on cart mutation, checkout-session creation, payment initiation, and order creation, and **no commerce row is written**.
- [ ] One signed bag intent resumes at most once after login, after fresh signature, expiry, publication, and stock validation. There is no guest-cart merge.
- [ ] The entire cart is re-priced and revalidated on every read and every mutation; the response is always the complete cart.
- [ ] Order creation is idempotent: the same key returns the original order; a different payload on the same key returns `409 ICE-IDMP-409`.
- [ ] Concurrent purchase of the last unit produces exactly one order and one `ICE-INV-409`; oversell is structurally impossible.
- [ ] Payment confirmation converges from webhook and verify; the second arrival is a no-op; a mismatch opens a `payment_reconciliation_cases` row and blocks the order.
- [ ] Every stock change writes an `inventory_movements` row in the same transaction; no direct `UPDATE inventory` exists in the codebase.
- [ ] No transaction spans an external HTTP call; all provider calls run after commit through the outbox or a job.
- [ ] Invoice and credit-note numbers are allocated under a row lock, never reused, and issued documents are immutable.
- [ ] Refund approval requires `refunds.approve`; `SUPPORT` can only reach `POST /console/refunds`; every decision is audited with actor, permission, reason, request ID, and before/after state.
- [ ] Return stock is restocked only after QC passes; failed dispositions write `RETURN_SCRAP` and never inflate availability.
- [ ] Customer and staff sessions are separated by cookie name **and** JWT audience; a cross-audience token is rejected before any role check.
- [ ] CSRF double-submit tokens are enforced on refresh and every cookie-authenticated mutation.
- [ ] Permission, store, warehouse, row, and field scopes pass IDOR tests for `CUSTOMER`, `SUPPORT`, `WAREHOUSE`, `MANAGER`, and `ADMIN`.
- [ ] PII reveals, exports, price changes, role changes, settings changes, and financial report access all require the permission and write `audit_logs`.
- [ ] Webhooks verify HMAC, persist the raw payload before parsing, return `200` fast, and process idempotently; duplicates are recorded no-ops.
- [ ] The outbox is written inside the business transaction; every consumer deduplicates by event ID; dead letters alert ops.
- [ ] Search is a projection rebuilt from the outbox; PDP stock always comes from live inventory.
- [ ] Caches invalidate only after a successful commit and are fully reconstructible from MySQL.
- [ ] Uploads are two-phase and signed; assets stay quarantined until validated and EXIF-stripped; published content never references a quarantined asset.
- [ ] Sitemaps, `robots.txt`, and redirects are served by the backend/CDN — never by a Next.js route handler.
- [ ] `p95 ≤ 300 ms` on core endpoints and `≤ 150 ms` on cached catalog reads, measured on production-scale data.
- [ ] Backups produce a verified restorable artifact; a clean restore plus binlog replay meets RPO ≤ 5 min / RTO ≤ 1 h and passes stock, money, document-sequence, outbox, and permission reconciliation.
- [ ] No secret, token, OTP, card value, or raw PII appears in any log, error report, or API response.

---

## 27. Final backend principle

The frontend asks three questions of every screen: what is true right now, what can this person do next, and what happens if it fails. The backend answers all three, and it answers them the same way whether the caller is the storefront, the console, a warehouse scanner, a partner key, or a retried webhook from four hours ago.

That is the whole job. The server owns truth, the webhook is truth rather than the redirect, and every money or stock write is idempotent and logged — so that when two people buy the last M at the same moment, when the payment webhook arrives late, when the courier goes silent, and when the parcel comes back, the system already knows exactly what to do.

> **One API. Every flow. Zero leakage.**
