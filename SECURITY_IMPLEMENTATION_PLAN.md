# Iced-Out Security Implementation Plan

**Status:** **IMPLEMENTED** — Phases 0–6 delivered. See §0 for what shipped and what did not.
**Audited at:** `main @ fc77070` · **Date:** 2026-09-07
**Scope:** `frontend/`, `backend/`, `iced-out-crm/frontend/`, `iced-out-crm/backend/`, `tools/live/`, `live/`

> The body of this document below §0 is the **original audit**, left as written. It is the record of
> what was found and why, and it is deliberately not rewritten in the past tense — a plan edited to
> match what was built stops being evidence of anything. §0 is the only part added afterwards.

---

## 0. Implementation status

All six phases are implemented, then independently re-audited — see *Second wave* below, which found
eleven further defects, most of them **controls that existed and were never called**.

**187 assertions across 14 runnable suites**, every one passing. The suites need no
`composer install` — they are plain PHP scripts in the repository's existing `tests/Smoke/`
convention, and each runs inside a transaction that is rolled back, so they are safe against a
database with real data in it.

```
backend/tests/Smoke/payment-security-smoke.php        24    P0 payment integrity + webhook
backend/tests/Smoke/ownership-smoke.php               14    IDOR / object-level authorisation
backend/tests/Smoke/checkout-input-smoke.php          13    input bounds on the one unvalidated route
backend/tests/Smoke/cross-audience-smoke.php          12    staff session vs the shop
backend/tests/Smoke/blocked-account-smoke.php         11    BLOCKED actually blocks, at once
backend/tests/Smoke/password-reset-smoke.php          11    the credential that replaces a password
backend/tests/Smoke/route-config-smoke.php            11    the route table means what it says
backend/tests/Smoke/idempotency-smoke.php             10    the concurrency race
iced-out-crm/…/mfa-smoke.php                          25    two-factor sign-in + the ledger
iced-out-crm/…/route-config-smoke.php                 15    buckets, audiences, step-up flags
iced-out-crm/…/cross-audience-smoke.php               11    customer session vs the console
iced-out-crm/…/step-up-smoke.php                      11    privileged-action re-auth
iced-out-crm/…/refund-limits-smoke.php                10    over-refund + uncaptured payments
iced-out-crm/…/cancellation-smoke.php                  9    wallet reversal, and its limits
```

Run them all:

```bash
for f in backend/tests/Smoke/*.php; do (cd backend && php "tests/Smoke/$(basename $f)"); done
for f in iced-out-crm/backend/tests/Smoke/*.php; do (cd iced-out-crm/backend && php "tests/Smoke/$(basename $f)"); done
```

Three **pre-existing** CRM suites (`crm-smoke`, `materials-smoke`, `tracking-smoke`) do not pass on
the development machine, and not because of anything here: they sign in as `admin@gmail.com`, seeded
by `iced-out-crm/backend/seeds/0003_admin_account.php`, which was never applied to that database.
All 16 `tracking-smoke` failures cascade from that one sign-in; its 36 public-tracking assertions
pass. Related to the schema drift in runbooks §11.

`backend/tests/Contract/PaymentIntegrityTest.php` is the same P0 suite as PHPUnit, for when
`composer install` has been run.

### The eight P0s

| ID | What was wrong | What closed it |
| --- | --- | --- |
| SEC-PAY-01 | `PlaceOrderService` read `payment.outcome` from the request body — a `curl` call produced a confirmed, stock-reserving order for nothing | `settle()` derives the outcome from a VERIFIED `payment_intents` row; the client's field is read and not believed |
| SEC-PAY-02 | The signature check's result was returned to the browser and forgotten; nothing bound a payment id to an order | `payment_intents` + `uq_payment_intents_payment`: one payment id backs one order, ever |
| SEC-PAY-03 | The gateway amount was client-supplied and never reconciled | The intent is claimed only when `amount_paise` equals the server-priced `total − wallet_applied`, exactly |
| SEC-PAY-04 | The amount-only degraded flow recorded `verified:false` payments as captured | Closed by construction — no intent means no capture. The frontend also fails closed on `rzp_live_*` keys |
| SEC-PAY-05 | A simulated card sheet completed `outcome:"captured"` with no gateway | Same mechanism; the option is also hidden under a live key |
| SEC-PAY-06 | No webhook: `RAZORPAY_WEBHOOK_SECRET`, `verifyWebhook()` and `webhook_inbox` all existed and were wired to nothing | `POST /webhooks/razorpay` — raw-body HMAC, `hash_equals`, dedupe on `(provider, event_id)`, and it **cannot create orders** |
| SEC-DEP-01 | Archives and dumps in the document root matched no deny rule | Extension and `.git` rules in `htaccess-root`, asserted by the build; `tools/deploy-probe.mjs` verifies from outside |
| SEC-DEP-02 | A development `.env` in a deployment bundle fails silently in four ways | `GET /ready` reports the store unhealthy and names which |

### Everything else delivered

**P1** — wallet reversal on cancellation (`reverseOrder()` existed and was called from nowhere) ·
concurrency-safe idempotency · the `sweep` command · `TRUSTED_ORIGINS` split from CORS ·
risk-based rate limits, fail-closed for credential and money buckets, and a pre-route bucket so
endpoint enumeration is no longer free · email-change re-authentication · `PASSWORD_PEPPER`
decoupled from `SESSION_SECRET` · log redaction and a production mail guard · the cross-audience
test restored · the image-bomb guard · password minimums aligned · CSP/Permissions-Policy/COOP
generated with per-build script hashes · `npm audit` and an XSS-sink grep as checks 5 and 6 of
`tools/audit.mjs` · `nanoid` patched.

**P2** — refund locking and the over-refund hole (the guard counted only `Succeeded` refunds while
every refund is born `Requested`) · refund/gateway reconciliation via webhook · customer-side audit
rows · credential-change notifications · private media · step-up authentication · TOTP MFA.

### Not implemented, and why

| Item | Reason |
| --- | --- |
| SEC-DB-01 database privilege separation | A hosting change with no code change. Documented as a procedure in [`docs/security-runbooks.md`](docs/security-runbooks.md) §8, correctly sequenced after the go-live work |
| SEC-SUP-01 lockfile integrity hashes | **Verified and open.** 75 production packages in `frontend/package-lock.json` — `react` and `axios` among them — have no `integrity` hash, so npm installs them unverified. Two regeneration approaches were tried here and both failed (one made it worse); the lockfile was restored exactly. The fix needs a clean `rm -rf node_modules` reinstall, which is not something to do unasked in a working tree. Procedure and the verification one-liner: runbooks §12 |
| SEC-ACC-02 per-email lockout | Adding an IP dimension risks weakening the control while tuning it; wanted real traffic data first |
| SEC-ACC-05 rotating the caller's own session on password change | Analysed and **deliberately skipped**: `revokeOtherSessions` already kills an attacker's session when the owner changes the password, and if the attacker knows the password they have won regardless. Code for its own sake |
| CRM dialogs for step-up and MFA | The APIs and the client helper (`src/api/step-up.ts`) exist; the UI does not. MFA is opt-in and off, so nothing is broken until someone enrols |

### Second wave: found by independent review of the work above

The six phases were then re-audited end to end. That pass found defects the original audit could not
have seen, because most of them were **controls that existed and were never called** — code a reader
finds by looking for it, not by reading the file it should have been used in. All of the following
are fixed and covered by tests.

| What was wrong | Why it mattered | Proof |
| --- | --- | --- |
| **`Principal::isBlocked()` was called from nowhere.** Defined in both codebases since the console shipped. "Block customer" wrote `BLOCKED` to the database, the register displayed it, and no code path read it | A blocked account signed in, ordered, and spent wallet credit exactly as before. **Two BLOCKED rows in the development database would sign in today.** The worst shape a control can take: present in the UI, present in the schema, absent in the middleware — so it gets *trusted* | `backend/tests/Smoke/blocked-account-smoke.php` (11) — including that an **already-issued** session dies on the next request, not at expiry |
| **MFA recovery codes could not be used.** The route rule capped `code` at 16 characters; the codes issued are 21 (`10hex-10hex`) | Every recovery code the system generated was rejected by the endpoint that accepts it. A staff member who lost their phone would have been **permanently locked out**, with a 422 naming the field and not the reason | `mfa-smoke.php` |
| **The MFA lockout could be reset at will.** `AuthService::login()` wrote `was_success = 1` as soon as the password checked out — before the second factor, and before the session it minted was revoked. `recentFailures()` counts failures *since the last success* | Someone with a phished staff password could zero the counter between every guess and grind the six digits indefinitely. It also made `login_attempts` untrue, which is the table an incident is investigated from | `mfa-smoke.php` — asserts exactly 4 success rows across 8 sign-ins |
| **Refunds against money never taken.** Every guard was about *amount*; nothing asked whether the payment was `Captured`. `Due` (uncollected COD) and `Failed` both carry a real `amount` | Real money leaves the merchant account against money that never entered it. **Five `Due` and one `Failed` payment in the development database were refundable in full** | `refund-limits-smoke.php` (10) |
| **A delivered order could be cancelled** — `console_state` only holds Placed/Confirmed/Cancelled, so delivery (tracked on the shipment) left it reading `Confirmed` | Made worse by the wallet reversal delivered in P1: cancelling now hands back store credit for goods the customer already has | `cancellation-smoke.php` (9) |
| **The password-reset code hash was unkeyed.** A bare SHA-256 over `audience\|email\|code`, where the only secret is **six digits** | Anyone who could *read* `auth_tokens` recovered a live code by trying all one million candidates. Measured here, in interpreted PHP: **0.44 seconds**. Any read-only exposure became account takeover | `password-reset-smoke.php` (11) — asserts the search now fails **and**, as a control, that the same search still breaks the old form |
| **`POST /checkout/orders` declared no validation rules at all** — the only mutation of its size that did not. No maximum on name, address, city or state; no cap on the *number* of lines | Over-length either 500s the checkout *after the card has cleared* (strict mode) or **silently truncates a delivery address** (without it). Unbounded lines meant thousands of `FOR UPDATE` stock locks in one transaction, from an attacker with no account | `checkout-input-smoke.php` (13) — including that 120 and 255 are still *accepted*, so the caps are not a character tight |
| **CSV formula injection into the finance export.** `payments.reference` is taken from the checkout body on the non-captured path | An anonymous cash-on-delivery order plants `=HYPERLINK(...)`, and it runs on the workstation of the one person who has every order and every amount in front of them | `Support\Csv`, applied at the export |
| **Two rate limits silently discarded by PHP's own array semantics.** `'rate_limit'` twice in one literal (last wins) on media upload; `$read(...) + ['rate_limit' => 'exports']` on the payments export (array union keeps the **left**) | Upload ran at 60/min instead of 10/hour (**360x**); the payments export at 300/min instead of 5/hour (**3600x**) while the method's own docblock said "rate-limited 5/hour". Invisible in review — the correct intention is written right there | `route-config-smoke.php`, both codebases (11 + 15). Sabotage-tested: reintroducing the duplicate fails the suite |
| **`POST /me/password` had no rate limit at all** — not even `default` | It takes the current password and says whether it was right: a credential oracle for anyone holding a stolen session cookie, at whatever rate the host would answer | New `password_change` bucket (10/hour, scope `both`); asserted by name in `route-config-smoke.php` |
| A development origin could be trusted for cookie-authenticated writes in production, via the documented `TRUSTED_ORIGINS` → `CORS_ALLOWED_ORIGINS` fallback | `http://localhost:3000` left in a CORS list is then trusted to place orders and change passwords | New `/ready` check `trusted_origins_clean`, reported not enforced. Verified against 8 cases including `localhost.evil.com` (correctly clean) and unparseable input (fails closed) |

Two findings from that pass were **rejected on inspection** rather than fixed, and both are recorded
here so they are not "found" again:

* **Forgot-password names an unknown address** (`422` vs `202`). Deliberate, and documented at length
  on `AuthController::forgotPassword`: `/auth/register` two routes up already answers "an account
  with that email already exists" on a looser limit, so silence here protects nothing while costing
  every shopper who mistyped their address a ten-minute wait. The console's twin correctly stays
  neutral, because the console has no public registration. `password-reset-smoke.php` now **asserts
  the asymmetry**, so "making them consistent" breaks a test and sends the reader to the reasoning.
* **HSTS without `includeSubDomains`** — not the case. Every occurrence has it, and the one in
  `htaccess-root` is commented out deliberately (irreversible for a year; `preload` would strand the
  CRM subdomain). It is a go-live step in runbooks §4.

**Binding the MFA challenge to its issuing IP was considered and deliberately not done.** A challenge
grants nothing on its own — single-use, five minutes, useless without a code — so refusing an address
change stops nothing the code check does not already stop, while breaking real sign-ins on the mobile
networks this console is largely operated from. It is recorded as a signal
(`mfa_challenge_address_changed`) instead, where a human can weigh it.

### Found while implementing, not in the original audit

* **The development database has drifted from its migration registry.** Migration 0016 is recorded
  as applied but `products.image_media_id` does not exist, and `stock_items` is empty while 133
  `variant_inventory` rows reference it. On that machine **every checkout fails** on a foreign key.
  Pre-existing and unrelated to any change here. Production must be checked — see runbooks §11.
* **A real stock leak**, found by the sweep's first dry run: a `Payment failed` order from two weeks
  earlier still holding its stock, because nothing ever released expired reservations.
* `nanoid` (high) in the storefront's production dependency tree, via `postcss`.

### Operational work that is still yours

Registering the webhook, verifying the production `.env`, deleting `setup.php`, scheduling the
sweep cron, and rolling the CSP from report-only to enforcing are all in
[`docs/security-runbooks.md`](docs/security-runbooks.md). None of them can be done from here.

### Migrations added

`0031_payment_intents` · `0032_idempotency_in_flight` · `0033_session_step_up` ·
`0034_media_visibility` · `0035_staff_mfa` — all additive: new tables and nullable columns, no drops,
no type changes, no `CHECK` constraints or functional indexes (the two constructs this schema has
already been bitten by across MySQL 8 and MariaDB).

---

## 1. Executive Summary

### 1.1 Current security maturity

Iced-Out is, for a hand-written PHP application, **unusually well built on the classical OWASP
axes**. The audit found no SQL injection, no IDOR, no XSS sink, and no broken object-level
authorisation. Prepared statements are used everywhere with `PDO::ATTR_EMULATE_PREPARES => false`;
every dynamic SQL identifier resolves from a hard-coded whitelist; every `/me/*` query is scoped by
`$principal->userId` rather than by a client-supplied id; the money model is integer paise with no
float anywhere; the wallet ledger takes a row lock and enforces a `(kind, reference)` uniqueness
key; inventory takes `SELECT ... FOR UPDATE` and locks in ascending id order.

The middleware pipeline is genuinely defensive, and one design decision in it is stronger than the
project's own documentation claims: because `Authenticate` **requires** an `X-Client-Audience`
header to match the route's audience *before any cookie is read*
([`Authenticate.php:44`](backend/src/Middleware/Authenticate.php#L44)), a classic cross-site form
POST cannot reach any customer or staff endpoint at all — a `<form>` cannot set a custom header,
and a `fetch()` that sets one triggers a preflight that `Cors` will not answer for an untrusted
origin. `SameSite=Lax` plus `OriginCheck` is therefore the *third* CSRF layer, not the first.

### 1.2 The gap that matters

The application's weakness is not in the categories it was clearly designed against. It is
concentrated in exactly one place:

> **The browser is currently the authority on whether a payment happened.**

`PlaceOrderService::place()` reads the payment outcome straight out of the request body
([`PlaceOrderService.php:133`](backend/src/Service/Checkout/PlaceOrderService.php#L133)):

```php
$outcome = (string) ($input['payment']['outcome'] ?? 'due');
```

and writes a `Captured` / `Razorpay` row into `payments` on that word alone
([`PlaceOrderService.php:319`](backend/src/Service/Checkout/PlaceOrderService.php#L319)). The
signature-verification endpoint exists, is correct, and uses `hash_equals` — but its result is
returned to the browser and **is never persisted, never bound to an order, and never consulted by
the code that creates one**. A `curl` request to `POST /api/v1/checkout/orders` carrying
`payment.outcome = "captured"` produces a real, confirmed, stock-reserving, fulfilment-eligible
order for ₹0.

Three further paths reach the same state without a gateway: the amount-only degraded flow, the
simulated card sheet, and the absence of any Razorpay webhook to reconcile against.

This is safe today only because the store has not yet taken live money. It is an absolute blocker
for Razorpay Live Mode.

### 1.3 Second-tier concerns

* **Deployment.** The flat cPanel layout puts `.env`, `config/`, `src/`, `storage/logs/`,
  `migrations/`, `seeds/` and a full `database/*.sql` dump inside the document root, defended only
  by `.htaccess`. The bundle in `live/` is missing the layer-2 per-directory `.htaccess` files the
  design calls for, and carries a **development** `.env` (`APP_ENV=dev`, `APP_DEBUG=true`,
  `APP_URL=http://127.0.0.1:8000`) plus log files containing emailed password-reset codes.
* **Browser headers.** The storefront is a static export, so `next.config.ts` cannot set headers;
  everything comes from `live/.htaccess`, which sets three headers and no CSP, with HSTS
  commented out.
* **Secret architecture.** `SESSION_SECRET` is simultaneously the session-token HMAC key
  ([`SessionManager.php:209`](backend/src/Service/Auth/SessionManager.php#L209)) **and** the
  password pepper ([`PasswordHasher.php:101`](backend/src/Service/Auth/PasswordHasher.php#L101)),
  and must be byte-identical in both applications. Rotating it after an incident invalidates every
  password hash in the database. There is currently no way to rotate this secret safely.
* **Wallet correctness.** `WalletService::reverseOrder()` exists and is never called. Cancelling
  an order releases its stock but does **not** return the store credit it spent.

### 1.4 Production readiness status

| Surface | Verdict |
| --- | --- |
| Storefront browsing, catalogue, account, addresses, sessions | **Ready** |
| Authentication and authorisation model | **Ready** — one missing regression test |
| SQL / injection / IDOR / XSS | **Ready** — no findings |
| Wallet ledger mechanics (lock, idempotency, no-negative) | **Ready** — one missing reversal |
| Cash-on-delivery checkout | **Ready** |
| **Razorpay Live Mode** | **NOT READY — 6 blocking findings** |
| **Production deployment hardening** | **NOT READY — verification + hardening required** |
| CRM / console (not yet deployed) | Hardening required before it goes up |

### 1.5 Finding counts

| Priority | Count |
| --- | --- |
| **P0** — blocking before live payments / public scale | **8** |
| **P1** — required production hardening | **18** |
| **P2** — strong security improvements | **13** |
| **P3** — future security maturity | **5** |
| *Verified-secure, no action* | 32 controls (recorded in §4 so they are not "fixed" twice) |

---

## 2. Scope and Non-Negotiable Constraints

```
Security enhancement only.
No unnecessary changes to business logic, API contracts, frontend design, or architecture.
```

Every recommendation in this document was written under the following rules, and each task in §22
states its compatibility impact explicitly.

**Preserved without exception:**

* The `{ data, meta }` / `{ error, meta }` envelope in [`Response.php`](backend/src/Kernel/Response.php).
* The route table as the single source of truth (`config/routes/*.php`), and `Endpoint::serve()`
  file-per-endpoint routing.
* The 15-stage middleware pipeline and its order
  ([`Application.php:52-69`](backend/src/Kernel/Application.php#L52-L69)).
* Two cookies, two audiences, two token spaces; opaque server sessions; no JWT.
* `Domain\Money` integer paise. No floats introduced anywhere.
* CSR-only static export for both frontends. No SSR, no `basePath` change, no route changes.
* Core PHP with zero runtime Composer dependencies (`composer.json` requires only PHP extensions).
* The existing checkout *user journey*: steps, screens, copy, and the order in which they happen.
* The shared-database architecture. No schema redesign.
* Razorpay as the gateway.

**Additive-only surfaces this plan uses:**

* New route rows in existing `config/routes/*.php` files (webhook endpoint).
* New forward-only migrations (new tables and nullable columns only — no drops, no type changes to
  existing columns).
* New middleware **appended** to the pipeline only where §10 states the position and why.
* New `.env` keys, all with safe defaults that preserve today's behaviour when unset.
* New tests under the existing `tests/Contract`, `tests/Unit` and `frontend/e2e` trees.

**Explicitly rejected during this review** (considered and not recommended): a CSRF token (the
audience header already blocks the attack — see §5), an ORM, a framework, a Node backend, splitting
the schema, replacing the session model, adding a client-side sanitizer library, and rewriting
`PlaceOrderService`.

### 2.1 State of the working tree at audit time — read this before acting

The audit ran against `main @ fc77070` **plus 58 modified and a number of untracked files**. Two
consequences the implementer must know:

1. **Line numbers may drift.** `PlaceOrderService.php` was itself edited during the audit window
   (the `$outcome` read moved from line 130 to 133). Every reference in this document was
   re-verified against the tree as it stood at the end of the audit, but **confirm the line before
   editing** — the *findings* are anchored to code, not to line numbers.

2. **Uncommitted feature work exists that this audit only spot-checked.** A server-side cart and
   wishlist landed untracked during the review:
   `backend/config/routes/cart.php`, `backend/src/Controller/Customer/CartController.php`,
   `WishlistController.php`, `backend/src/Repository/CartRepository.php`,
   `backend/src/Service/Cart/`, `backend/src/Service/Checkout/CouponResolver.php`, and
   `backend/migrations/0030_wishlist.sql`.

   **Spot-check result — no new findings.** Every operation is scoped by `$principal->userId`, all
   routes are `AUDIENCE_CUSTOMER`, writes use the existing `cart` bucket, no price or discount
   arrives from the client, and `CouponResolver` keeps the cart's quote and the order's
   recomputation on one code path — which *closes* a drift risk rather than opening one. It is not
   covered by the full review that produced §5, so **re-run the §19.2 ownership tests against these
   routes** once they are committed.

   `0030` is taken by `0030_wishlist.sql`, which is why §6.4 proposes **`0031_payment_intents.sql`**.
   Re-check the next free number at implementation time.

3. **A second copy of this filename already exists** at `docs/planning/SECURITY_IMPLEMENTATION_PLAN.md`
   (untracked, pre-existing, not written by this audit). This document is the repository-root one
   the brief asked for. Reconcile or delete the other before either is committed, so there is one
   security plan of record.

---

## 3. Architecture Security Assessment

### 3.1 The four deployables

```
                    ┌──────────────────────────┐        ┌──────────────────────────┐
   shopper ────────▶│  Storefront frontend     │        │  CRM frontend            │◀──── staff
                    │  Next 16 static export   │        │  Next 16 static export   │
                    │  iced-out.node2begin.com │        │  crm.<domain>  (planned) │
                    └───────────┬──────────────┘        └───────────┬──────────────┘
                     same-origin │ /api/v1                same-origin │ /api/v1
                    cookie io_csess                       cookie io_ssess
                    X-Client-Audience: customer           X-Client-Audience: admin
                                │                                     │
                    ┌───────────▼──────────────┐        ┌─────────────▼────────────┐
                    │  Storefront API (PHP)    │        │  CRM API (PHP)           │
                    │  backend/                │        │  iced-out-crm/backend/   │
                    └───────────┬──────────────┘        └─────────────┬────────────┘
                                │        no backend↔backend calls     │
                                └──────────────┬──────────────────────┘
                                               ▼
                                 ┌──────────────────────────────┐
                                 │  ONE MySQL 8 schema          │
                                 │  ONE DB account (today)      │
                                 │  ONE SESSION_SECRET          │
                                 │  ONE MEDIA_ROOT              │
                                 └──────────────────────────────┘
                                               ▲
                                               │  wallet_accounts / wallet_entries
                                               │  orders / payments / refunds
                                               │  webhook_inbox   ← EXISTS, UNUSED
                                               │
       ┌───────────────────────┐    signature  │
       │  Razorpay             │◀──────────────┘  outbound only, server-side, TLS verified
       │  api.razorpay.com     │
       │  checkout.razorpay.com│───────────────▶  browser loads the SDK; returns a payment id
       └───────────────────────┘
                    ✗ NO INBOUND WEBHOOK ENDPOINT EXISTS  ← P0 (SEC-PAY-06)
```

### 3.2 What the architecture gets right

| Property | Verified where | Security effect |
| --- | --- | --- |
| Same-origin API (`/api/v1`) | [`clients.ts:34`](frontend/src/api/clients.ts#L34) | No CORS in production; cookies are first-party; no preflight surface |
| Separate cookies per audience | [`SessionManager.php:56-62`](backend/src/Service/Auth/SessionManager.php#L56-L62) | A staff cookie is not even *sent* to the storefront host once the CRM is on its own subdomain |
| Audience gate before identity | [`Authenticate.php:41-47`](backend/src/Middleware/Authenticate.php#L41-L47) | Cross-audience replay is refused before a token is looked up |
| Two token spaces in one table | `user_sessions.audience` + `users.type` cross-check ([`SessionManager.php:132`](backend/src/Service/Auth/SessionManager.php#L132)) | A customer row cannot resolve as staff even with a stolen hash |
| No backend↔backend RPC | audit of both `src/Integration/` trees | Compromising one API gives no *additional* API surface |
| Zero Composer runtime deps | [`composer.json`](backend/composer.json) | No PHP supply-chain surface in production |
| Cookie `Path=/api/v1` | [`SessionManager.php:172`](backend/src/Service/Auth/SessionManager.php#L172) | The static HTML/asset tree never receives the session cookie |

### 3.3 Shared-database risk analysis

The brief asked specific questions. Answers from inspection:

**Can the storefront backend access CRM-sensitive tables?**
Yes — technically. Both applications connect with the same credentials via
[`Database::pdo()`](backend/src/Kernel/Database.php) and there is no schema, view, or grant
separating them. In practice the storefront's *code* touches only its own routes' tables, but a
file-write or RCE in the storefront would reach `crm_contacts`, `crm_deals`, `audit_logs`, `users`
(staff rows included) and `user_sessions`.

**Does the CRM backend have more privileges than necessary?**
Not relative to the storefront — they are identical. Both hold whatever cPanel's "ALL PRIVILEGES"
grant gives, which includes `DROP`, `ALTER` and `CREATE`, because the same account runs migrations
(`php bin/console.php migrate`).

**Could a compromise of one backend expose the entire schema?** Yes.

**Should database users be separated?** *Ideally yes; practically, partly.* See §17/§23. The honest
summary: on cPanel you **can** create three MySQL users and grant them differently, so this is
achievable without leaving the hosting model. What you cannot easily do is prove the grant set stays
correct across cPanel UI changes. Recommended as **P2**, not P0, because it mitigates a
*second-stage* compromise and the first stage — RCE in a dependency-free PHP app with no
upload-to-execute path — is itself unlikely.

**A caveat that matters more than the grant split:** the two applications also share
`SESSION_SECRET` and `MEDIA_ROOT` by design. Splitting the DB user does **not** contain a compromise
of `SESSION_SECRET` — see SEC-SEC-01.

### 3.4 The CRM subdomain decision, from a security view

`PROJECT-STATUS.md §11` records that the CRM will get `crm.iced-out.node2begin.com`, never a
subpath. **This is the correct security decision and should be treated as a hard constraint**, not
just an implementation convenience:

* A separate host means `io_ssess` is never sent to the storefront origin, so an XSS on a product
  page could not reach a staff session even if `HttpOnly` were ever lost.
* Cookies are host-only — no `Domain=` attribute is set
  ([`SessionManager.php:168-181`](backend/src/Service/Auth/SessionManager.php#L168-L181)) — so
  there is no sibling-subdomain cookie leakage. **Do not add a `Domain=` attribute.**
* `OriginCheck` on the CRM will trust only the CRM's own `APP_URL`, so a storefront-origin page
  cannot drive console mutations.

**Constraint to write down:** if the CRM is ever moved to a subpath of the storefront, four findings
in this document change severity and the isolation argument above collapses.

---

## 4. Existing Security Controls (verified, not assumed)

These were read in the repository and confirmed. **They must not be "added" again**, and several
are load-bearing for findings below.

| # | Control | Verified location | Verdict |
| --- | --- | --- | --- |
| C-01 | 15-stage middleware pipeline, error handler *inside* the pipeline so failures still carry security + CORS headers | [`Application.php:52-69`](backend/src/Kernel/Application.php#L52-L69) | **Already secure** |
| C-02 | Endpoint files run the *same* pipeline — no bypass route into controllers | [`Endpoint.php:70`](backend/src/Kernel/Endpoint.php#L70) | **Already secure** |
| C-03 | Audience gate before identity resolution | [`Authenticate.php:41`](backend/src/Middleware/Authenticate.php#L41) | **Already secure** — also the primary CSRF defence |
| C-04 | Opaque 256-bit session tokens, HMAC-SHA256 at rest, raw token never stored | [`SessionManager.php:66`](backend/src/Service/Auth/SessionManager.php#L66) | **Already secure** |
| C-05 | Session lookup joins `users` and rejects on `revoked_at`, `deleted_at`, idle and absolute expiry | [`SessionRepository.php:22-36`](backend/src/Repository/SessionRepository.php#L22-L36) | **Already secure** (one gap — SEC-ACC-03) |
| C-06 | Argon2id with bcrypt-12 fallback, peppered, constant-time dummy verify for unknown accounts | [`PasswordHasher.php`](backend/src/Service/Auth/PasswordHasher.php) | **Already secure** |
| C-07 | Identical 401 for unknown email and wrong password; `/auth/password/forgot` answers 202 either way | [`AuthService.php:56`](backend/src/Service/Auth/AuthService.php#L56) | **Already secure** — no enumeration |
| C-08 | Password reset: hashed 6-digit codes, per-code attempt cap that burns the code, per-account resend cooldown, one live code, revokes **all** sessions on success | [`PasswordResetService.php`](backend/src/Service/Auth/PasswordResetService.php) | **Already secure** |
| C-09 | Origin/Referer validation on cookie-authenticated mutations | [`OriginCheck.php`](backend/src/Middleware/OriginCheck.php) | **Already secure** (one config coupling — SEC-CORS-01) |
| C-10 | CORS never reflects an arbitrary origin; `Allow-Credentials` only for exact allowlist matches; `Vary: Origin` set | [`Cors.php:33-36`](backend/src/Middleware/Cors.php#L33-L36) | **Already secure** |
| C-11 | Client IP taken from `REMOTE_ADDR` only — `X-Forwarded-For` / `X-Real-IP` are **not** trusted | [`Request.php:196-201`](backend/src/Kernel/Request.php#L196-L201) | **Already secure** (deployment caveat — SEC-API-04) |
| C-12 | `X-Request-Id` is validated as a UUID before echoing; a malformed one is replaced | [`RequestId.php:21`](backend/src/Middleware/RequestId.php#L21) | **Already secure** — no header-injection or log-forging vector |
| C-13 | RBAC gate reads the permission from the *route* and the permission set from the DB per request, never from the cookie | [`Authorize.php`](backend/src/Middleware/Authorize.php), [`Principal.php:47`](backend/src/Domain/Principal.php#L47) | **Already secure** |
| C-14 | Ownership scoping: every `/me/*` read and write filters on `$principal->userId` | [`OrderController.php:53-56`](backend/src/Controller/Customer/OrderController.php#L53-L56), [`ProfileController.php:156-164`](backend/src/Controller/Customer/ProfileController.php#L156-L164) | **Already secure** — no IDOR found |
| C-15 | Prepared statements everywhere, `EMULATE_PREPARES=false`, `ERRMODE_EXCEPTION`, `STRICT_ALL_TABLES` | [`Database.php:41-49`](backend/src/Kernel/Database.php#L41-L49) | **Already secure** |
| C-16 | Every dynamic SQL identifier comes from a hard-coded map, never from a request | [`IdAllocator.php:29-34`](backend/src/Support/IdAllocator.php#L29-L34), `Crm/ActivityRepository::SUBJECT_TABLES`, `Crm/CrmIds` | **Already secure** |
| C-17 | Money is integer paise end to end; `fromDecimalString` parses the DECIMAL column without a float | [`Money.php`](backend/src/Domain/Money.php) | **Already secure** |
| C-18 | Order pricing is re-derived from `products.price` inside the transaction; the client's `money.total` is a cross-check only | [`PlaceOrderService.php:104-134`](backend/src/Service/Checkout/PlaceOrderService.php#L104-L134) | **Already secure** |
| C-19 | Wallet: `SELECT ... FOR UPDATE` on the account row, upsert-then-lock, refuse-don't-clamp, `(kind, reference)` unique index for replay safety | [`WalletService.php:200-230`](backend/src/Service/Wallet/WalletService.php#L200-L230) | **Already secure** |
| C-20 | Inventory: `FOR UPDATE` on `variant_inventory`, ascending-id lock order, `available` is a generated column, every write appends `inventory_movements` | [`StockService.php:36-70`](backend/src/Service/Inventory/StockService.php#L36-L70) | **Already secure** |
| C-21 | Nested transactions use savepoints, so a wallet debit cannot commit independently of the order that spent it | [`Database.php:136-176`](backend/src/Kernel/Database.php#L136-L176) | **Already secure** |
| C-22 | Refund amount is validated against `payment.amount − already refunded` | [`Console/PaymentController.php:191-201`](iced-out-crm/backend/src/Controller/Console/PaymentController.php#L191-L201) | **Already secure** (race — SEC-REF-01) |
| C-23 | Uploads: MIME **sniffed** not trusted, image fully re-encoded (strips EXIF and smuggled payloads), 128-bit random storage key, `med-` + 64-bit random public id, served only through the API with `nosniff` | [`MediaService.php:87-232`](backend/src/Service/Media/MediaService.php#L87-L232), [`MediaController.php:61-66`](backend/src/Controller/System/MediaController.php#L61-L66) | **Already secure** (one gap — SEC-UPL-01) |
| C-24 | SVG and GIF are *not* in the encoder table — an SVG upload is refused at `assertStorable()` | [`MediaService.php:31-35`](backend/src/Service/Media/MediaService.php#L31-L35) | **Already secure** — the "SVG script payload" class does not apply |
| C-25 | Razorpay signature check uses `hash_equals`; `CURLOPT_SSL_VERIFYPEER=true`, `VERIFYHOST=2`, `FOLLOWLOCATION=false` | [`RazorpayGateway.php:141-146`](backend/src/Integration/Payments/RazorpayGateway.php#L141-L146) | **Already secure** |
| C-26 | Errors never leak stack traces, SQL, or paths; the trace goes to the log, the client gets `request_id` | [`HandleErrors.php:47-77`](backend/src/Middleware/HandleErrors.php#L47-L77) | **Already secure** |
| C-27 | React escapes all API-derived content; exactly one `dangerouslySetInnerHTML` in the whole repo, and its content is a static compile-time constant | [`layout.tsx:102`](frontend/src/app/layout.tsx#L102) | **Already secure** — no XSS sink |
| C-28 | Reviews, support tickets and returns take the byline/email from the **account**, not the request body | [`feedback.php:39-42`](backend/config/routes/feedback.php#L39-L42) | **Already secure** |
| C-29 | Audit rows for every console mutation with actor, permission, request id, before/after | [`Audit.php`](backend/src/Middleware/Audit.php) | **Already secure** (coverage gap — SEC-LOG-02) |
| C-30 | Login lockout is a *setting*, not a constant; `login_attempts` records every attempt with IP | [`AuthService.php:129-147`](backend/src/Service/Auth/AuthService.php#L129-L147) | **Already secure** (DoS caveat — SEC-ACC-02) |
| C-31 | Secrets are never written to `store_settings`; `key_secret` never reaches a response body | [`config/app.php:74-90`](backend/config/app.php#L74-L90) | **Already secure** |
| C-32 | `.env` files are untracked; `.gitignore` covers `.env`, `.env.*`, and `/live/` | [`.gitignore`](.gitignore) | **Already secure** — `git ls-files` confirms no secret is committed |

---

## 5. Security Risk Register

Severity is CVSS-flavoured judgement, not a computed score. Likelihood assumes the storefront is
public and Razorpay is in **Live** mode.

| ID | Area | Risk | Current State | Severity | Likelihood | Priority | Required Action |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **SEC-PAY-01** | Payments | The browser declares `payment.outcome`; `"captured"` writes a `Captured`/`Razorpay` payment row with no server-side proof. Direct API call ⇒ free orders. | **Security gap** — [`PlaceOrderService.php:133`](backend/src/Service/Checkout/PlaceOrderService.php#L133) | Critical | High | **P0** | Derive the outcome server-side from a verified `payment_intents` row; ignore the client field |
| **SEC-PAY-02** | Payments | The signature-verification result is returned to the browser and never persisted or bound to an order. `payments.reference` is free text from the client; a payment id can be replayed across orders. | **Security gap** — [`PaymentController.php:103-142`](backend/src/Controller/Customer/PaymentController.php#L103-L142) | Critical | High | **P0** | Persist verification in a new `payment_intents` table keyed on `razorpay_order_id`, one-shot consumption |
| **SEC-PAY-03** | Payments | `POST /checkout/payments/razorpay/order` takes `amount` from the client and never reconciles it with the order total. Under-payment is possible. | **Security gap** — [`checkout.php:37-46`](backend/config/routes/checkout.php#L37-L46) | Critical | High | **P0** | Bind the intent to a server-priced quote; refuse an order whose gateway amount ≠ `total − wallet_applied` |
| **SEC-PAY-04** | Payments | Degraded "amount-only" flow: when `createGatewayOrder()` fails, checkout still opens, returns `verified:false`, and the caller records `outcome:"captured"` anyway. | **Security gap** — [`razorpay.ts:104`](frontend/src/features/09-payment/razorpay.ts#L104), [`checkout-flow.tsx:734-740`](frontend/src/features/04-cart/components/checkout-flow.tsx#L734-L740) | Critical | High | **P0** | Fail closed on `rzp_live_*` keys; the server-side fix makes the client change cosmetic |
| **SEC-PAY-05** | Payments | The `card` payment method opens a **simulated** authorisation sheet that completes `outcome:"captured"` with no gateway at all. Reachable from the live UI. | **Security gap** — [`checkout-flow.tsx:775-786`](frontend/src/features/04-cart/components/checkout-flow.tsx#L775-L786) | Critical | High | **P0** | Remove the `card` option from the production build; the server refuses non-allowlisted methods |
| **SEC-PAY-06** | Payments | No Razorpay webhook exists. `RAZORPAY_WEBHOOK_SECRET`, `verifyWebhook()`, `webhook_inbox` and the `webhooks` rate class all exist and are unused. No authoritative reconciliation, no late-capture handling, no dispute signal. | **Security gap** | Critical | High | **P0** | Build the webhook endpoint per §6.5 on the existing `webhook_inbox` table |
| **SEC-DEP-01** | Deployment | Flat layout: `.env`, `config/`, `src/`, `storage/logs/`, `migrations/`, `seeds/`, `database/*.sql` sit in the document root behind `.htaccess` only. The bundle in `live/` has **no layer-2 per-directory `.htaccess`** and carries `LIVE.zip` and a full SQL dump. | **Security gap** | Critical | Medium | **P0** | Verify the server, restore layer 2, remove dumps/archives; plan the move to `split` |
| **SEC-DEP-02** | Deployment | The `.env` present in `live/` is a **development** one: `APP_ENV=dev`, `APP_DEBUG=true`, `APP_URL=http://127.0.0.1:8000`, `CORS_ALLOWED_ORIGINS=http://localhost:3000,…`, `MAIL_DRIVER=log`. With it, cookies are **not** `Secure`, HSTS is not sent, and reset codes are written to disk. | **Cannot verify** the server copy | Critical | Medium | **P0** | **MANUAL VERIFICATION REQUIRED** on the live host; then add production self-checks to `/ready` |
| **SEC-WAL-01** | Wallet | Cancelling an order releases stock but never returns `wallet_applied`. `WalletService::reverseOrder()` exists and is called from nowhere. Customer store credit is destroyed. | **Security gap** — [`OrderConsoleService.php:94-125`](iced-out-crm/backend/src/Service/Order/OrderConsoleService.php#L94-L125) | High | High *(once the CRM is deployed)* | **P1** | Call `reverseOrder()` inside the cancel transaction |
| **SEC-SEC-01** | Secrets | `SESSION_SECRET` is both the session HMAC key and the password pepper, and must be byte-identical in both apps. Rotating it makes **every stored password hash unverifiable**. There is no safe rotation path. | **Existing protection — harden** — [`PasswordHasher.php:101`](backend/src/Service/Auth/PasswordHasher.php#L101) | High | Medium | **P1** | Derive purpose-scoped subkeys from a versioned root; keep old versions verifiable |
| **SEC-HDR-01** | Headers | No CSP on HTML documents. The static export cannot use `next.config.ts` headers, and `live/.htaccess` sets only `nosniff`, `Referrer-Policy` and `X-Frame-Options`. An inline bootstrap script means a nonce is impossible — a hash CSP is required. | **Security gap** — [`live/.htaccess`](live/.htaccess), [`layout.tsx:102`](frontend/src/app/layout.tsx#L102) | High | Medium | **P1** | Report-Only rollout of a hash-based CSP (§16) |
| **SEC-HDR-02** | Headers | HSTS is commented out in `live/.htaccess`; the API sets it only when `APP_URL` starts `https://`. | **Existing protection — harden** | Medium | Medium | **P1** | Enable HSTS after §24 checks pass; `preload` deferred to P3 |
| **SEC-CORS-01** | CORS | `CORS_ALLOWED_ORIGINS` feeds **both** the CORS allowlist and `OriginCheck`'s trust list. Adding one dev origin to fix a CORS problem silently widens CSRF trust. | **Existing protection — harden** — [`OriginCheck.php:64-83`](backend/src/Middleware/OriginCheck.php#L64-L83) | High | Medium | **P1** | Split into `CORS_ALLOWED_ORIGINS` and `TRUSTED_ORIGINS`; default the latter to `APP_URL` alone |
| **SEC-UPL-01** | Uploads | No pixel-dimension cap before `imagecreatefromstring()`. `getimagesize()` already returns width and height and they are not checked. A 30 000 × 30 000 PNG inside the 8 MB byte cap needs ~3.6 GB of RAM. | **Existing protection — harden** — [`MediaService.php:87`](backend/src/Service/Media/MediaService.php#L87) | High | Medium | **P1** | Reject on `width × height > media.max_pixels` between sniff and decode |
| **SEC-ACC-01** | Account | `PATCH /me` changes the account email with no password re-auth, no verification of the new address, and no notification to the old one. Combined with OTP reset this is a session-hijack → full-takeover pivot. | **Security gap** — [`ProfileController.php:68-77`](backend/src/Controller/Customer/ProfileController.php#L68-L77) | High | Medium | **P1** | Require the current password for an email change; notify the previous address |
| **SEC-API-01** | Rate limiting | `RateLimitByIp` sits **after** `ResolveRoute`, which throws 404/405. Unknown-path scanning and verb probing are entirely unlimited. | **Security gap** — [`Application.php:57-61`](backend/src/Kernel/Application.php#L57-L61) | Medium | High | **P1** | Add a coarse pre-route IP bucket in `ResolveRoute`'s catch path |
| **SEC-API-02** | Rate limiting | `FileCacheStore::hit()` **fails open** — an unwritable `storage/cache` returns `count: 1` forever, silently disabling every rate limit including login. | **Security gap** — [`FileCacheStore.php:74-77`](backend/src/Support/Cache/FileCacheStore.php#L74-L77) | High | Low | **P1** | Fail closed for auth/payment/checkout classes; surface in `/ready` |
| **SEC-API-03** | Rate limiting | `POST /checkout/orders` has no `rate_limit` key, so it falls to `default` — 240/min/IP, IP-scoped only, no per-principal bucket. Order creation reserves stock. | **Existing protection — harden** — [`checkout.php:19-27`](backend/config/routes/checkout.php#L19-L27) | Medium | High | **P1** | Give it a `checkout` class, `scope: both` |
| **SEC-INV-01** | Inventory | `inventory_reservations.expires_at` is written but nothing ever sweeps it — there is no cron or worker command. Reservations release only on manual cancel or dispatch, so an authenticated attacker can hold the catalogue with unpaid COD orders. | **Security gap** — no sweeper in `bin/console.php` | High | Medium | **P1** | Add `php bin/console.php sweep`; run it from cPanel cron |
| **SEC-IDMP-01** | Financial | `Idempotency` does read-then-write with no reservation row. Two concurrent identical POSTs both miss the `SELECT` and both execute. | **Existing protection — harden** — [`Idempotency.php:56-96`](backend/src/Middleware/Idempotency.php#L56-L96) | Medium | Medium | **P1** | Insert an in-flight row first; `ON DUPLICATE KEY` ⇒ 409 retryable |
| **SEC-LOG-01** | Logging | `Logger` has no redaction of any kind, and `LogMailer` writes the whole recovery email — **including the OTP** — to `storage/logs`. `live/storage/logs/*.log` in this repository already contains such entries. | **Security gap** — [`Logger.php`](backend/src/Support/Logger.php), [`LogMailer.php:29-37`](backend/src/Integration/Mail/LogMailer.php#L29-L37) | High | Medium | **P1** | Key-based redaction in `Logger::write()`; refuse `MAIL_DRIVER=log` when `APP_ENV=production` |
| **SEC-TEST-01** | Testing | The cross-audience isolation test did not survive the CRM split and is documented as missing in [`StaffAuthFlowTest.php:23-28`](iced-out-crm/backend/tests/Contract/StaffAuthFlowTest.php#L23-L28). The guarantee is unexercised. | **Security gap** | Medium | High | **P1** | Two-app integration test (§19.1) |
| **SEC-DEP-03** | Deployment | `tools/live/templates/setup.php` is a token-gated schema installer intended for the document root. `hash_equals` is used correctly, but a forgotten `SETUP_TOKEN` leaves a live installer. | **Existing protection — harden** | High *(if left)* | Low | **P1** | Go-live checklist: blank the token **and** delete the file |
| **SEC-DEP-04** | Deployment | `frontend/out/`, `live/`, `.next/` and `node_modules/` exist in the tree; `live/LIVE.zip` is a full deployable archive that no `.htaccess` rule mentions. | **Cannot verify** the server | High | Low | **P1** | Deployment-artefact probe (§19.7) + archive deny patterns |
| **SEC-DEP-08** | Ops | `/ready` checks only database + cache. It does not check `APP_DEBUG`, `MAIL_DRIVER`, `SESSION_SECRET` length or the `APP_URL` scheme — despite [`LogMailer.php:15`](backend/src/Integration/Mail/LogMailer.php#L15) claiming a `mail.driver` warning exists there. | **Security gap** | Medium | High | **P1** | Add production self-checks to `/ready` (§20.1) |
| **SEC-DEP-09** | Dependencies | Both frontends have committed lockfiles; the backend has zero runtime dependencies. No automated vulnerability scanning is configured anywhere. | **Existing protection — harden** | Medium | Medium | **P1** | `npm audit` as check #5 in `tools/audit.mjs` (§18) |
| **SEC-DB-01** | Database | One MySQL account with cPanel "ALL PRIVILEGES", shared by both apps and by migrations. | **Existing protection — harden** | Medium | Low | **P2** | Three roles (§17.5 / §23) |
| **SEC-ACC-02** | Account | Login lockout is keyed on `(email, audience)`, so 20 deliberate failures lock a known user out for 15 minutes. An availability attack on any named account, staff included. | **Existing protection — harden** — [`AuthService.php:135`](backend/src/Service/Auth/AuthService.php#L135) | Medium | Medium | **P2** | Add an IP dimension; clear the counter on a correct password |
| **SEC-ACC-03** | Account | `findActiveByTokenHash()` does not check `users.status`. Setting a **staff** account to `BLOCKED` does not end its sessions or deny new logins. | **Security gap** — [`SessionRepository.php:22-36`](backend/src/Repository/SessionRepository.php#L22-L36) | Medium | Low | **P2** | Deny staff auth on non-active status; revoke sessions on block |
| **SEC-ACC-04** | Account | No notification on new sign-in, password change, session revocation, or wallet movement. | **Security gap** | Medium | Medium | **P2** | Mail on the four credential events |
| **SEC-ACC-05** | Account | A password change revokes every *other* session but does not rotate the current session token. | **Existing protection — harden** | Low | Low | **P2** | Re-issue the caller's own token on password change |
| **SEC-ACC-06** | Account | Registration and reset require 6 characters; `POST /me/password` requires 8. A shopper can register a password they cannot later re-set to. | **Existing protection — harden** — [`auth.php:29`](backend/config/routes/auth.php#L29) vs [`me.php:59`](backend/config/routes/me.php#L59) | Low | Low | **P2** | Align customer minimums at 8; existing passwords keep working |
| **SEC-REF-01** | Refunds | `refundedTotal()` is read without a lock before `insertRefund()`. Two concurrent refund creations with *different* idempotency keys can jointly exceed the payment. | **Existing protection — harden** — [`Console/PaymentController.php:191`](iced-out-crm/backend/src/Controller/Console/PaymentController.php#L191) | Medium | Low | **P2** | Transaction + `SELECT ... FOR UPDATE` on the payment row |
| **SEC-REF-02** | Refunds | Refunds are bookkeeping only — no gateway call. `transitionRefund` moves a status a human must mirror in the Razorpay dashboard, so the ledger and the gateway can silently diverge. | **Existing protection — harden** | Medium | Medium | **P2** | Reconcile from `refund.processed` webhooks; flag divergence in `ops_signals` |
| **SEC-CRM-01** | CRM | No step-up authentication for refunds, wallet adjustments, store settings or payout marking. A 15-minute idle staff session suffices for every privileged action. | **Security gap** | Medium | Medium | **P2** | Password confirmation on the privileged set (§17.2) |
| **SEC-LOG-02** | Logging | `Audit` runs only where `route->audit` is true, which defaults to *staff mutations only*. Customer login/logout, password change, session revoke, wallet movement and order placement produce no audit row. | **Existing protection — harden** — [`Route.php:59`](backend/src/Kernel/Route.php#L59) | Medium | Medium | **P2** | Opt specific customer routes into `audit: true` |
| **SEC-UPL-02** | Uploads | All media is public by unguessable id. Customer profile photos are capability URLs — 64 bits of entropy, but no authorisation. | **Existing protection — harden** — [`media.php:20-27`](backend/config/routes/media.php#L20-L27) | Low | Low | **P2** | `media_assets.visibility` column; private assets require an owning principal |
| **SEC-UPL-03** | Uploads | `PUT /me/photo` declares no `rate_limit`, so it falls to `default` (240/min/IP). Every upload decodes and re-encodes an image. | **Existing protection — harden** — [`me.php:56`](backend/config/routes/me.php#L56) | Low | Medium | **P2** | Give it a dedicated `uploads` class |
| **SEC-DEP-05** | Deployment | `next.config.ts` cannot set headers for a static export, so **every** browser security header depends on one `.htaccess`. A reduced `AllowOverride` removes them all at once. | **Existing protection — harden** | Medium | Low | **P2** | Duplicate critical headers on API responses; monitor from outside |
| **SEC-DEP-06** | Transport | The https redirect passes when `X-Forwarded-Proto: https` is present, which is client-settable if no proxy strips it. | **Existing protection — harden** — [`live/.htaccess`](live/.htaccess) | Low | Low | **P2** | Drop the `X-Forwarded-*` conditions unless a proxy genuinely sits in front |
| **SEC-DEP-07** | Deployment | `storage/logs` has no rotation or retention. Under the flat layout it grows unbounded inside the document root. | **Security gap** | Low | Medium | **P2** | Retention in the sweep command |
| **SEC-OPS-01** | Ops | Nothing purges `user_sessions`, `auth_tokens`, `idempotency_keys` or `storage/cache`. `purgeExpired()` exists on two repositories and is called from nowhere. | **Security gap** | Low | Medium | **P2** | Fold into the same `sweep` command as SEC-INV-01 |
| **SEC-ENV-01** | Secrets | `Env::load()` layers `$_SERVER` over the `.env` file, so any server-injected variable overrides a secret. Not reachable from an HTTP header under mod_php/PHP-FPM (headers arrive `HTTP_`-prefixed). | **Cannot verify** the live SAPI | Low | Low | **P3** | Allowlist the keys merged from `$_SERVER`; **MANUAL VERIFICATION REQUIRED** |
| **SEC-API-04** | Rate limiting | `REMOTE_ADDR` is correct and un-spoofable, but if Cloudflare or a cPanel reverse proxy is ever placed in front, every client collapses to one IP and all IP buckets become global. | **Cannot verify** | Medium | Low | **P3** | Opt-in `TRUSTED_PROXIES` allowlist; never trust XFF by default |
| **SEC-API-05** | API | Login CSRF: `/auth/login` and `/admin/auth/login` are `AUDIENCE_PUBLIC`, so `OriginCheck` does not apply (no principal yet). A cross-site POST can sign a victim into an attacker's account. | **Security gap** | Low | Low | **P3** | Apply `OriginCheck` to public mutation routes flagged `origin_checked` |
| **SEC-CRM-02** | CRM | The CRM is role-scoped, not record-scoped: any staff member with `crm.view` sees every contact, company and deal. | **Accepted design** — [`permissions.php:66-70`](backend/config/permissions.php#L66-L70) | Low | Low | **P3** | Revisit only if the CRM gains external or partner users |
| **SEC-INF-01** | Infrastructure | No WAF, no centralised log retention off the web host, no SIEM. | **Not present** | Low | Low | **P3** | VPS/Nginx path (§14.5) |

---

## 6. Payment Security Plan

This is the core of the plan. **The user journey does not change.** The shopper sees the same
payment options, the same Razorpay frame, the same order-placed screen. What changes is *who
decides* that money moved.

### 6.1 The current flow, and precisely where it breaks

```
 1  browser   POST /checkout/payments/razorpay/order  { amount: <CLIENT> }   ← SEC-PAY-03
 2  server    Razorpay createOrder(amount)  →  order_XXXX
 3  browser   Razorpay Checkout opens                                        ← SEC-PAY-04 if step 1 failed
 4  browser   handler(razorpay_payment_id, razorpay_order_id, razorpay_signature)
 5  browser   POST /checkout/payments/razorpay/verify   →  { verified: true }
 6  server    hash_equals(...)  ✓   ...and then FORGETS IT                   ← SEC-PAY-02
 7  browser   POST /checkout/orders { payment: { outcome: "captured", … } }
 8  server    writes payments(status='Captured', gateway='Razorpay')          ← SEC-PAY-01
             on the strength of the word "captured" in a JSON body.
```

Step 7 is reachable with `curl` and a valid `io_csess` cookie. Steps 1–6 are optional.

### 6.2 The target flow

Same shape, one new server-side record in the middle. Everything the browser sends stays exactly as
it is — the request and response contracts are unchanged — but the server stops believing it.

```
 1  browser  POST /checkout/payments/razorpay/order   { amount, receipt, notes }
 2  server   ── price the CURRENT bag server-side (the same code path as place-order)
             ── ignore the client's `amount`; use the server figure
             ── Razorpay createOrder(server_amount)
             ── INSERT payment_intents (razorpay_order_id, user_id, amount_paise,
                                        quote_hash, status='CREATED', expires_at)
             └─ respond { id, amount, currency, key_id }        ← IDENTICAL response shape

 3  browser  Razorpay Checkout opens with order_id
 4  browser  handler(...)

 5  browser  POST /checkout/payments/razorpay/verify  { orderId, paymentId, signature }
 6  server   ── hash_equals(...)                                  (already correct)
             ── fetchPayment(paymentId) — confirm status=captured AND the amount matches
             ── UPDATE payment_intents SET status='VERIFIED', razorpay_payment_id=?
                WHERE razorpay_order_id=? AND user_id=? AND status='CREATED'
             └─ respond { verified, status, amount, method }     ← IDENTICAL response shape

 7  browser  POST /checkout/orders  { …, payment: { … } }        ← IDENTICAL request shape
 8  server   ── recompute the total (unchanged)
             ── SELECT … FROM payment_intents
                WHERE user_id=? AND status='VERIFIED' AND expires_at > NOW()
                FOR UPDATE
             ── require amount_paise == (total − wallet_applied)
             ── outcome := 'captured'   ONLY because that row exists
             ── UPDATE payment_intents SET status='CONSUMED', order_id=?
             └─ write payments(reference = razorpay_payment_id FROM THE ROW)
```

The client's `payment.outcome`, `payment.reference` and `payment.method` fields are still accepted
(contract preserved) — they simply stop being trusted. `method` is validated against an allowlist.

### 6.3 Server authority — what the browser may never decide

| Value | Today | After |
| --- | --- | --- |
| Product price | **Server** ✓ ([`PlaceOrderService.php:107`](backend/src/Service/Checkout/PlaceOrderService.php#L107)) | unchanged |
| Discount / coupon | **Server** ✓ (`discountFor()`) | unchanged |
| Delivery fee | **Server** ✓ (`deliveryFee()`) | unchanged |
| Order total | **Server** ✓ | unchanged |
| Wallet deduction | **Server** ✓ (clamped + row-locked) | unchanged |
| **Gateway amount charged** | **Client** ✗ | **Server** — from the priced quote |
| **Payment succeeded?** | **Client** ✗ | **Server** — from `payment_intents.status` |
| **Payment reference** | **Client** ✗ | **Server** — from the verified intent row |
| **Payment method label** | **Client** ✗ | Allowlisted, else `'Unknown'` |
| Refund amount | **Server** ✓ | unchanged + locked (SEC-REF-01) |

### 6.4 The `payment_intents` table (new migration `0031_payment_intents.sql`)

Additive only — nothing existing is altered.

```sql
CREATE TABLE payment_intents (
    id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    razorpay_order_id   VARCHAR(64)  NOT NULL,
    razorpay_payment_id VARCHAR(64)  NULL,
    user_id             BIGINT UNSIGNED NOT NULL,
    amount_paise        BIGINT UNSIGNED NOT NULL,
    currency            CHAR(3)      NOT NULL DEFAULT 'INR',
    quote_hash          CHAR(64)     NOT NULL,   -- sha256 of the priced bag
    status              VARCHAR(16)  NOT NULL DEFAULT 'CREATED',
                                                 -- CREATED | VERIFIED | CONSUMED | FAILED | EXPIRED
    order_id            BIGINT UNSIGNED NULL,
    verified_at         DATETIME(6)  NULL,
    consumed_at         DATETIME(6)  NULL,
    expires_at          DATETIME(6)  NOT NULL,
    created_at          DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_payment_intents_order   (razorpay_order_id),
    UNIQUE KEY uq_payment_intents_payment (razorpay_payment_id),
    KEY ix_payment_intents_user (user_id, status, expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE={{collation}};
```

`uq_payment_intents_payment` is the **replay guard**: one `razorpay_payment_id` can back exactly one
order, forever. `status='CONSUMED'` under `FOR UPDATE` is the **double-spend guard**. `expires_at`
(15 minutes) bounds how long a verified payment can sit unused.

**Compatibility note:** this DDL avoids both constructs the project has already been bitten by on
MySQL 8 vs MariaDB — there is no `CHECK` constraint and no functional index — and it uses the
existing `{{collation}}` placeholder the migration runner substitutes.

### 6.5 Razorpay webhook (SEC-PAY-06)

Uses the **existing** `webhook_inbox` table (`0005_orders_payments.sql:205`) and the **existing**
`RazorpayGateway::verifyWebhook()`. No second event architecture is introduced.

**Route** — one new row in [`backend/config/routes/checkout.php`](backend/config/routes/checkout.php):

```php
[
    'method'     => 'POST',
    'path'       => '/webhooks/razorpay',
    'handler'    => [RazorpayWebhookController::class, 'receive'],
    'audience'   => Route::AUDIENCE_PUBLIC,   // Razorpay presents no cookie
    'rate_limit' => 'webhooks',               // the class already exists, unused
    'name'       => 'webhooks.razorpay',
],
```

**Endpoint file:** `backend/api/webhooks/razorpay.php` → `Endpoint::serve('webhooks.razorpay')`.

**Required properties, each mapped to an existing mechanism:**

| Requirement | How |
| --- | --- |
| HTTPS only | `.htaccess` forces https before the API is excluded |
| Raw-body signature | `$request->rawBody` — the pipeline never mutates it |
| Constant-time comparison | `verifyWebhook()` — already `hash_equals` |
| Secret | `RAZORPAY_WEBHOOK_SECRET` — already in `config/app.php` |
| Deduplication | `webhook_inbox` `UNIQUE (provider, event_id)` on `x-razorpay-event-id` |
| Replay protection | Insert first; a duplicate insert ⇒ 200 with no processing |
| Persistent storage | `webhook_inbox.payload`, `signature_ok`, `processed_at` |
| Idempotent processing | The `payment_intents` state machine; `CONSUMED` is terminal |
| Event ordering | Process by `payment_intents.status`, never by arrival order |
| Unknown events | Stored with `processed_at = NULL`, logged, **200** returned |
| Failed processing | The row stays unprocessed; the sweep command retries |
| Bad signature | Stored with `signature_ok = 0`, **400** returned, `ops_signals` raised |

**Events, phase 1:** `payment.captured`, `payment.failed`, `order.paid`.
**Phase 2:** `refund.processed`, `refund.failed` (closes SEC-REF-02).

**Critical rule:** the webhook may promote an intent `CREATED → VERIFIED`, and may mark an
already-`CONSUMED` order's payment as reconciled. It may **never create an order** — order creation
stays exclusively in `PlaceOrderService`, driven by the shopper's own request. This keeps the
existing business logic intact and avoids a second order-creation path.

**MANUAL VERIFICATION REQUIRED:** the webhook URL and secret must be registered in the Razorpay
dashboard. That is a console action, not a code change.

### 6.6 Blocking the degraded live path (SEC-PAY-04, SEC-PAY-05)

The principle from the brief, implemented at the layer that actually enforces it:

```
LIVE PAYMENT  →  API unavailable  →  no intent row  →  place-order sees no VERIFIED intent
              →  outcome = 'failed'  →  order written as "Payment failed"
              →  NO paid status · NO wallet spend · NO fulfilment
```

Because §6.2 makes the server derive the outcome, **the degraded path is closed by construction** —
even a modified frontend cannot claim payment. Two frontend changes remain, for honesty rather than
for security:

1. `checkout-flow.tsx` should treat `result.verified === false` as a failure when the key is
   `rzp_live_*`, so the shopper is told immediately rather than after the server refuses.
2. The `card` method (`payWithCard`, `CardPaymentSheet`) must not be offered when
   `isTestKey() === false`. The server independently rejects `method` values outside the allowlist.

**Compatibility:** in Razorpay **test** mode both keep working exactly as today, so local and
staging development is unaffected. The gate is `razorpayKeyId().startsWith("rzp_live")`.

### 6.7 Duplicate-prevention matrix

| Scenario | Guard |
| --- | --- |
| Double-tap on Pay | `Idempotency` middleware + the SEC-IDMP-01 fix |
| Two concurrent place-order calls | In-flight idempotency row ⇒ 409 retryable |
| The same payment id on two orders | `uq_payment_intents_payment` |
| Verify called twice | `UPDATE … WHERE status='CREATED'` affects 0 rows the second time |
| Webhook delivered twice | `uq_webhook_inbox_event` |
| Webhook arrives before place-order | The intent goes `VERIFIED`; place-order consumes it normally |
| Webhook arrives after place-order | The intent is already `CONSUMED`; the webhook records reconciliation only |
| Order placed, payment never made | No `VERIFIED` intent ⇒ `outcome='failed'`; the stock reservation expires (SEC-INV-01 sweeper) |
| Wallet + gateway on one order | The wallet debit is `(kind='order', reference=order_number)` unique; the gateway amount is `total − wallet_applied` and must equal `payment_intents.amount_paise` |

---

## 7. Wallet Security Plan

### 7.1 What is already correct — do not rebuild it

[`WalletService`](backend/src/Service/Wallet/WalletService.php) is the strongest financial code in
the repository, and the brief's "secure conceptual flow" is **already implemented**:

| Requirement | Status | Evidence |
| --- | --- | --- |
| BEGIN TRANSACTION | ✓ | `$this->db->transaction(...)` in both `credit()` and `debit()` |
| Lock the wallet account | ✓ | `SELECT id, balance … FOR UPDATE` after an upsert, so a first-time wallet cannot race |
| Recalculate the balance under the lock | ✓ | `Money::fromDecimalString($account['balance'])` read inside the lock |
| Validate the amount / reject insufficient | ✓ | `isGreaterThan($balance)` ⇒ `ICE-WAL-409`, **refuses rather than clamps** |
| Immutable ledger entry | ✓ | `wallet_entries` is insert-only; `balance_after` on every row |
| Atomic apply | ✓ | Entry insert and `wallet_accounts.balance` update in one transaction |
| Idempotency | ✓ | `UNIQUE (kind, reference)` — replaying a return credits once |
| No client-supplied balance | ✓ | The balance is never read from a request anywhere |
| Nested-transaction safety | ✓ | Savepoints ([`Database.php:136`](backend/src/Kernel/Database.php#L136)) — the debit cannot commit if the order write fails |
| No withdrawal path | ✓ | Deliberate; keeps it clear of payment-instrument regulation |

**Verdict: already secure — no redesign required.** Double-spend, negative balance, race conditions
and replay are all closed.

### 7.2 The three gaps

**SEC-WAL-01 (P1) — cancellation destroys credit.**
[`OrderConsoleService::cancel()`](iced-out-crm/backend/src/Service/Order/OrderConsoleService.php#L88)
releases stock, cancels shipments and writes history — and never touches the wallet, even though the
order carries `wallet_applied`. `WalletService::reverseOrder()` was written for exactly this and is
called from nowhere in either backend.

*Fix:* inside the existing cancel transaction, after `releaseReservationsForOrder`:

```php
$applied = Money::fromDecimalString((string) $order['wallet_applied']);
if ($applied->paise > 0 && $order['user_id'] !== null) {
    $this->wallet->reverseOrder(
        (int) $order['user_id'], $applied, (string) $order['number'],
        sprintf('Returned when %s was cancelled.', $order['number']),
    );
}
```

`KIND_REVERSAL` keeps its own idempotency key, so cancelling twice credits once. **No API contract
changes; no new endpoint.**

**SEC-WAL-02 (P2) — no wallet audit trail outside the ledger itself.**
`wallet_entries` records *what* moved. There is no `audit_logs` row saying *who* triggered it, from
which IP, under which request id. Covered by SEC-LOG-02.

**SEC-WAL-03 (P2) — no admin adjustment endpoint, and that is currently a strength.**
`KIND_ADJUSTMENT` exists in the enum and `WalletPresenter` renders it, but **no route can create
one**. Balances move only through returns, vouchers, orders and reversals. *Recommendation:* if an
adjustment endpoint is ever added it must be `permission => 'refunds.approve'`, `idempotent`,
step-up authenticated (§17.2) and audited. Until then this is the safest possible state and should
be left alone.

### 7.3 Wallet + Razorpay composition

The design is already correct and must be preserved: store credit is a **payment**, not a discount
([`PlaceOrderService.php:186-210`](backend/src/Service/Checkout/PlaceOrderService.php#L186-L210)).
`total` stays the order's value; credit reduces `gatewayAmount`. The single new invariant §6 adds:

```
payment_intents.amount_paise  ==  (total − wallet_applied).paise
```

checked under the intent's row lock inside the place-order transaction. This is what stops a shopper
from obtaining a ₹5 000 Razorpay intent and then applying ₹5 000 of wallet credit as well.

Also preserved: a **failed** payment spends no credit
([`PlaceOrderService.php:206`](backend/src/Service/Checkout/PlaceOrderService.php#L206)) — correct,
because the retry needs that money.

---

## 8. Authentication and Session Security Plan

### 8.1 Cookie hardening

| Attribute | Today | Verdict |
| --- | --- | --- |
| `HttpOnly` | Always | ✓ Already secure |
| `SameSite` | `Lax` | ✓ Correct — `Strict` would break the return-from-Razorpay navigation |
| `Secure` | **Only when `APP_URL` starts `https://`** | ⚠ Config-derived. Correct on a correct server; silently absent otherwise — SEC-DEP-02 |
| `Path` | `/api/v1` | ✓ Better than `/` — the static tree never sees the cookie |
| `Domain` | not set (host-only) | ✓ Correct — **do not add one** |
| `Max-Age` | customer only, 30 d; staff is a browser-session cookie | ✓ Correct |
| `__Host-` prefix | not used | **Not recommended** — `__Host-` mandates `Path=/`, which would be a *loss* here |

*Action (P0/P1):* keep the derivation but **fail loudly**. `APP_ENV=production` with a non-`https://`
`APP_URL` must be reported unhealthy by `/ready` (SEC-DEP-08).

### 8.2 Session lifecycle — verified

| Property | Status |
| --- | --- |
| Token entropy | `bin2hex(random_bytes(32))` — 256 bits ✓ |
| Storage | `hash_hmac('sha256', $token, SESSION_SECRET, true)` into `BINARY(32)`; the raw token is never stored ✓ |
| Session fixation | A new token is minted on every login; no client-supplied id is ever accepted ✓ |
| Idle expiry | Staff 15 min, slid on each request ✓ |
| Absolute expiry | Staff 12 h; customer 30 d ✓ |
| Logout | `revoked_at` set, and the lookup filters on it ✓ |
| Revoke others | On password change ✓ and via `/me/sessions/revoke-others` ✓ |
| Password reset | Revokes **all** sessions ✓ |
| Session listing/revocation IDOR | Ownership verified by listing the caller's own sessions first ✓ |
| Current-session rotation on password change | ✗ SEC-ACC-05 (P2) |

### 8.3 Cross-audience isolation

Isolation is enforced at three independent layers, all verified:

1. `Authenticate` refuses when `X-Client-Audience` ≠ `route->audience`
   ([`Authenticate.php:44`](backend/src/Middleware/Authenticate.php#L44)).
2. `SessionManager::resolve()` reads a **different cookie name** per audience.
3. `SessionRepository::findActiveByTokenHash()` filters on `s.audience`, and `resolveToken()` then
   cross-checks `users.type` against the expected `CUSTOMER`/`STAFF`
   ([`SessionManager.php:130-135`](backend/src/Service/Auth/SessionManager.php#L130-L135)).

**The guarantee holds. The test does not exist** (SEC-TEST-01) — see §19.1 for the restoration plan.
**Do not change the token model.** Nothing found requires it.

### 8.4 Password security

Argon2id / bcrypt-12, peppered, `password_needs_rehash` on login, timing-safe unknown-account path.
All correct. One inconsistency to align (SEC-ACC-06) — customer minimums of 6 at registration/reset
versus 8 at change. Raising registration and reset to 8 leaves existing 6-character passwords
working; the rule applies to new passwords only.

### 8.5 Account-takeover pivot (SEC-ACC-01)

`PATCH /me` accepts a new `email`, checks uniqueness and writes it — with no password confirmation,
no verification of the new address and no notice to the old one
([`ProfileController.php:68-77`](backend/src/Controller/Customer/ProfileController.php#L68-L77)).
Chained with `/auth/password/forgot`, a temporarily hijacked session becomes permanent ownership.

*Minimal fix (P1):* when `email` is present in the payload, require a `currentPassword` field.
Because the rule set is per-route and additive, this is confined to `config/routes/me.php` and
`ProfileController::update()`. Notify the **previous** address. Full double-opt-in verification is
**P2**.

---

## 9. Authorization and IDOR Protection Plan

### 9.1 Result of the IDOR/BOLA sweep

Every parameterised customer route was read. **No IDOR was found.**

| Probe from the brief | Finding |
| --- | --- |
| `/me/orders/{id}` | `WHERE (public_id = ? OR number = ?) AND user_id = ?` — **scoped** ✓ |
| `/me/sessions/{id}` | The id is matched against `listForUser($principal->userId, …)` before revoking; a foreign id 404s — **scoped** ✓ |
| `/me/addresses/{id}` (PATCH / DELETE / default) | `findAddress($principal->userId, $publicId)` first, then every repository call also takes `userId` — **doubly scoped** ✓ |
| `/me/returns`, `/me/reviews`, `/me/support` | Byline and ownership come from the principal, never the body ✓ |
| `/media/{id}` | Public by design; ids carry 64 bits of entropy. **No authorisation** — SEC-UPL-02 (P2) |
| `/admin/orders/{id}` and every console route | `Authorize` runs **before** the controller, so the permission check precedes any data access ✓ |
| CRM contact / company / deal ids | Guarded by `crm.view` / `crm.manage` only. **No per-owner scoping inside the CRM** — SEC-CRM-02 |

### 9.2 The CRM authorisation model — an accepted design, documented

The CRM is **role-scoped, not record-scoped**. `SUPPORT` holds `crm.view`/`crm.manage` and can
therefore read and edit every contact, company and deal, not merely their own. The permission file
says as much and explains why ([`permissions.php:66-70`](backend/config/permissions.php#L66-L70)).

*Assessment:* a defensible choice for a team of this size, and **it should not be changed** as part
of a security programme. It becomes a finding only if the CRM ever gains external or partner users.
Recorded as SEC-CRM-02 (P3) with a trigger condition rather than a task.

### 9.3 Wildcard permission handling

`ADMIN => ['*']` is resolved in `Principal::can()`
([`Principal.php:47`](backend/src/Domain/Principal.php#L47)):

```php
return in_array($permission, $this->permissions, true) || in_array('*', $this->permissions, true);
```

Safe: `'*'` is a literal sentinel, never a pattern match, so no permission code can accidentally
glob. Permissions are resolved **per request** from `user_roles → role_permissions` and are never
cached in the cookie, so revoking a role takes effect on the next request. **Already secure.**

*The consequence to accept:* an `ADMIN` compromise is total and there is no separation of duty for
financial actions. Step-up authentication (§17.2) is the partial mitigation.

### 9.4 Frontend route protection is not security — confirmed

Both frontends are static exports with client-side guards. The guard in the CRM shell hides screens;
it does not protect data. This is **correct as implemented**, because every screen fetches from an
API that enforces `audience` + `permission` server-side, so a bypassed guard shows empty screens
rather than data. No change required — recorded so nobody later mistakes the client guard for the
control.

---

## 10. API Security Plan

### 10.1 Middleware-by-middleware assessment

| Stage | Protects against | Still possible | Order verdict |
| --- | --- | --- | --- |
| `RequestId` | Log-correlation gaps; header injection (UUID-validated) | — | ✓ correct first |
| `SecurityHeaders` | Sniffing, framing, mixed content | HTML pages get none of this (static export) — SEC-HDR-01 | ✓ above the error handler, so failures still carry headers |
| `Cors` | Credentialed cross-origin reads | An over-wide list if `CORS_ALLOWED_ORIGINS` is misused — SEC-CORS-01 | ✓ |
| `HandleErrors` | Trace / SQL / path disclosure | — | ✓ deliberately *inside* the pipeline |
| `Maintenance` | — | — | ✓ |
| `ResolveRoute` | — | **Throws 404/405 before rate limiting** — SEC-API-01 | ✗ *see below* |
| `BodyLimit` | Oversized JSON/multipart | PHP's own `post_max_size` is the real gate; this is a second check after the body is read | ✓ acceptable |
| `RateLimitByIp` | Credential stuffing, gateway abuse, mail flooding | Unknown-path scanning; fails open on cache failure — SEC-API-02 | ⚠ |
| `Authenticate` | Cross-audience replay; **cross-site form POSTs** | — | ✓ |
| `OriginCheck` | CSRF on cookie-authenticated mutations | Public mutations such as login — SEC-API-05 | ✓ correctly *after* `Authenticate` |
| `RateLimitByPrincipal` | Authenticated abuse | Not applied to `/checkout/orders` — SEC-API-03 | ✓ |
| `Authorize` | Privilege escalation | — | ✓ **before** any controller or data access |
| `Validate` | Type confusion, oversized fields | Bodies with no `rules` (e.g. `/checkout/orders`) are shape-checked in the service instead | ✓ |
| `Idempotency` | Double-submit | Concurrent duplicates — SEC-IDMP-01 | ✓ |
| `Audit` | Repudiation | Customer-side events uncovered — SEC-LOG-02 | ✓ |

**Bypass check:** none found. `Endpoint::serve()` reuses `Application::handle()` and therefore the
whole pipeline ([`Endpoint.php:70`](backend/src/Kernel/Endpoint.php#L70)), so the file-per-endpoint
layout does not create a second, unguarded door.

**Public routes do not accidentally skip protection.** They skip *authentication* by design;
`SecurityHeaders`, `BodyLimit`, `RateLimitByIp` and `Validate` all still apply. The one real
consequence is that `OriginCheck` does not fire for them (SEC-API-05, P3).

**The one ordering issue (SEC-API-01).** Moving `RateLimitByIp` above `ResolveRoute` would break
per-route limit classes. The recommended fix keeps the order and adds a **coarse pre-route bucket**
inside `ResolveRoute`'s catch path: when `Router::match()` throws, consume one token from
`rl:ip:unmatched:<ip>` (e.g. 60/min) before rethrowing. Minimal, additive, no reordering.

### 10.2 Client-controlled headers — trust audit

| Header | Trusted for | Verdict |
| --- | --- | --- |
| `X-Client-Audience` | Selecting which audience to resolve | ✓ **Safe** — it can only ever *narrow* access; a mismatch is a 403 and a match still requires the right cookie |
| `X-Request-Id` | Correlation only; UUID-validated | ✓ Safe |
| `X-Client-Timezone`, `Accept-Language` | Nothing security-relevant | ✓ Safe |
| `Idempotency-Key` | Replay key, hashed, scoped to `audience:publicId` | ✓ Safe — cannot collide across users |
| `Origin` / `Referer` | The CSRF decision | ✓ Safe — exact-match allowlist; absence of both is a refusal |
| `X-Forwarded-For` / `X-Real-IP` | **Nothing** | ✓ Safe — never read (SEC-API-04 is a deployment caveat, not a code flaw) |
| `Content-Length` | The body-limit check, combined with `max()` against the real length | ✓ Safe |
| `Content-Type` | Choosing JSON vs multipart parsing | ✓ Safe |
| `User-Agent` | Stored on the session row, truncated to 255 | ✓ Safe — rendered by React, never as HTML |

**No security decision trusts a client-controlled header incorrectly.**

### 10.3 Risk-based rate-limit plan

All values are `config/app.php` entries; the only code changes are the new `checkout` class, the
`unmatched` bucket, and fail-closed behaviour.

| Class | Routes | Current | Proposed | Why |
| --- | --- | --- | --- | --- |
| `auth` | login, register, staff login | 10/60 s IP | **10/60 s IP + 5/60 s per-email** | Password spraying across many accounts from one IP is currently bounded only by the IP bucket |
| `password_forgot` | forgot | 5/3600 s IP | keep | Already the tightest bucket ✓ |
| `password_otp` | verify, reset | 30/3600 s IP | keep | The per-code attempt cap is the real guard ✓ |
| **`checkout`** *(new)* | `POST /checkout/orders` | *falls to `default` 240/60 s* | **10/60 s, scope `both`** | Order creation reserves stock — SEC-API-03 / SEC-INV-01 |
| `payments` | razorpay order/verify, wallet redeem | 20/60 s principal | **add an IP dimension (`both`)** | Abuse before a principal exists is otherwise unbounded |
| `catalog` | products, media, config, reviews | 120/60 s IP | keep | ✓ |
| `cart` | draft save | 30/60 s principal | keep | ✓ |
| `contact` | support queries | 5/3600 s both | keep | ✓ |
| **`uploads`** *(new)* | `PUT /me/photo`, `POST /admin/media` | *default / console_write* | **10/3600 s principal** | Each upload decodes and re-encodes an image — SEC-UPL-03 |
| `console_read` / `console_write` | CRM | 300 / 60 per minute, principal | keep | ✓ |
| `exports` | payments / analytics export | 5/3600 s principal | keep | ✓ |
| `webhooks` | Razorpay webhook | 1000/60 s IP | keep | Razorpay retries in bursts ✓ |
| **`unmatched`** *(new)* | any 404/405 | *none* | **60/60 s IP** | SEC-API-01 |

**Infrastructure constraint honoured:** everything above works with the existing `FileCacheStore`;
Redis stays optional and the `job_queue` fallback is untouched. The only change to the store is
**failing closed** for the `auth`, `payments` and `checkout` classes (SEC-API-02) — for `catalog`
and friends, failing open remains the right trade.

### 10.4 CORS and Origin

Verified: no `Access-Control-Allow-Origin: *`, no origin reflection, `Vary: Origin` present,
credentials only for exact allowlist matches
([`Cors.php:33-52`](backend/src/Middleware/Cors.php#L33-L52)).

**The one change (SEC-CORS-01):** split the two lists that are currently one.

```ini
# Production storefront .env
APP_URL=https://iced-out.node2begin.com
CORS_ALLOWED_ORIGINS=            # empty — production is same-origin, no preflight ever fires
TRUSTED_ORIGINS=                 # empty ⇒ falls back to APP_URL alone

# Production CRM .env
APP_URL=https://crm.iced-out.node2begin.com
CORS_ALLOWED_ORIGINS=
TRUSTED_ORIGINS=
```

`OriginCheck::trustedOrigins()` reads `TRUSTED_ORIGINS` when set and falls back to today's behaviour
(`CORS_ALLOWED_ORIGINS` + `APP_URL`) when it is not — so **existing deployments and every dev
machine keep working unchanged**. The storefront origin must **never** appear in the CRM's trusted
list, or a compromised storefront page could drive console mutations.

Preview deployments: give each its own `APP_URL`; do not add preview hosts to production's lists.

---

## 11. Frontend Security Plan

### 11.1 XSS — assessed, and the answer is good

A sweep for `dangerouslySetInnerHTML`, `innerHTML`, `document.write`, `eval`, `new Function` and
`DOMParser` across both frontends returned **exactly one hit**:
[`layout.tsx:102`](frontend/src/app/layout.tsx#L102), whose content is the compile-time constant
`PERFORMANCE_MODE_BOOTSTRAP` — a device-capability probe with no interpolation.

Taking the brief's list one at a time:

| Can this execute JavaScript? | Answer |
| --- | --- |
| CMS content | **No** — rendered as React children |
| Product data | **No** |
| Reviews | **No** — and the byline comes from the account, not the body |
| Support messages | **No** |
| CRM notes | **No** |
| Error messages | **No** — `error-normalizer.ts` produces strings rendered as text |
| URL parameters | **No** — read via `useSearchParams`, rendered as text or used as fetch parameters |

**Verdict: already secure. Do not add a sanitizer.** A DOMPurify dependency would add supply-chain
surface to defend a sink that does not exist. *The correct control is a guardrail, not a library:*
the ESLint rule `react/no-danger` with a single documented exception, plus a `tools/audit.mjs` check
that fails the build if a second `dangerouslySetInnerHTML` ever appears. **P2.**

### 11.2 localStorage

Fifteen files in the storefront and thirteen in the CRM use `localStorage`: the cart, the wishlist,
the address-book cache, the checkout draft and UI preferences. Two specific checks:

* [`auth-context.tsx:27`](frontend/src/features/20-auth-security/auth-context.tsx#L27) documents
  that the session flag *used to be* a `localStorage` `"1"` and no longer is — the session is now
  the `HttpOnly` cookie. ✓
* [`wallet-context.tsx:34`](frontend/src/features/21-wallet/wallet-context.tsx#L34) states
  explicitly that the balance is **not persisted**. ✓

**No token, no session, no balance, and no PII beyond the shopper's own delivery draft is stored.**
Already secure. For the record: everything in `localStorage` is attacker-writable, so any value read
back must be treated as untrusted — which it is, since the server re-derives price, stock, coupon
and address on every order.

### 11.3 Public environment variables

`NEXT_PUBLIC_API_BASE_URL` and `NEXT_PUBLIC_RAZORPAY_KEY_ID` are the only `NEXT_PUBLIC_*` values in
either app. Both are public by nature — the API path and the Razorpay **key id**, which appears in
the page source of every Razorpay checkout in existence. **No secret is inlined into a bundle.**
Add a go-live check that greps the built `frontend/out/` for the key *secret* pattern anyway (§24).

### 11.4 Frontend actions arising from §6

| Change | Type | Compatibility |
| --- | --- | --- |
| Treat `verified === false` as a failure on live keys | Hardening | None — test mode unaffected |
| Hide the `card` method when the key is `rzp_live_*` | Removal of a development affordance | The option disappears from the live UI; COD and Razorpay unchanged |
| Keep sending `payment.outcome` | **No change** | Preserves the request contract while the server stops trusting it |

---

## 12. Database Security Plan

### 12.1 Injection — verified clean

* `PDO::ATTR_EMULATE_PREPARES => false` — real server-side prepares, so no charset-based escape
  bypass ([`Database.php:46`](backend/src/Kernel/Database.php#L46)).
* `PDO::ATTR_ERRMODE => ERRMODE_EXCEPTION`, `STRINGIFY_FETCHES => false`,
  `sql_mode = STRICT_ALL_TABLES,NO_ENGINE_SUBSTITUTION`.
* Every `select` / `statement` / `insert` takes a bindings array.

**Dynamic SQL audit** — every interpolation site was read:

| Site | Source of the interpolated value | Verdict |
| --- | --- | --- |
| [`IdAllocator.php:114`](backend/src/Support/IdAllocator.php#L114) | `self::SOURCES` const map | ✓ whitelisted |
| [`Crm/ActivityRepository.php:52`](iced-out-crm/backend/src/Repository/Crm/ActivityRepository.php#L52) | `self::SUBJECT_TABLES` const map, `isset()`-guarded | ✓ whitelisted |
| `Crm/CrmIds.php:55` | const spec map | ✓ whitelisted |
| [`WalletService.php:87`](backend/src/Service/Wallet/WalletService.php#L87) | `max(1, min(500, $limit))` — integer | ✓ bounded |
| `Crm/ContactRepository.php:222,264`, `MaterialRepository.php:200` | the same clamp pattern | ✓ bounded |
| `CatalogRepository.php:349` | `$limit` from `queryInt()` | ✓ integer-cast |
| `SchemaExporter.php:119` | table names from `information_schema`, backtick-quoted | ✓ CLI only |

**No ORDER BY, filter, search, import, report or export path interpolates request data.**
Verdict: **already secure — no action required.** The one guardrail worth adding is a
`tools/audit.mjs` grep that fails if a `$` ever appears inside a SQL string outside this known set.
(P2.)

### 12.2 Transactions and locking

| Operation | Lock | Verdict |
| --- | --- | --- |
| Place order | `users FOR UPDATE`, `variant_inventory FOR UPDATE` in ascending id order, wallet account `FOR UPDATE` | ✓ |
| Wallet credit / debit | account row `FOR UPDATE` + `(kind, reference)` unique | ✓ |
| Stock confirm / release / adjust | `variant_inventory` / `stock_items FOR UPDATE` | ✓ |
| Nested service calls | savepoints | ✓ |
| **Refund creation** | **none** — read-then-insert | ✗ SEC-REF-01 (P2) |
| **Idempotency** | **none** — read-then-insert | ✗ SEC-IDMP-01 (P1) |
| **Payment-intent consumption** | *does not exist yet* | to be added with `FOR UPDATE` (§6) |

**Do not add locks anywhere else.** The read paths are correctly lock-free.

---

## 13. File Upload Security Plan

### 13.1 Current protections — verified by reading, not assumed

| Control | Evidence |
| --- | --- |
| MIME sniffed via `getimagesize()`, never taken from the request | [`MediaService.php:87`](backend/src/Service/Media/MediaService.php#L87) |
| Allowlist is `image/jpeg`, `image/png`, `image/webp` **only** | `ENCODERS` const |
| Full re-encode through GD — strips EXIF, comments, appended payloads | [`MediaService.php:200-207`](backend/src/Service/Media/MediaService.php#L200-L207) |
| Extension derived from the sniffed type, never the filename | `ENCODERS[$mime]['ext']` |
| Storage key `Y/m/<32 hex>.<ext>` — 128 bits random | [`MediaService.php:184`](backend/src/Service/Media/MediaService.php#L184) |
| Public id `med-` + 64 bits random | [`MediaService.php:215`](backend/src/Service/Media/MediaService.php#L215) |
| Byte cap from settings (`media.max_bytes_console` / `_customer`) | `store_settings` |
| Max edge 1600 px, downscaled | `media.max_edge` |
| Served only through `GET /media/{id}` with a server-chosen `Content-Type` and `nosniff` | [`MediaController.php:61-66`](backend/src/Controller/System/MediaController.php#L61-L66) |
| Upload requires `media.upload` (CRM) or an authenticated customer (profile photo) | route tables |

### 13.2 Risks from the brief, assessed

| Risk | Verdict |
| --- | --- |
| **SVG uploads** | **Not possible** — SVG is absent from `ENCODERS`, so `assertStorable()` refuses it. The "SVG script payload" class does not apply here. |
| **Polyglot files** | **Neutralised** — the file is decoded and re-encoded; only GD's output reaches disk. A GIFAR or JPEG-with-PHP survives neither the sniff nor the re-encode. |
| **Fake MIME** | **Neutralised** — the request's `Content-Type` is never consulted. |
| **Filename attacks** | **Neutralised** — the original filename is discarded entirely. |
| **Content-Disposition** | `inline` with a server-chosen type and `nosniff`. Safe for the three allowed types. |
| **Decompression / image bombs** | **OPEN — SEC-UPL-01 (P1).** `getimagesize()` already returns width and height at line 87 and they are never checked before `imagecreatefromstring()` at line 159. A 30 000 × 30 000 PNG within the 8 MB byte cap needs roughly 3.6 GB of RAM and will OOM the PHP worker. |
| **GIF handling** | Not accepted; no GIF-frame amplification path. |
| **Extremely large dimensions** | Same as image bombs — SEC-UPL-01. |
| **Cache headers** | `public, max-age=31536000, immutable` — correct for a content-addressed random id, but it means a *revoked* private asset would stay in caches. Relevant only once SEC-UPL-02 is implemented. |
| **Authorization for private media** | **OPEN — SEC-UPL-02 (P2).** All media is public; profile photos are capability URLs. |
| **Media enumeration** | **Not feasible** — 64 bits of entropy. |
| **Upload rate abuse** | Console uploads use `console_write` (60/min); `PUT /me/photo` has no class and falls to `default` — SEC-UPL-03 (P2). |

### 13.3 Targeted hardening (SEC-UPL-01)

Between the sniff and the decode, in both `store()` and `storeBytes()`:

```php
$pixels = (int) $probe[0] * (int) $probe[1];
$maxPixels = $this->settings->int('media.max_pixels', 40_000_000);   // ~40 MP
if ($pixels > $maxPixels || (int) $probe[0] > 20000 || (int) $probe[1] > 20000) {
    throw ValidationException::field('file', 'That image is too large to process.', 'ICE-MEDIA-422');
}
```

**Additive, uses the existing settings mechanism, no contract change.** No legitimate product photo
approaches 40 MP — check the existing library first with a one-off `SELECT MAX(width*height) FROM
media_assets`. Because the cap is a setting, raising it needs no deploy.

---

## 14. Deployment Security Plan

### 14.1 The current situation, stated plainly

`PROJECT-STATUS.md §11` records the **flat** layout as what was deployed. In that layout the
document root contains `index.html`, `_next/` and `api/v1/` **and** `.env`, `config/`, `src/`,
`storage/`, `bin/`, `seeds/`, `migrations/`, `database/`, `autoload.php`.

The design calls for three independent `.htaccess` layers. **The bundle in this repository has only
two of them.** A directory scan of `live/` found `.htaccess` at the root and at `api/`, and **no
per-directory `.htaccess`** in `config/`, `src/`, `storage/`, `migrations/`, `seeds/`, `database/`,
`bin/` or `_next/` — although the correct files *do* exist under `live/site/backup/`, which suggests
the deployed copy may be a different, older build.

It also contains, in that same directory: `database/iced_out.sql` (full schema and data),
`storage/logs/app-*.log` (which contain `mail.sent` entries with password-reset codes), `LIVE.zip`,
and a `.env` whose values are the **development** ones.

### 14.2 What happens if `.htaccess` stops being read

| Path | Layer 1 (root) | Layer 2 (per-dir) | Layer 3 (dot-file) | Outcome if layer 1 is lost |
| --- | --- | --- | --- | --- |
| `/.env` | ✓ | n/a | ✓ | Layer 3 lives *in the same file* — **exposed** |
| `/config/database.php` | ✓ | **missing in `live/`** | — | **DB credentials exposed** if PHP does not execute it (a `.bak` or editor swap file would not) |
| `/storage/logs/app-2026-09-02.log` | ✓ | **missing in `live/`** | — | **Password-reset codes exposed** |
| `/database/iced_out.sql` | ✓ | **missing in `live/`** | — | **Whole database exposed** |
| `/migrations/*.sql` | ✓ | **missing in `live/`** | — | Schema exposed |
| `/LIVE.zip` | ✗ *not in the deny list at all* | — | — | **Entire deployment archive downloadable, `.env` included** |
| `/src/**.php` | ✓ | **missing** | — | Source readable only if PHP is disabled; otherwise executed as an empty script |

The critical realisation: **layers 1 and 3 live in the same file.** The design argues this is safe
because losing that file also 404s every page — a loud failure. That argument is sound for
`AllowOverride None`, but it does **not** cover a partial failure (a syntax error in a later
`<IfModule>` block, a host that ignores `<FilesMatch>`, or LiteSpeed rewriting semantics), and it
does not cover `LIVE.zip`, which no rule mentions.

### 14.3 Option A — Immediate hardening (keeps the flat layout)

**Do this first, this week.** No layout change, no downtime.

| # | Action | Effect |
| --- | --- | --- |
| A1 | **Verify the live `.env`:** `APP_ENV=production`, `APP_DEBUG=false`, `APP_URL=https://iced-out.node2begin.com`, `MAIL_DRIVER=smtp`, `SESSION_SECRET` 64 hex and unique, `CORS_ALLOWED_ORIGINS` empty | Closes SEC-DEP-02; restores `Secure` cookies, HSTS and a working `OriginCheck` |
| A2 | `chmod 600 .env` | Blocks other cPanel accounts on a shared host |
| A3 | **Delete from the document root:** `LIVE.zip`, `database/*.sql`, `seeds/demo/`, `README.md`, `composer.json`, `phpunit.xml`, `phpstan.neon`, `tests/` | What is not there cannot leak |
| A4 | **Restore layer 2** — copy `htaccess-private` into every one of `config/ src/ storage/ bin/ seeds/ migrations/ database/` | The single largest risk reduction available without moving anything |
| A5 | Add `*.zip`, `*.tar.gz`, `*.sql`, `*.log`, `*.bak`, `*.swp`, `*.orig` to the layer-1 deny rules **and** to the build's deny-list assertion | Closes the archive gap permanently |
| A6 | Confirm `.git/` was never uploaded | Source and history disclosure |
| A7 | Blank `SETUP_TOKEN` **and delete `setup.php`** | Removes a live schema installer (SEC-DEP-03) |
| A8 | Delete `diagnose.php` if present | Removes an environment-disclosure surface |
| A9 | Empty `storage/logs/` of anything written while `MAIL_DRIVER=log` | Historic OTPs (SEC-LOG-01) |
| A10 | Enable HSTS once A1 confirms https end to end | SEC-HDR-02 |
| A11 | Remove the `X-Forwarded-Proto` / `X-Forwarded-SSL` conditions from the https redirect unless a proxy genuinely sits in front | Removes a client-controlled bypass (SEC-DEP-06) |

**Effort:** ~2 hours. **Compatibility:** none of A1–A11 changes application behaviour, provided A1's
values are correct — and if they are not, the site is *already* misbehaving.
**Rollback:** keep timestamped copies of `.htaccess` and `.env`.
**Risk if skipped:** credential and full-database disclosure from a single `.htaccess` failure.

### 14.4 Option B — Recommended production deployment (`split`)

`tools/live/build-live.mjs --layout=split` already produces this. It is the **recommended target**.

```
/home/<cpaneluser>/
├── public_html/            ← document root
│   ├── index.html  _next/  … the static export
│   └── api/v1/             ← only the thin endpoint files
└── iced-out-api/           ← ABOVE the document root; no URL maps here
    ├── .env  config/  src/  migrations/  seeds/  bin/  storage/  autoload.php
```

* **Security benefit:** `.env`, logs, migrations, seeds and source are **outside the web root**. No
  `.htaccess` failure, `AllowOverride` change or LiteSpeed quirk can expose them, because no URL
  resolves there. This eliminates SEC-DEP-01 *structurally* rather than defensively.
* **Implementation effort:** ~1 hour, mostly file moves. `api/v1/_backend.php` already walks up
  looking for `autoload.php` + `config/app.php` and finds either shape, so **no code changes**.
* **Compatibility:** none. Same URLs, routes, cookies, database.
* **Hosting requirement:** the ability to place a directory beside `public_html` — standard on
  cPanel.
* **Migration risk:** low. The one thing to get right is `MEDIA_ROOT`, which must resolve to the
  same directory before and after or every product photo 404s. Do it behind `APP_MAINTENANCE=true`
  and verify `/api/v1/ready` plus one `/media/{id}` before reopening.

**Recommendation: schedule Option B for Phase 4, and do Option A now.** Do not wait for B.

### 14.5 Option C — Future VPS / Nginx

* **Security benefit:** root access enables a real WAF (ModSecurity/CRS), per-service system users,
  MySQL bound to localhost with separate accounts (§17.5 becomes trivially enforceable), fail2ban on
  the API log, `open_basedir`, a read-only application filesystem, systemd timers for the sweep
  jobs, and real log shipping.
* **Effort:** 1–2 weeks including migration and DNS.
* **Compatibility:** the backend README already documents equivalent Nginx `location` blocks, and
  both frontends are static — the application does not change.
* **Hosting requirement:** a VPS and someone to operate it. **That is the real cost**, and it is why
  this is P3 rather than P1.
* **Migration risk:** moderate — TLS, cron, mail deliverability, and the database dump/restore.

---

## 15. Secrets and Environment Security Plan

### 15.1 Inventory

| Secret | Where it lives | Reaches the frontend? | Verdict |
| --- | --- | --- | --- |
| `SESSION_SECRET` | both `.env` files, byte-identical | No | ⚠ dual-purpose — SEC-SEC-01 |
| `DB_PASS` | both `.env` files, same account | No | ⚠ shared — SEC-DB-01 |
| `RAZORPAY_KEY_ID` | `.env` → `GET /config/storefront` | **Yes, by design** | ✓ public by design |
| `RAZORPAY_KEY_SECRET` | `.env`, read only by `RazorpayGateway` | No | ✓ verified never in a response body |
| `RAZORPAY_WEBHOOK_SECRET` | `.env` | No | ✓ configured, currently unused |
| `SMTP_PASS` | `.env` | No | ✓ |
| `ITHINK_ACCESS_TOKEN` / `ITHINK_SECRET_KEY` | `.env`; travel in the request **body** by iThink's design | No | ✓ correctly treated as passwords |
| `REMOVE_BG_API_KEY` | `.env` | No | ✓ |
| `SETUP_TOKEN` | `.env` (split template) | No | ⚠ must be blanked at go-live — SEC-DEP-03 |
| `VERCEL_OIDC_TOKEN` | `frontend/.vercel/` (local, gitignored) | n/a | ✓ not part of the cPanel deployment |

`git ls-files` confirms **no `.env` is tracked** — only `.env.example` files, which carry blank
values. ✓

### 15.2 SEC-SEC-01 — the rotation trap, and the fix

Today one value does three jobs:

```
SESSION_SECRET ──▶ hash_hmac('sha256', $token,    SESSION_SECRET)          session token at rest
               ──▶ hash_hmac('sha256', $password, 'pwd:'.SESSION_SECRET)   password pepper
               ──▶ must be IDENTICAL in the storefront and the CRM
```

Consequences as it stands:

* Rotating it signs out every user **and makes every stored password hash unverifiable** — every
  customer and every staff member would have to use the reset flow.
* It must be copied by hand between two `.env` files; a mismatch silently invalidates the other
  half's sessions.
* An incident that leaks it therefore has **no cheap containment** — precisely when you most need
  one.

**Recommended change (P1), backward compatible:**

```php
// New: Iced\Support\Secrets
public function derive(string $purpose, ?int $version = null): string
{
    $version ??= $this->config->int('app.session.secret_version', 1);
    $root = $this->config->string('app.session.secret');

    return hash_hmac('sha256', $purpose . ':v' . $version, $root, true);
}
```

* `SessionManager::hash()` uses `derive('session')`.
* `PasswordHasher::pepper()` uses `derive('password', $versionStoredWithTheHash)`.
* Add a nullable `users.pepper_version TINYINT UNSIGNED NULL`. `NULL` means "the legacy
  `'pwd:'.$secret` form", **so every existing hash keeps verifying with no migration**. New and
  rehashed passwords get the current version.
* `SESSION_SECRET_VERSION` selects the current version; an optional `SESSION_SECRET_PREVIOUS` lets
  session verification accept one older key during a rotation window.

**Result:** the session key can be rotated in a maintenance window without touching passwords, and
the password pepper can be rotated lazily as users log in. **Compatibility impact: none** — with the
new keys unset, behaviour is byte-identical to today.

### 15.3 Environment separation and logging redaction

* **Separate secrets per environment.** The build mints a fresh `SESSION_SECRET` per deployment and
  never overwrites an existing `.env`. The rule to write down: **a development `SESSION_SECRET` must
  never appear on the live host**, since it is also the password pepper — a leaked dev secret would
  make production hashes attackable.
* **Never log secrets (SEC-LOG-01).** `Logger::write()` currently JSON-encodes whatever context it
  is given. Add recursive key-based redaction:

  ```php
  private const REDACT = ['password','passwd','secret','token','code','signature',
                          'authorization','cookie','key_secret','db_pass','otp','body'];
  ```
* **Refuse `MAIL_DRIVER=log` in production.** `LogMailer` writes the whole recovery email including
  the OTP. `Application::boot()` should log `mail.misconfigured` at error level, and `/ready` should
  report unhealthy when `APP_ENV=production` and the log driver is bound.
* **Never return secrets through the API.** Verified: no controller emits `key_secret`, `DB_PASS`,
  `SMTP_PASS` or `SESSION_SECRET`. `GET /config/storefront` emits `razorpay_key_id` only. ✓
* **Rotation runbook.** Document, for each secret: who can rotate it, where it must be updated (one
  or both `.env` files), and what breaks. `SESSION_SECRET` is the only one with a hard dependency
  between the two applications.

---

## 16. Security Headers and Browser Protection

### 16.1 Current state

| Header | API (`SecurityHeaders`) | HTML pages (`live/.htaccess`) |
| --- | --- | --- |
| `X-Content-Type-Options` | `nosniff` ✓ | `nosniff` ✓ |
| `X-Frame-Options` | `DENY` ✓ | `SAMEORIGIN` ✓ |
| `Referrer-Policy` | `strict-origin-when-cross-origin` ✓ | same ✓ |
| `Content-Security-Policy` | `default-src 'none'; frame-ancestors 'none'` ✓ *(ideal for a JSON API)* | **absent** ✗ |
| `Strict-Transport-Security` | only when `APP_URL` is https | **commented out** ✗ |
| `Permissions-Policy` | absent | absent ✗ |
| `Cross-Origin-Opener-Policy` | absent | absent |
| `Cross-Origin-Resource-Policy` | absent | absent |
| `Cache-Control` | `no-store` by default; `immutable` for media ✓ | `must-revalidate` for HTML ✓ |

**The API's headers are already correct and need no change.** Everything below concerns the HTML
pages, which — because both frontends are `output: "export"` — **cannot** be served headers from
`next.config.ts`. `.htaccess` is the only lever.

### 16.2 The origins that must be allowed (derived from code, not guessed)

| Origin | Why | Evidence |
| --- | --- | --- |
| `'self'` | The export's own JS/CSS/images | — |
| `https://checkout.razorpay.com` | The gateway SDK `<script>` | [`razorpay.ts:29`](frontend/src/features/09-payment/razorpay.ts#L29) |
| `https://api.razorpay.com` | SDK XHR during checkout | Razorpay documented behaviour |
| `https://*.razorpay.com` (frame/img) | The checkout iframe and per-method subdomains | Razorpay documented behaviour |
| `https://lumberjack.razorpay.com` | Razorpay telemetry beacon | Razorpay documented behaviour |
| `data:` (img, font) | Inline data URIs used by the design system | grep of `src/styles` and components |
| **Self-hosted fonts** | `@fontsource-variable/*` and `@fontsource/roboto-mono` are npm packages bundled into `_next/static` | [`package.json`](frontend/package.json) |

**Notable:** there is **no Google Fonts link, no analytics script and no third-party tag** in either
frontend. The only external origin in the whole storefront is Razorpay. That makes a tight CSP
genuinely achievable.

**The one complication:** [`layout.tsx:102`](frontend/src/app/layout.tsx#L102) injects an inline
`<script>`. A static export cannot generate a per-request nonce, so the CSP must carry that script's
**SHA-256 hash** — and the hash changes whenever `PERFORMANCE_MODE_BOOTSTRAP` changes. It must
therefore be computed by `tools/live/build-live.mjs` and written into the generated `.htaccess`,
otherwise a future edit to the bootstrap would silently break every page.

### 16.3 Three-phase rollout

**Phase 1 — Report-Only (1 week).** No enforcement, no risk of breaking checkout.

```apache
Header always set Content-Security-Policy-Report-Only "default-src 'self'; \
  script-src 'self' 'sha256-<BOOTSTRAP_HASH>' https://checkout.razorpay.com; \
  style-src 'self' 'unsafe-inline'; \
  img-src 'self' data: blob: https://*.razorpay.com; \
  font-src 'self' data:; \
  connect-src 'self' https://api.razorpay.com https://lumberjack.razorpay.com; \
  frame-src https://api.razorpay.com https://*.razorpay.com; \
  form-action 'self' https://*.razorpay.com; \
  base-uri 'none'; object-src 'none'; frame-ancestors 'self'"
```

Collect violations across home, product, cart, **a full test-mode Razorpay checkout**, account and
orders. Adjust.

*Justification for the one wildcard:* `https://*.razorpay.com` in `img-src`/`frame-src` is
unavoidable — Razorpay routes checkout through per-method and per-bank subdomains that cannot be
enumerated in advance. It is scoped to a single vendor's domain and never appears in `script-src`.

*Justification for `'unsafe-inline'` in `style-src`:* Tailwind v4 and `motion` emit inline styles at
runtime, and a static export cannot hash them. `style-src 'unsafe-inline'` without
`script-src 'unsafe-inline'` does not enable script execution.

**Phase 2 — Enforce on the storefront.** Swap `-Report-Only` for the enforcing header after a clean
week. Add:

```apache
Header always set Permissions-Policy "camera=(), microphone=(), geolocation=(), \
  payment=(self \"https://checkout.razorpay.com\"), interest-cohort=()"
Header always set Cross-Origin-Opener-Policy "same-origin-allow-popups"
Header always set Strict-Transport-Security "max-age=31536000; includeSubDomains"
```

`same-origin-allow-popups`, not `same-origin` — Razorpay opens popups for some methods.
**Do not add `preload`** until the CRM subdomain is live and https (P3).

**Phase 3 — CRM.** The CRM has no Razorpay surface, so it gets a genuinely strict policy:
`default-src 'self'; script-src 'self' '<hash>'; frame-ancestors 'none'; connect-src 'self'`.

### 16.4 Development safety

The dev server serves no `.htaccess` and is unaffected. The CSP exists only in the generated
production `.htaccess`, so local development, Playwright runs against `next dev`, and
`tools/audit.mjs` all behave exactly as today.

---

## 17. CRM / Admin Security Plan

**Context: the CRM is not yet deployed.** That makes this the cheapest possible moment to fix it —
everything here is a pre-launch requirement rather than a change to a running system.

### 17.1 Current console posture

| Control | Status |
| --- | --- |
| Staff sessions: browser-session cookie, 15-min sliding idle, 12-h absolute | ✓ Already secure |
| Permission checked before the controller | ✓ `Authorize` sits above dispatch |
| Permissions resolved per request from the database | ✓ Revocation is immediate |
| Every console mutation audited by default | ✓ `Route::fromArray()` defaults `audit` to true for staff mutations |
| Exports on their own tight bucket (5/hour) and their own permission (`payments.exports.create`) | ✓ |
| Staff password minimum 12 characters | ✓ |
| **No staff-management routes at all** — no role assignment, no staff creation | ✓ Role changes are DB-only, so a large attack surface simply does not exist |
| **No wallet-adjustment route** | ✓ See §7.2 |
| Step-up authentication | ✗ SEC-CRM-01 |
| MFA | ✗ P2 |
| `status = BLOCKED` ends a staff session | ✗ SEC-ACC-03 |
| Record-level scoping inside the CRM | ✗ SEC-CRM-02 — accepted design |

### 17.2 Operations that warrant step-up (SEC-CRM-01, P2)

Not a redesign of authentication — a **password confirmation** on a short list of actions, using the
existing `PasswordHasher` and a new nullable `user_sessions.stepped_up_at` column.

| Operation | Route | Why |
| --- | --- | --- |
| Approve a refund | `POST /admin/refunds/{id}/transition` | Moves real money |
| Create a refund | `POST /admin/refunds` | Moves real money |
| Mark a payout paid | `POST /admin/payouts/{id}/mark-paid` | Financial finality |
| Change store settings | `PUT /admin/settings/store` | Owns session TTLs, lockout thresholds, media caps, vocabularies |
| Wallet adjustment | *(if ever added)* | Mints money |
| Bulk export | `POST /admin/analytics/export`, `GET /admin/payments/export` | Bulk PII egress |

**Mechanism:** a `POST /admin/auth/step-up` route takes the current password and stamps
`stepped_up_at`. A new `RequireStepUp` middleware — appended **after** `Authorize`, so it never runs
for unauthorised callers — refuses with `ICE-AUTH-428` when `stepped_up_at` is null or older than
10 minutes. Routes opt in with `'step_up' => true`; **every route without the flag behaves exactly
as today.**

*Compatibility:* the CRM frontend must handle one new error code with a password prompt. Since the
CRM is not deployed, no operator workflow is disrupted.

### 17.3 MFA roadmap (P2 → P3)

TOTP for `ADMIN` and `MANAGER`, enrolment optional at first and mandatory before the CRM is exposed
to the public internet. It needs one table (`user_mfa_secrets`), one dependency-free TOTP
implementation (~60 lines with `hash_hmac`, preserving the zero-dependency posture), and one extra
step in `AuthController::login`.

**Do not build this before the P0 payment work.** If the CRM ships before MFA exists, compensate
with (a) step-up per §17.2, (b) an IP allowlist for `/admin/auth/login` in `.htaccess` if the team
works from fixed locations, and (c) alerting on staff logins from new IPs (§20.2).

### 17.4 SEC-ACC-03 — blocking a staff account must actually block it

`findActiveByTokenHash()` selects `u.status` but never filters on it, and `resolveToken()` never
checks it. For customers this is **deliberate and correct** — a `BLOCKED` shopper still
authenticates so support can see their account, and the block bites at checkout
([`PlaceOrderService.php:97`](backend/src/Service/Checkout/PlaceOrderService.php#L97)). For staff
there is no equivalent gate anywhere.

*Fix (P2):* in `SessionManager::resolveToken()`, when `$audience === AUDIENCE_STAFF` and the user's
status is not active, return `null`. Additionally revoke all staff sessions when a staff account is
blocked. **Customer behaviour is untouched.**

### 17.5 Database privilege separation (SEC-DB-01, P2)

**Ideal architecture**

| Role | Grants |
| --- | --- |
| `storefront_db_user` | `SELECT` on the catalogue and settings; `SELECT/INSERT/UPDATE` on `orders`, `order_items`, `payments`, `payment_intents`, `wallet_*`, `inventory_*`, `users`, `user_sessions`, `addresses`, `reviews`, `support_queries`, `returns`, `idempotency_keys`, `webhook_inbox`. **No `DROP`, no `ALTER`.** No access to `crm_*`, `audit_logs`, `staff_activity_logs`. |
| `crm_db_user` | Operational read/write across the console's tables including `crm_*` and `audit_logs`. **No `DROP`, no `ALTER`.** |
| `migration_db_user` | DDL only — used by `php bin/console.php migrate`, never by a web request. |

**Compatible implementation on cPanel:** create three MySQL users in cPanel → MySQL Databases, grant
each against the one database, and point each `.env`'s `DB_USER`/`DB_PASS` at the right one.
`config/database.php` already reads those from the environment, so **no code change is required**.

**Hosting limitations to be honest about:**

* cPanel's UI offers coarse privilege checkboxes; per-table grants usually need phpMyAdmin or the
  `GRANT` statement, and cPanel may not preserve them across account operations.
* The storefront needs `users` write access (registration, profile, password) and `user_sessions`
  write access, so it *will* hold write access to the same `users` table that holds staff rows.
  Separating that would need a schema split, which §2 rules out. The mitigation is a `WHERE type =
  'CUSTOMER'` discipline that already exists in `UserRepository`, not a grant.
* Therefore the realistic benefit is: **removing DDL from the web-facing accounts, and removing CRM
  table access from the storefront account.** Both are worth having; neither is a containment
  boundary against `SESSION_SECRET` disclosure.

**Risk level:** medium benefit, low implementation risk, **zero application change**. Recommended,
but after the P0/P1 work. Verify with a smoke run of `tools/audit.mjs` check 3 (every GET route runs
against the database) under the restricted user before switching production over.

---

## 18. Dependency Security Plan

### 18.1 Backend

`composer.json` requires **only** `php >= 8.2` and five bundled extensions. `require-dev` has PHPStan
and PHPUnit, neither deployed. **There is no PHP supply-chain surface in production.** This is a
significant, deliberate strength and should be protected: adding a Composer runtime dependency
should be an architectural decision, not a convenience.

*Action (P2):* a `tools/audit.mjs` check that fails if `composer.json`'s `require` block gains a
non-`ext-` entry without a recorded decision.

### 18.2 Frontend

Both apps have committed `package-lock.json` files (lockfile integrity ✓). Notable dependencies:
`next ^16.3.0`, `react 19.2.8` (pinned exactly ✓), `axios ^1.13.0`, `motion`, `radix-ui`, `lenis`,
`aos`.

**Do not blindly upgrade.** The process to adopt:

1. `npm audit --omit=dev --audit-level=high` in both frontends, wired into `tools/audit.mjs` as a
   **fifth check** alongside the existing four (contract, schema, endpoints, build). Fail on
   `high`/`critical` in production dependencies; report only for dev dependencies.
2. `npm audit signatures` for provenance.
3. Triage by *reachability*, not by score. Most advisories in a static-export app that makes no
   server-side requests are unreachable — an SSRF in a build tool cannot be triggered by a shopper.
4. Prioritise: (a) anything in `axios`, which handles every API response; (b) anything in Next's
   runtime chunks; (c) `aos` — unmaintained since 2019 and used on public pages. Consider replacing
   it with the `motion` primitives already present (**P2**).
5. Pin `next` and `react-dom` to exact versions, matching how `react` is already pinned, so a
   `^`-range cannot change what ships between two builds of the same commit.

### 18.3 Update cadence

| Item | Cadence |
| --- | --- |
| `npm audit` in `tools/audit.mjs` | Every run |
| Manual dependency review | Monthly |
| Next.js minor/patch | Within 30 days |
| Critical advisory in a production dependency | Within 72 hours |
| PHP point release on the host | Whatever cPanel offers, tracked quarterly |

---

## 19. Security Testing Plan

Extends the existing harness — `tools/audit.mjs`, PHPUnit `tests/Contract` + `tests/Unit`, the
Playwright suite in `frontend/e2e`, and the smoke scripts. **Nothing is replaced.**

All tests below are safe for unattended execution: they run against the local development database
and the Razorpay **test** key, and none of them sends money.

### 19.1 Authentication

| Test name | Attack scenario | Expected behaviour | Location | Priority |
| --- | --- | --- | --- | --- |
| `customerCookieIsRefusedByTheConsoleApi` | `io_csess` replayed against `/admin/*` with `X-Client-Audience: admin` | 403 before any DB lookup | **new** `iced-out-crm/backend/tests/Integration/CrossAudienceTest.php` | **P1** |
| `staffCookieIsRefusedByTheStorefrontApi` | `io_ssess` replayed against `/me` | 401 | same | **P1** |
| `staffTokenValueInTheCustomerCookieResolvesToNothing` | The raw staff token placed in `io_csess` | 401 — separate token spaces | same | **P1** |
| `expiredStaffSessionIsRefused` | Idle beyond 15 minutes | 401 | `StaffAuthFlowTest` | P1 |
| `revokedSessionIsRefusedImmediately` | Revoke, then reuse | 401 | `AuthFlowTest` | P1 |
| `loginIssuesANewTokenEveryTime` | Session fixation | Tokens differ | `AuthFlowTest` | P1 |
| `passwordChangeRevokesEveryOtherSession` | A stolen session persists after a password change | Other sessions 401 | `AuthFlowTest` | P1 |
| `passwordResetRevokesAllSessions` | The same, via OTP | All 401 | `AuthFlowTest` | P1 |
| `passwordResetCodeIsBurnedAfterFiveWrongGuesses` | Brute-forcing six digits | Code destroyed; a new one required | `AuthFlowTest` | P1 |
| `unknownEmailAndWrongPasswordAreIndistinguishable` | Enumeration | Identical body **and** comparable timing | exists ✓ — extend with timing | P2 |
| `blockedStaffAccountCannotAuthenticate` | SEC-ACC-03 | 401 | `StaffAuthFlowTest` | P2 |

**`CrossAudienceTest` is the restoration of the test lost in the split.** It cannot live in either
app alone. Implementation: boot **both** `Application` instances in one PHPUnit process —
`Application::boot(<repo>/backend)` and `Application::boot(<repo>/iced-out-crm/backend)` — and hand
the cookie minted by one to the other. Both apps already support in-process `handle()`
(`PipelineTest` does exactly this), so no new infrastructure is needed. Place it in the CRM
backend's tree, which has both paths available, and `markTestSkipped` when the storefront directory
is absent.

### 19.2 Authorization

| Test name | Attack scenario | Expected | Location | Priority |
| --- | --- | --- | --- | --- |
| `orderOfAnotherCustomerIs404` | `GET /me/orders/{other}` | 404, not 403 — no existence oracle | **new** `backend/tests/Contract/OwnershipTest.php` | P1 |
| `sessionOfAnotherCustomerCannotBeRevoked` | `DELETE /me/sessions/{other}` | 404; the target stays active | same | P1 |
| `addressOfAnotherCustomerCannotBeEditedOrDeleted` | PATCH/DELETE a foreign id | 404 | same | P1 |
| `returnOfAnotherCustomerIsInvisible` | `GET /me/returns` | Only own rows | same | P1 |
| `roleWithoutPermissionIsRefused` | `SUPPORT` calls `POST /admin/refunds` | 403 | **new** CRM `tests/Contract/PermissionMatrixTest.php` | P1 |
| `everyStaffRouteDeclaresAPermission` | A new route ships ungated | Static assertion over the route table | same | **P1** — this catches the whole class |
| `adminWildcardGrantsEveryDeclaredCode` | `'*'` semantics | Every code in `permissions.php` passes `can()` | same | P2 |

### 19.3 Payment (the P0 suite)

| Test name | Attack scenario | Expected | Location | Priority |
| --- | --- | --- | --- | --- |
| `placeOrderWithClaimedCaptureAndNoIntentIsNotPaid` | `payment.outcome="captured"` via curl | Order written as **Payment failed**; no `Captured` row; no wallet spend | **new** `backend/tests/Contract/PaymentIntegrityTest.php` | **P0** |
| `gatewayOrderAmountIsServerPricedNotClientSupplied` | `amount: 1` for a ₹50 000 bag | The intent's amount equals the server total | same | **P0** |
| `orderIsRefusedWhenIntentAmountDiffersFromPayable` | Intent ₹100, order ₹5 000 | 409; nothing written | same | **P0** |
| `verifiedIntentCanBackExactlyOneOrder` | The same payment id on a second order | 409; `uq_payment_intents_payment` holds | same | **P0** |
| `forgedSignatureNeverVerifies` | A random 64-hex signature | `verified:false`; the intent stays `CREATED` | same | **P0** |
| `intentBelongingToAnotherCustomerCannotBeConsumed` | Cross-user intent | 409 | same | **P0** |
| `verifyIsIdempotentAndSingleShot` | Verify twice | The second affects 0 rows; the response is unchanged | same | P1 |
| `expiredIntentCannotBeConsumed` | `expires_at` in the past | 409 | same | P1 |
| `codOrderNeedsNoIntent` | Regression guard | COD still places normally | same | **P0** |
| `fullWalletOrderNeedsNoIntent` | Regression guard | Store-credit-only orders still place | same | **P0** |
| `webhookWithBadSignatureIsRejectedAndRecorded` | Tampered body | 400; `webhook_inbox.signature_ok = 0` | **new** `backend/tests/Contract/WebhookTest.php` | **P0** |
| `duplicateWebhookEventIsProcessedOnce` | The same `x-razorpay-event-id` twice | 200 both times; one row; one state change | same | **P0** |
| `webhookCannotCreateAnOrder` | `order.paid` for an unknown order | 200, logged, no order created | same | P1 |
| `apiUnavailableDuringLivePaymentPlacesNoPaidOrder` | The intent endpoint returns 503 | Checkout fails closed | **new** `frontend/e2e/checkout-payment.spec.ts` | **P0** |
| `cardMethodIsAbsentUnderALiveKey` | SEC-PAY-05 | The option is not rendered; the server rejects the method | same | **P0** |

### 19.4 Wallet

| Test name | Attack scenario | Expected | Location | Priority |
| --- | --- | --- | --- | --- |
| `concurrentRedemptionsCannotOverspend` | Two parallel orders, ₹500 balance, ₹500 each | One succeeds, one `ICE-WAL-409`; the balance never goes below 0 | **new** `backend/tests/Contract/WalletConcurrencyTest.php` | **P0** *(regression guard on already-correct code)* |
| `balanceNeverGoesNegative` | Fuzz of random credits and debits | Invariant holds; `SUM(entries)` reconciles with `balance` | same | P1 |
| `sameKindAndReferenceCreditsOnce` | Replay a return settlement | One entry | same | P1 |
| `duplicateIdempotencyKeyRedeemsOnce` | The same `Idempotency-Key` twice on `/me/wallet/redeem` | Replayed response; one voucher claim | same | P1 |
| `walletIsNotSpentWhenPaymentFailed` | `outcome=failed` | `wallet_applied = 0` | `PaymentIntegrityTest` | P1 |
| `cancellingAnOrderReturnsItsWalletCredit` | SEC-WAL-01 | A `KIND_REVERSAL` entry; the balance is restored | **new** CRM `tests/Contract/CancellationTest.php` | **P1** |
| `cancellingTwiceReversesOnce` | Idempotency of the reversal | One entry | same | P1 |

### 19.5 API

| Test name | Attack scenario | Expected | Location | Priority |
| --- | --- | --- | --- | --- |
| `authRateLimitReturns429WithRetryAfter` | 11 logins in 60 s | 429 + `Retry-After` | `PipelineTest` | P1 |
| `rateLimitFailsClosedForAuthWhenCacheIsUnwritable` | SEC-API-02 | 503, not unlimited | **new** `backend/tests/Contract/RateLimitTest.php` | P1 |
| `unmatchedPathsAreRateLimited` | SEC-API-01 | 429 after the bucket | same | P1 |
| `mutationFromAnUntrustedOriginIsRefused` | Origin spoofing | 403 | exists ✓ in `StaffAuthFlowTest` | ✓ |
| `mutationWithNoOriginAndNoRefererIsRefused` | Both headers stripped | 403 | `PipelineTest` | P1 |
| `corsDoesNotReflectAnArbitraryOrigin` | `Origin: https://evil.test` | No `Access-Control-Allow-Origin` in the response | `PipelineTest` | P1 |
| `oversizedJsonBodyIs413` | A 2 MB body | 413 | `PipelineTest` | P2 |
| `invalidJsonIs400NotAStackTrace` | `{"a":` | `ICE-REQ-400` | exists ✓ | ✓ |
| `productionErrorsCarryNoTraceOrSql` | Force a `PDOException` | `ICE-SYS-500` plus `request_id` only | `PipelineTest` | P1 |
| `malformedRequestIdIsReplacedNotEchoed` | Header injection attempt | A server-minted UUID | `PipelineTest` | P2 |

### 19.6 Uploads

| Test name | Attack scenario | Expected | Location | Priority |
| --- | --- | --- | --- | --- |
| `fakeMimeIsRefused` | PHP bytes named `.jpg` | `ICE-MEDIA-422` | **new** `backend/tests/Contract/MediaUploadTest.php` | P1 |
| `svgIsRefused` | An SVG containing `<script>` | `ICE-MEDIA-422` | same | P1 |
| `polyglotJpegLosesItsPayload` | A JPEG with appended PHP | The stored bytes contain no payload | same | P1 |
| `imageBombIsRefusedBeforeDecode` | SEC-UPL-01 | `ICE-MEDIA-422`; memory stays flat | same | **P1** |
| `exifIsStripped` | A GPS-tagged JPEG | No EXIF in the stored file | same | P2 |
| `storedFileIsServedWithNosniffAndTheSniffedType` | — | Correct headers | same | P2 |

### 19.7 Deployment

A new `tools/deploy-probe.mjs`, runnable against any environment including production (read-only,
GET requests only).

| Test name | Attack scenario | Expected | Priority |
| --- | --- | --- | --- |
| `envIsNotFetchable` | `GET /.env` | 403/404, and the body must not contain `DB_PASS` | **P0** |
| `gitIsNotFetchable` | `GET /.git/HEAD`, `/.git/config` | 403/404 | **P0** |
| `sqlDumpsAreNotFetchable` | `/database/iced_out.sql`, `/migrations/0001_platform_identity.sql` | 403/404 | **P0** |
| `logsAreNotFetchable` | `/storage/logs/app-2026-09-02.log` | 403/404 | **P0** |
| `archivesAreNotFetchable` | `/LIVE.zip`, `/backup.tar.gz` | 403/404 | **P0** |
| `configIsNotFetchable` | `/config/database.php`, `/config/app.php` | 403/404 and no `DB_PASS` in the body | **P0** |
| `sourceIsNotFetchable` | `/src/Kernel/Database.php`, `/autoload.php` | 403/404 | **P0** |
| `seedsAreNotFetchable` | `/seeds/data/...` | 403/404 | P1 |
| `installerIsGone` | `/setup.php`, `/diagnose.php` | 404 | **P0** |
| `httpRedirectsToHttps` | An `http://` request | 301 to https | P1 |
| `hstsIsPresent` | — | Header present with `max-age >= 31536000` | P1 |
| `directoryListingIsOff` | `/images/`, `/_next/` | No index page | P1 |
| `apiSetsSecureCookies` | Login over https | `Secure; HttpOnly; SameSite=Lax; Path=/api/v1` | **P0** |
| `debugIsOff` | Force a 500 | No trace and no filesystem path in the body | **P0** |

---

## 20. Production Monitoring Plan

Uses the existing `ops_signals`, `audit_logs`, `staff_activity_logs` and `activity_feed` tables. No
new infrastructure.

### 20.1 Minimum viable (ship with Phase 1)

Five signals, written to `ops_signals`, surfaced on the CRM dashboard and mailed daily.

| Signal | Trigger | Why |
| --- | --- | --- |
| `payment.signature_failed` | Any `verify` returning `verified:false` | The clearest single indicator of payment tampering. Should be ~0/day. |
| `webhook.signature_failed` | `webhook_inbox.signature_ok = 0` | Someone is posting to the webhook URL who is not Razorpay |
| `payment.intent_mismatch` | Place-order refused because the intent amount ≠ payable | Direct evidence of an amount-tampering attempt |
| `auth.lockout` | A lockout fires | Credential stuffing, or a targeted lockout DoS |
| `system.error_rate` | More than 20 `ICE-SYS-500` in 5 minutes | Broad breakage, including an attack causing crashes |

**Also (SEC-DEP-08):** extend `GET /ready` with production self-checks so misconfiguration is
*visible* rather than silent:

```
checks: { database, cache,
          debug_off,            APP_ENV=production ⇒ APP_DEBUG must be false
          https_url,            APP_URL must start https://
          mail_driver,          must not be 'log' in production
          session_secret,       ≥ 32 bytes and not the .env.example value
          razorpay_configured,  both halves present
          webhook_secret }      present once §6.5 ships
```

`/ready` is public, so it must keep returning **booleans only** — never the values.

### 20.2 Recommended production (Phase 5)

| Signal | Threshold | Action |
| --- | --- | --- |
| Wallet debits per customer per hour | > 5 | Review |
| Wallet balance vs `SUM(wallet_entries)` | Any drift | **Page** — ledger corruption |
| `payments.status='Captured'` with no `payment_intents` row | Any | **Page** — a bypass path exists |
| Orders above ₹100 000 | Any | Review |
| Refunds created per staff member per day | > 10 | Review |
| Staff login from a new IP or ASN | Any | Notify that staff member |
| `403` from `Authorize` per principal per hour | > 20 | Probing for privilege escalation |
| `429` rate per IP | > 100/hour | Scanning |
| Uploads per customer per day | > 20 | Abuse |
| Reservations expiring unconsumed | > 50/day | Inventory-hold attack (SEC-INV-01) |
| Razorpay `payment.captured` with no matching order after 15 min | Any | **Page** — money taken, order lost |

### 20.3 Future (P3)

External uptime and TLS-expiry monitoring; shipping `storage/logs` to a retained store off the web
host; an anomaly baseline for order value and wallet velocity. Only worthwhile once Phases 1–5 are
done.

---

## 21. Incident Response Plan

Sized for a small team. Each scenario follows **Detect → Contain → Rotate → Investigate → Recover →
Document**, in the order you will actually need it.

**Universal first move:** `APP_MAINTENANCE=true` in `.env` takes the API down instantly with no
deploy and no data loss, while `/health`, `/ready` and `/version` stay answerable
([`Maintenance.php:17`](backend/src/Middleware/Maintenance.php#L17)). Use it. It is the cheapest
containment available and it already exists.

### Compromised staff account

* **Detect** — `staff_activity_logs` from an unexpected IP; refunds or exports outside working hours; the new-IP alert from §20.2.
* **Contain** — `UPDATE user_sessions SET revoked_at = NOW() WHERE user_id = ? AND audience = 'staff'`. Set the account `status = 'BLOCKED'` **and** revoke the sessions explicitly, because until SEC-ACC-03 ships, blocking alone does not end them.
* **Rotate** — that staff member's password; review whether `ADMIN` was ever warranted.
* **Investigate** — `audit_logs` filtered by `actor_id`; `before_json`/`after_json` show exactly what changed. Cross-reference `request_id` with `storage/logs`.
* **Recover** — reverse changes using `before_json`. Re-check every refund against the Razorpay dashboard.
* **Document** — what they touched, what was reversed, and whether customer data left the building.

### Leaked Razorpay secret

* **Detect** — a Razorpay alert; unexplained refunds or orders; a `payment.signature_failed` spike.
* **Contain** — regenerate the keys in the Razorpay dashboard **first** (this invalidates the leaked pair immediately), then `APP_MAINTENANCE=true`.
* **Rotate** — new `RAZORPAY_KEY_ID` / `KEY_SECRET` / `WEBHOOK_SECRET` in both `.env` files; rebuild the frontend only if `NEXT_PUBLIC_RAZORPAY_KEY_ID` was baked in.
* **Investigate** — Razorpay's own transaction log is authoritative. Compare it against `payments` and `payment_intents`.
* **Recover** — reopen; reconcile every payment across the exposure window.
* **Document** — how it leaked (an exposed `.env`? a log line? a screenshot?) and which control failed.

### Database credential leak

* **Detect** — unexpected connections in cPanel; `.env` fetchable in the deploy probe.
* **Contain** — change the MySQL password in cPanel **immediately**. The app breaks; that is the point.
* **Rotate** — the new password into both `.env` files. Fix the exposure (§14 Option A/B).
* **Investigate** — cPanel access logs; whether the whole database could have been read. **Assume it was.**
* **Recover** — the schema holds `users.password_hash` (Argon2id, peppered — not directly crackable without `SESSION_SECRET`), addresses, order history and `wallet_entries`. If `SESSION_SECRET` leaked alongside it, escalate to the next scenario.
* **Document** — India's DPDP Act breach-notification obligations apply to personal data. Take advice.

### Session-secret leak — **the expensive one**

* **Detect** — `.env` exposure, or a repository/log containing the value.
* **Contain** — `APP_MAINTENANCE=true`.
* **Rotate** — **today this is a trap.** `SESSION_SECRET` is also the password pepper, so changing it makes every stored hash unverifiable and every user must reset. **This is the concrete reason SEC-SEC-01 is P1.** Once versioned derivation ships, the session key rotates alone and passwords are unaffected.
* **Interim procedure if it happens before that fix:** (1) rotate `SESSION_SECRET` in both `.env` files; (2) accept that all sessions die; (3) accept that all password verification fails; (4) mass-email every user to use "forgot password"; (5) **temporarily raise the `password_forgot` limit** — at 5/hour/IP the reset flood will lock out shared-IP users.
* **Investigate / Recover / Document** — as above.

### Payment webhook abuse

* **Detect** — the `webhook.signature_failed` signal; `webhook_inbox` rows with `signature_ok = 0`.
* **Contain** — the endpoint rejects them by design; if the volume is a DoS, tighten the `webhooks` bucket or block the source in `.htaccess`.
* **Rotate** — `RAZORPAY_WEBHOOK_SECRET` if you suspect it leaked; re-register in the dashboard.
* **Investigate** — `webhook_inbox.payload` holds every attempt, valid or not.
* **Recover** — replay legitimate unprocessed events through the sweep command.
* **Document** — source, volume, and whether any event was mis-processed.

### Wallet fraud

* **Detect** — `balance` ≠ `SUM(wallet_entries)`; unusual debit velocity.
* **Contain** — `APP_MAINTENANCE=true`. **Do not edit `wallet_accounts.balance` by hand** — the ledger is the truth and a manual edit destroys the audit trail.
* **Investigate** — `wallet_entries` is append-only with `balance_after` on every row, so the exact point of divergence is visible. Match `kind`/`reference` back to orders and returns.
* **Recover** — correct with a **new** `KIND_ADJUSTMENT` entry through `WalletService`, never with an `UPDATE`.
* **Document** — which invariant broke and which test now covers it.

### SQL injection discovery

* **Detect** — a report, or an unexpected query in a slow log.
* **Contain** — `APP_MAINTENANCE=true`.
* **Investigate** — this audit found none, so treat any finding as new code. Check the dynamic-identifier sites listed in §12.1 first.
* **Recover** — patch, deploy, then assume data exposure and follow the credential-leak path.
* **Document** — and add the case to `OwnershipTest` or a new injection test.

### Malicious upload

* **Detect** — an unexpected file type under `storage/media`; a GD crash or an OOM.
* **Contain** — `media.allowed_mime` in `store_settings` can be emptied to stop all uploads with **no deploy**.
* **Investigate** — `media_assets` records `owner_type`, `owner_id`, `checksum` and `created_at`. Because everything is re-encoded, a stored file is GD output — a surviving payload would itself be the finding.
* **Recover** — soft-delete the asset; the serving endpoint filters `deleted_at`.
* **Document** — and add the sample to `MediaUploadTest`.

### Unauthorized data access

* **Detect** — a `403` spike from `Authorize`; export volume; a customer report.
* **Contain** — revoke the sessions involved; block the account.
* **Investigate** — `audit_logs` for staff; `login_attempts` plus `user_sessions.ip` for customers.
* **Recover / Document** — scope the exposure by principal and time window; DPDP notification if personal data left.

---

## 22. Implementation Roadmap

Every task states: **Priority · Risk addressed · Expected files · Implementation type ·
Compatibility impact · Testing requirement · Rollback strategy.**

### Phase 0 — Repository security audit *(complete)*

This document. No code changed. Output: 45 findings and 32 verified controls.

---

### Phase 1 — P0 production blockers *(before any live Razorpay key)*

#### 1.1 Server-authoritative payment outcome
* **Priority** P0 · **Risk** SEC-PAY-01, SEC-PAY-02, SEC-PAY-03
* **Files** `backend/migrations/0031_payment_intents.sql` *(new)*; `backend/src/Repository/PaymentIntentRepository.php` *(new)*; `backend/src/Controller/Customer/PaymentController.php`; `backend/src/Service/Checkout/PlaceOrderService.php`; `backend/config/routes/checkout.php`
* **Type** Additive table and repository, plus two focused edits inside existing methods. **`PlaceOrderService` is not rewritten** — `$outcome` changes from a body read to an intent lookup, and one amount assertion is added.
* **Compatibility** **Zero contract change.** Same request shape, same response shape, same status codes. COD and full-wallet orders take the `due` / store-credit branches exactly as today and never look for an intent.
* **Testing** §19.3 tests 1–10, the full existing suite, and a manual test-mode checkout.
* **Rollback** `PAYMENT_INTENTS_ENFORCE=false` in `.env` restores the old read for one release. The table stays; only enforcement toggles. Remove the flag after two weeks of clean production data.

#### 1.2 Razorpay webhook
* **Priority** P0 · **Risk** SEC-PAY-06
* **Files** `backend/src/Controller/System/RazorpayWebhookController.php` *(new)*; `backend/api/webhooks/razorpay.php` *(new)*; `backend/src/Repository/WebhookRepository.php` *(new)*; `backend/config/routes/checkout.php`
* **Type** Additive. Reuses `webhook_inbox`, `verifyWebhook()` and the `webhooks` rate class — **no second event architecture.**
* **Compatibility** None — a brand-new URL. The webhook **cannot create orders**, so no existing flow can be perturbed.
* **Testing** §19.3 webhook tests; replay Razorpay test-mode events.
* **Rollback** Remove the route row; the URL 404s and Razorpay retries harmlessly.

#### 1.3 Close the degraded live payment paths
* **Priority** P0 · **Risk** SEC-PAY-04, SEC-PAY-05
* **Files** `frontend/src/features/09-payment/razorpay.ts`; `frontend/src/features/04-cart/components/checkout-flow.tsx`; `backend/src/Service/Checkout/PlaceOrderService.php` (method allowlist)
* **Type** A frontend gate on `rzp_live_*` plus a server-side method allowlist.
* **Compatibility** **Test mode is unchanged**, so development and staging are unaffected. In live mode the "Card" option disappears; COD and Razorpay remain. This is a deliberate, visible product change and should be confirmed with the business owner.
* **Testing** §19.3 e2e tests against a test key and a stubbed live key.
* **Rollback** Revert the frontend commit; **the server-side allowlist stays** — it is the real control.

#### 1.4 Production deployment hardening (Option A)
* **Priority** P0 · **Risk** SEC-DEP-01, SEC-DEP-02, SEC-DEP-03, SEC-DEP-04
* **Files** `tools/live/templates/htaccess-root`; `tools/live/build-live.mjs` (deny-list assertion and archive patterns); server-side file operations
* **Type** Configuration and file hygiene. No application code.
* **Compatibility** None, **provided the live `.env` is already correct** — which A1 verifies first. If it is not, the site is currently misconfigured and fixing it is the point.
* **Testing** `tools/deploy-probe.mjs` (§19.7) against production.
* **Rollback** Keep timestamped copies of `.htaccess` and `.env` before every change.

#### 1.5 Production readiness self-check
* **Priority** P0 · **Risk** SEC-DEP-08, SEC-DEP-02
* **Files** `backend/src/Controller/System/SystemController.php` (both apps)
* **Type** Additive keys inside the existing `checks` object.
* **Compatibility** `GET /ready` gains boolean keys. The envelope is unchanged; existing consumers read `ok` and ignore new keys. **Booleans only — never the values.**
* **Testing** Assert `/ready` is `ok:false` under a deliberately bad environment.
* **Rollback** Trivial revert.

---

### Phase 2 — Payment and wallet hardening

#### 2.1 Wallet reversal on cancellation
* **Priority** P1 · **Risk** SEC-WAL-01 · **Files** `iced-out-crm/backend/src/Service/Order/OrderConsoleService.php`
* **Type** Six lines inside the existing cancel transaction, calling a method that already exists.
* **Compatibility** A behaviour change **in the customer's favour**. Orders already cancelled are *not* retro-credited by the code — produce a one-off reconciliation list and credit those through the ledger by hand.
* **Testing** §19.4 cancellation tests. **Rollback** Revert; the `KIND_REVERSAL` entries stay valid.

#### 2.2 Concurrency-safe idempotency
* **Priority** P1 · **Risk** SEC-IDMP-01 · **Files** `backend/src/Middleware/Idempotency.php` (both apps); a migration adding a `status` column to `idempotency_keys`
* **Type** Insert first, then execute. `ON DUPLICATE KEY` ⇒ 409 retryable.
* **Compatibility** A genuinely concurrent duplicate now gets 409 instead of a second execution. Sequential retries replay as today. The frontend already handles `retryable`.
* **Testing** §19.5. **Rollback** Revert the middleware; the column is harmless.

#### 2.3 Refund locking and gateway reconciliation
* **Priority** P2 · **Risk** SEC-REF-01, SEC-REF-02 · **Files** `iced-out-crm/backend/src/Controller/Console/PaymentController.php`; the webhook controller
* **Type** Wrap the existing check in a transaction with `SELECT … FOR UPDATE`; consume `refund.processed` events.
* **Compatibility** None. **Testing** A concurrent-refund test. **Rollback** Revert.

#### 2.4 Sweep command (inventory, sessions, tokens, idempotency, logs)
* **Priority** P1 · **Risk** SEC-INV-01, SEC-OPS-01, SEC-DEP-07 · **Files** `backend/bin/console.php` (new `sweep` case), `StockService`
* **Type** A new CLI command calling existing methods (`releaseReservationsForOrder`, `SessionRepository::purgeExpired`, `AuthTokenRepository::purgeExpired`) plus log retention. Run hourly from cPanel cron.
* **Compatibility** Stock currently stuck reserved will be released — **verify against real open orders before the first run**, and do that first run manually with output.
* **Testing** Unit test on expiry selection; assert only `HELD` and expired rows are touched.
* **Rollback** Remove the cron entry.

---

### Phase 3 — API and authentication hardening

#### 3.1 Split CORS trust from CSRF trust
* **Priority** P1 · **Risk** SEC-CORS-01 · **Files** `src/Middleware/OriginCheck.php`, `config/app.php`, both `.env.example` (both apps)
* **Compatibility** **None when `TRUSTED_ORIGINS` is unset** — it falls back to today's behaviour.
* **Testing** §19.5 origin tests. **Rollback** Unset the variable.

#### 3.2 Risk-based rate limits, fail-closed, pre-route bucket
* **Priority** P1 · **Risk** SEC-API-01, SEC-API-02, SEC-API-03, SEC-UPL-03 · **Files** `config/app.php`, `config/routes/checkout.php`, `config/routes/me.php`, `src/Middleware/ResolveRoute.php`, `src/Support/RateLimiter.php`, `src/Support/Cache/FileCacheStore.php`
* **Compatibility** `/checkout/orders` drops from 240 to 10/min — **measure the real peak first**; 10 is generous for a human but a load test would notice.
* **Testing** §19.5. **Rollback** Config-only for the limits; a code revert for fail-closed.

#### 3.3 Email-change re-authentication
* **Priority** P1 · **Risk** SEC-ACC-01 · **Files** `backend/config/routes/me.php`, `ProfileController::update()`, `frontend/src/features/01-users/`
* **Compatibility** `PATCH /me` carrying an `email` field now requires `currentPassword`. **This is the one contract addition in the plan**, and it is justified because the current behaviour is the takeover pivot. Name and mobile changes are unaffected. Ship the frontend change first so no client breaks.
* **Testing** A new ownership test plus e2e. **Rollback** Make the field optional again.

#### 3.4 Secret derivation and versioning
* **Priority** P1 · **Risk** SEC-SEC-01 · **Files** `src/Support/Secrets.php` *(new)*, `SessionManager`, `PasswordHasher`, a migration adding `users.pepper_version`
* **Compatibility** **None.** With the new env keys unset, `pepper_version IS NULL` selects the legacy path and every existing hash and session keeps working.
* **Testing** Legacy hashes verify; new hashes verify; a version bump does not break the old ones.
* **Rollback** Revert; legacy remains the default.

#### 3.5 Logging redaction and mail-driver guard
* **Priority** P1 · **Risk** SEC-LOG-01 · **Files** `src/Support/Logger.php`, `src/Kernel/Application.php`, `SystemController`
* **Compatibility** Log **contents** change; the log *format* does not.
* **Testing** Assert a context containing `password` writes `[redacted]`. **Rollback** Revert.

#### 3.6 Cross-audience integration test
* **Priority** P1 · **Risk** SEC-TEST-01 · **Files** `iced-out-crm/backend/tests/Integration/CrossAudienceTest.php` *(new)*
* **Compatibility** Test-only. **Rollback** Delete the file.

#### 3.7 Image-bomb guard
* **Priority** P1 · **Risk** SEC-UPL-01 · **Files** `src/Service/Media/MediaService.php` (both apps)
* **Compatibility** Images above ~40 MP are refused. No real product photo is affected — check the existing library first with `SELECT MAX(width*height) FROM media_assets`.
* **Testing** §19.6. **Rollback** Raise `media.max_pixels` in settings — **no deploy needed.**

#### 3.8 Password-minimum alignment and current-session rotation
* **Priority** P2 · **Risk** SEC-ACC-05, SEC-ACC-06 · **Files** `config/routes/auth.php`, `ProfileController::changePassword()`
* **Compatibility** New passwords need 8 characters; **existing 6-character passwords keep working**.
* **Rollback** Revert the rule strings.

---

### Phase 4 — Deployment hardening

#### 4.1 Move to the split layout (Option B)
* **Priority** P1 · **Risk** SEC-DEP-01 · **Files** none — `build-live.mjs --layout=split` already exists
* **Compatibility** None. Same URLs, cookies, database. The one thing to verify is `MEDIA_ROOT`.
* **Testing** `deploy-probe.mjs` before and after; `/ready`; one `/media/{id}`.
* **Rollback** Keep the flat tree in place during the window; reverting is a file move.

#### 4.2 CSP rollout
* **Priority** P1 · **Risk** SEC-HDR-01 · **Files** `tools/live/templates/htaccess-root`, `tools/live/build-live.mjs` (compute the bootstrap hash)
* **Compatibility** Report-Only first — **zero risk**. Enforcement only after a clean week.
* **Testing** A full checkout in test mode with the browser console open. **Rollback** Revert to Report-Only.

#### 4.3 HSTS, Permissions-Policy, COOP
* **Priority** P1 · **Risk** SEC-HDR-02 · **Files** the same template
* **Compatibility** **HSTS is effectively irreversible for a year for anyone who receives it.** Do this only after 4.1 and the https checks in §24. **No `preload`.**
* **Rollback** `max-age=0` affects new visitors only; already-pinned browsers are unaffected. Treat as one-way.

#### 4.4 CRM deployment hardening
* **Priority** P1 · **Risk** SEC-DEP-01 for the CRM · **Files** a CRM branch of `build-live.mjs`
* **Compatibility** A new deployment. Ship it **split from day one** — do not repeat the flat layout.
* **Requirement:** `TRUSTED_ORIGINS` on the CRM must **not** include the storefront origin.

---

### Phase 5 — Monitoring and security tests

* **5.1** `ops_signals` writers for the five MVP signals — P1, additive, no contract change.
* **5.2** The full test matrix of §19 — P1, test-only.
* **5.3** `npm audit` as check #5 in `tools/audit.mjs` — P1; it may fail on a pre-existing advisory, so triage before enabling it as a gate.
* **5.4** `tools/deploy-probe.mjs` — P1, read-only, safe against production.
* **5.5** Customer-side audit events (`audit: true` on login, password change, session revoke, order placement, wallet movement) — P2. Watch `audit_logs` growth and add retention to the sweep at the same time.
* **5.6** ESLint `react/no-danger` and the `tools/audit.mjs` grep guards for XSS sinks and raw SQL — P2.

---

### Phase 6 — Advanced security

* **6.1** Step-up authentication for privileged CRM actions — P2 (§17.2).
* **6.2** TOTP MFA for `ADMIN` / `MANAGER` — P2 (§17.3).
* **6.3** Database privilege separation — P2 (§17.5).
* **6.4** Private media with a `visibility` column — P2 (SEC-UPL-02).
* **6.5** Email verification (double opt-in) and credential-event notifications — P2 (SEC-ACC-04).
* **6.6** WAF / SIEM / anomaly detection / VPS migration — P3. Do not start before Phases 1–5 are done.

---

## 23. Exact Repository Impact Map

Every path below was confirmed to exist during the audit, except those marked *(new)*.

| Security Area | Existing module / file | Change type | Risk |
| --- | --- | --- | --- |
| Payment authority | [`backend/src/Service/Checkout/PlaceOrderService.php`](backend/src/Service/Checkout/PlaceOrderService.php) | **Modify** — outcome from the intent, not the body; add the amount assertion | **High** — the money path; needs the fullest test coverage |
| Payment intents | `backend/migrations/0031_payment_intents.sql` *(new)* | **Add** | Low — a new table with no FK to existing data |
| Payment intents | `backend/src/Repository/PaymentIntentRepository.php` *(new)* | **Add** | Low |
| Payment create/verify | [`backend/src/Controller/Customer/PaymentController.php`](backend/src/Controller/Customer/PaymentController.php) | **Modify** — server pricing; persist verification | Medium |
| Payment routes | [`backend/config/routes/checkout.php`](backend/config/routes/checkout.php) | **Modify** — `checkout` rate class; webhook row | Low |
| Webhook | `backend/src/Controller/System/RazorpayWebhookController.php` *(new)* | **Add** | Medium — a new public endpoint, signature-verified |
| Webhook | `backend/api/webhooks/razorpay.php` *(new)* | **Add** | Low |
| Webhook storage | `webhook_inbox` (exists, unused — `0005_orders_payments.sql:205`) | **Use as-is** | None |
| Gateway | [`backend/src/Integration/Payments/RazorpayGateway.php`](backend/src/Integration/Payments/RazorpayGateway.php) | **No change** — `verifyWebhook()` is already written | None |
| Degraded payment | [`frontend/src/features/09-payment/razorpay.ts`](frontend/src/features/09-payment/razorpay.ts) | **Modify** — fail closed on live keys | Medium — checkout UX |
| Simulated card | [`frontend/src/features/04-cart/components/checkout-flow.tsx`](frontend/src/features/04-cart/components/checkout-flow.tsx) | **Modify** — hide `card` under a live key | Medium — a visible product change |
| Wallet reversal | [`iced-out-crm/backend/src/Service/Order/OrderConsoleService.php`](iced-out-crm/backend/src/Service/Order/OrderConsoleService.php) | **Modify** — call `reverseOrder()` on cancel | Medium — money movement |
| Wallet | [`backend/src/Service/Wallet/WalletService.php`](backend/src/Service/Wallet/WalletService.php) | **No change** — already correct | None |
| Idempotency | [`backend/src/Middleware/Idempotency.php`](backend/src/Middleware/Idempotency.php) (both apps) | **Modify** — insert first | Medium — touches every idempotent route |
| Refund race | [`iced-out-crm/backend/src/Controller/Console/PaymentController.php`](iced-out-crm/backend/src/Controller/Console/PaymentController.php) | **Modify** — transaction + `FOR UPDATE` | Low |
| Inventory | [`backend/src/Service/Inventory/StockService.php`](backend/src/Service/Inventory/StockService.php) | **No change** — `releaseReservationsForOrder` exists | None |
| Sweep command | [`backend/bin/console.php`](backend/bin/console.php) | **Modify** — new `sweep` case | Medium — the first run releases held stock |
| CSRF / CORS trust | [`backend/src/Middleware/OriginCheck.php`](backend/src/Middleware/OriginCheck.php) (both apps) | **Modify** — read `TRUSTED_ORIGINS` with a fallback | Low — backward compatible |
| Rate-limit table | [`backend/config/app.php`](backend/config/app.php) (both apps) | **Modify** — new classes | Low — config only |
| Pre-route limiting | [`backend/src/Middleware/ResolveRoute.php`](backend/src/Middleware/ResolveRoute.php) | **Modify** — count unmatched paths | Low |
| Fail-closed limits | [`backend/src/Support/Cache/FileCacheStore.php`](backend/src/Support/Cache/FileCacheStore.php) | **Modify** — throw instead of returning `count: 1` | Medium — an unwritable cache now 503s for auth |
| Email change | [`backend/config/routes/me.php`](backend/config/routes/me.php), [`ProfileController.php`](backend/src/Controller/Customer/ProfileController.php) | **Modify** — require `currentPassword` | Medium — **the one contract addition** |
| Staff block | [`backend/src/Service/Auth/SessionManager.php`](backend/src/Service/Auth/SessionManager.php) (both apps) | **Modify** — a status gate for staff only | Low |
| Secret derivation | `backend/src/Support/Secrets.php` *(new)*, `PasswordHasher`, `SessionManager` | **Add + modify** | **High** — touches password verification; must be provably backward compatible |
| Log redaction | [`backend/src/Support/Logger.php`](backend/src/Support/Logger.php) (both apps) | **Modify** | Low |
| Mail guard | [`backend/src/Kernel/Application.php`](backend/src/Kernel/Application.php), `SystemController` | **Modify** | Low |
| Readiness checks | [`backend/src/Controller/System/SystemController.php`](backend/src/Controller/System/SystemController.php) (both apps) | **Modify** — additive keys | Low |
| Image bomb | [`backend/src/Service/Media/MediaService.php`](backend/src/Service/Media/MediaService.php) (both apps) | **Modify** — dimension gate | Low |
| Media privacy | [`backend/config/routes/media.php`](backend/config/routes/media.php), `MediaController`, a migration | **Modify + add** | Medium — interacts with the `immutable` cache header |
| Step-up | `RequireStepUp` middleware *(new)*, `admin_*.php` routes, a migration | **Add** | Medium — CRM only, not yet deployed |
| Headers / CSP | [`tools/live/templates/htaccess-root`](tools/live/templates/htaccess-root) | **Modify** | **High** — a wrong CSP breaks checkout; Report-Only first |
| Deploy layout | [`tools/live/build-live.mjs`](tools/live/build-live.mjs) | **Modify** — archive deny patterns, CSP hash | Medium |
| Deploy probe | `tools/deploy-probe.mjs` *(new)* | **Add** | None — read-only |
| Dependency scan | [`tools/audit.mjs`](tools/audit.mjs) | **Modify** — check #5 | Low |
| Tests | `backend/tests/Contract/PaymentIntegrityTest.php`, `WebhookTest.php`, `WalletConcurrencyTest.php`, `OwnershipTest.php`, `RateLimitTest.php`, `MediaUploadTest.php`; `iced-out-crm/backend/tests/Integration/CrossAudienceTest.php`, `tests/Contract/PermissionMatrixTest.php`, `CancellationTest.php`; `frontend/e2e/checkout-payment.spec.ts` — *all new* | **Add** | None |
| XSS guardrail | `frontend/eslint.config.mjs`, `iced-out-crm/frontend/eslint.config.mjs` | **Modify** — `react/no-danger` with one documented exception | None |

---

## 24. Security Acceptance Checklist

Nothing goes live with a Razorpay **live** key until every P0 box is ticked.

### Authentication

```
[ ] Secure cookie flag confirmed on a real https response (Set-Cookie inspected in DevTools)
[ ] HttpOnly confirmed on io_csess and io_ssess
[ ] SameSite=Lax confirmed; no Domain= attribute present
[ ] Path=/api/v1 confirmed
[ ] Cross-audience integration test passes            (CrossAudienceTest)
[ ] Password reset revokes every session              (AuthFlowTest)
[ ] Password change revokes every other session       (AuthFlowTest)
[ ] Login lockout fires and returns Retry-After
[ ] Unknown email and wrong password are indistinguishable
[ ] Email change requires the current password
[ ] Staff password minimum is 12 characters
```

### Payment — **all P0**

```
[ ] Razorpay LIVE keys exist only in the backend .env
[ ] grep the built frontend/out for the key SECRET pattern — zero hits
    (key_id may legitimately appear; key_secret must not)
[ ] payment_intents table migrated on production
[ ] POST /checkout/orders with payment.outcome="captured" and NO verified intent
    produces an UNPAID order                          ← test with curl before go-live
[ ] Gateway amount is server-priced; a client "amount" is ignored
[ ] Intent amount must equal (total − wallet_applied) or the order is refused
[ ] One razorpay_payment_id can back exactly one order (unique index verified)
[ ] Signature verification uses hash_equals            (already true — confirm untouched)
[ ] Webhook endpoint live, HTTPS, registered in the Razorpay dashboard
[ ] Webhook signature verification tested with a tampered body (400 + signature_ok=0)
[ ] Duplicate webhook event processed exactly once
[ ] Degraded/amount-only payment path cannot mark an order paid
[ ] Simulated "card" method is absent from the live build
[ ] A failed payment writes an order with status "Payment failed" and spends no wallet
[ ] COD checkout still works end to end
[ ] Full-wallet (₹0 payable) checkout still works end to end
[ ] End-to-end test-mode purchase completes and reconciles against the Razorpay dashboard
```

### Wallet

```
[ ] Redemption is atomic under SELECT ... FOR UPDATE   (already true — regression test added)
[ ] Concurrent double-spend test passes
[ ] Negative balance is impossible                     (fuzz test)
[ ] SUM(wallet_entries) reconciles with wallet_accounts.balance for every account
[ ] Cancelling an order returns its wallet credit
[ ] Cancelling twice credits once
[ ] wallet_entries is append-only; no UPDATE path exists in the codebase
[ ] No admin wallet-adjustment endpoint exists (or, if added, it is step-up + audited)
```

### Authorization

```
[ ] Every staff route declares a permission            (PermissionMatrixTest)
[ ] Cross-user order / session / address access returns 404
[ ] Frontend route guards are documented as UX, not security
```

### API

```
[ ] Rate limits confirmed per §10.3
[ ] Rate limiting fails CLOSED for auth, payments and checkout
[ ] Unmatched paths are rate limited
[ ] CORS returns no Access-Control-Allow-Origin for an arbitrary origin
[ ] TRUSTED_ORIGINS on the CRM does not include the storefront origin
[ ] Production errors carry no stack trace, SQL, or filesystem path
```

### Uploads

```
[ ] SVG refused · fake MIME refused · polyglot neutralised
[ ] Image-bomb guard active (media.max_pixels set)
[ ] Media served with nosniff and a server-chosen Content-Type
```

### Deployment

```
[ ] .env is NOT publicly fetchable                     (deploy-probe)
[ ] .git is NOT publicly fetchable
[ ] storage/logs is NOT publicly fetchable
[ ] database/*.sql and migrations/*.sql are NOT publicly fetchable
[ ] LIVE.zip / any archive is NOT publicly fetchable
[ ] config/ and src/ are NOT publicly fetchable
[ ] setup.php deleted AND SETUP_TOKEN blank
[ ] diagnose.php deleted
[ ] Directory listing off everywhere
[ ] HTTPS enforced; http 301s to https
[ ] HSTS present (no preload yet)
[ ] .env permissions are 600
[ ] Layer-2 .htaccess present in every backend directory (flat layout only)
```

### Configuration

```
[ ] APP_ENV=production
[ ] APP_DEBUG=false
[ ] APP_URL=https://iced-out.node2begin.com   (exact, no trailing slash)
[ ] MAIL_DRIVER=smtp   (never "log")
[ ] SESSION_SECRET is 64 hex, unique to production, NOT the development value
[ ] SESSION_SECRET is byte-identical in both .env files
[ ] CORS_ALLOWED_ORIGINS is empty in production
[ ] RAZORPAY_WEBHOOK_SECRET set and matching the dashboard
[ ] GET /ready returns ok:true with every production self-check passing
```

### Monitoring and operations

```
[ ] The five MVP ops_signals are firing
[ ] A daily security digest reaches a real inbox
[ ] The hourly sweep cron is scheduled and its first run was reviewed by hand
[ ] Someone is named as the responder for a payment or wallet alert
```

---

## Appendix A — Findings by priority

| Priority | IDs |
| --- | --- |
| **P0 (8)** | SEC-PAY-01 · SEC-PAY-02 · SEC-PAY-03 · SEC-PAY-04 · SEC-PAY-05 · SEC-PAY-06 · SEC-DEP-01 · SEC-DEP-02 |
| **P1 (18)** | SEC-WAL-01 · SEC-SEC-01 · SEC-HDR-01 · SEC-HDR-02 · SEC-CORS-01 · SEC-UPL-01 · SEC-ACC-01 · SEC-API-01 · SEC-API-02 · SEC-API-03 · SEC-INV-01 · SEC-IDMP-01 · SEC-LOG-01 · SEC-TEST-01 · SEC-DEP-03 · SEC-DEP-04 · SEC-DEP-08 · SEC-DEP-09 |
| **P2 (13)** | SEC-DB-01 · SEC-ACC-02 · SEC-ACC-03 · SEC-ACC-04 · SEC-ACC-05 · SEC-ACC-06 · SEC-REF-01 · SEC-REF-02 · SEC-CRM-01 · SEC-LOG-02 · SEC-UPL-02 · SEC-UPL-03 · SEC-OPS-01 *(plus SEC-DEP-05, SEC-DEP-06, SEC-DEP-07 as deployment sub-items)* |
| **P3 (5)** | SEC-ENV-01 · SEC-API-04 · SEC-API-05 · SEC-CRM-02 · SEC-INF-01 |

## Appendix B — Items marked MANUAL VERIFICATION REQUIRED

These could not be determined from the repository and must be checked on the live host:

1. **The production `.env` values.** The copy in `live/` is a development one. Verify `APP_ENV`,
   `APP_DEBUG`, `APP_URL`, `MAIL_DRIVER`, `SESSION_SECRET` and `CORS_ALLOWED_ORIGINS` on the server.
   *(SEC-DEP-02)*
2. **Which deployment layout is actually on the server** — flat or split — and whether the layer-2
   per-directory `.htaccess` files are present. *(SEC-DEP-01)*
3. **Whether `LIVE.zip`, `database/*.sql`, `storage/logs/*`, `setup.php` or `diagnose.php` are
   reachable over HTTP.** Run `tools/deploy-probe.mjs`. *(SEC-DEP-01, SEC-DEP-03, SEC-DEP-04)*
4. **Whether a reverse proxy or CDN (Cloudflare) sits in front.** If so, `REMOTE_ADDR` collapses and
   every IP-scoped rate limit becomes global. *(SEC-API-04)*
5. **The PHP SAPI in use** (mod_php / PHP-FPM / LiteSpeed LSAPI) and its `variables_order`, to
   confirm `$_SERVER` cannot be influenced into overriding an environment secret. *(SEC-ENV-01)*
6. **MySQL grants held by the live account** — whether cPanel granted `ALL PRIVILEGES`, and whether
   creating additional users is available. *(SEC-DB-01)*
7. **Razorpay dashboard state** — live vs test mode, webhook URL and secret registration, enabled
   payment methods, and whether auto-capture is on.
8. **Whether `.git` was ever uploaded** to the document root.
9. **`storage/logs` contents on the server** — whether any `mail.sent` entries with OTP bodies exist
   from a period when `MAIL_DRIVER=log`. *(SEC-LOG-01)*
10. **TLS certificate issuer and auto-renewal** for the storefront and, when it launches, the CRM
    subdomain.

## Appendix C — What this audit deliberately did NOT change

No application code, migration, environment file, deployment configuration, or dependency was
modified. No dependency was installed. No destructive test was executed. No secret value discovered
during the audit is reproduced in this document — only the names of the keys and, where a finding
depends on it, the non-secret flag values (`APP_ENV`, `APP_DEBUG`, `APP_URL`, `MAIL_DRIVER`) found
in the untracked `live/.env` artefact.
