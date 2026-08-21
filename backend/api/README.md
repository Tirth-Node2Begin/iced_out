# api/

The web root. Every URL the browser can reach is a file in here, and the file's
location mirrors its URL:

| File | URL |
|---|---|
| `api/health.php` | `/api/v1/health` |
| `api/config/storefront.php` | `/api/v1/config/storefront` |
| `api/auth/login.php` | `/api/v1/auth/login` |
| `api/admin/auth/login.php` | `/api/v1/admin/auth/login` |

**All staff/console endpoints live under `api/admin/`.** Everything else is
storefront or customer.

These files are **generated** from the route table:

```bash
php bin/console.php make:endpoints
```

Add a route to `config/routes/`, run that, and its file appears here. One file
per **path**, not per route: the web server dispatches on the path alone, so two
verbs on the same URL (GET and PUT `/admin/me/profile`) must be served by the
same file or whichever one it picks answers 405 to the other verb.

## How an endpoint file works

Each one is three lines. It names the route it serves and nothing else:

```php
<?php
declare(strict_types=1);

/** POST /api/v1/auth/login — spec §8.2 #6 */

use Iced\Kernel\Endpoint;

require __DIR__ . '/../bootstrap.php';

Endpoint::serve('auth.login');
```

The path, audience, permission, rate-limit class, validation rules and
idempotency flag all live in `config/routes/` — one table, one source of truth,
printable with `php bin/console.php routes`. An endpoint file that duplicated
any of that would be a second place for it to drift.

A file answering several verbs on one path lists them:

```php
Endpoint::serve('me.preferences.show', 'me.preferences.update');
```

`Endpoint::serve()` runs the complete middleware pipeline — request id, security
headers, CORS, body limit, rate limits, audience check, authentication, origin
check, authorisation, validation, idempotency, audit. **The file layout changes
how a request is routed, never what guards it.**

## index.php

The front controller. The web server falls back to it for paths that have no
literal file — parameterised routes such as `/api/v1/orders/ord-local-07` or
`/api/v1/admin/orders/IO-2026-1049/confirm`. It matches against the same route
table and runs the same pipeline, so both ways in behave identically.

## Adding an endpoint

1. Add the route to the right file in `config/routes/` with a `name`.
2. Write the controller method in `src/Controller/`.
3. Create the matching file here that calls `Endpoint::serve('that.name')`.
4. `php bin/console.php routes` to confirm it is registered.

## The naming rule

| URL | File |
|---|---|
| `/health` | `api/health.php` |
| `/admin/orders` | `api/admin/orders/index.php` |
| `/admin/orders/{number}` | `api/admin/orders/show.php` |
| `/admin/orders/{number}/confirm` | `api/admin/orders/confirm.php` |
| `/admin/catalog/products/{slug}/publish` | `api/admin/catalog/products/publish.php` |

A path with no parameters becomes a plain file; a path whose parameter is
followed by a literal takes that literal as the action; a path ending at its
parameter is the detail read, `show`. A collection that has a parameterised
child gets a directory index so the detail file can sit beside it.

## Folder plan

```
api/
├── health.php  ready.php  version.php     system (spec §8.1)          ✅
├── config/                                storefront config           ✅
├── auth/                                  customer auth (§8.2)        ✅
├── me/                                    profile, addresses, cart, orders,
│                                          returns, vouchers, reviews,
│                                          support, inbox (§8.3–8.15)
├── products/  collections/  search/       catalog + search (§8.5–8.6)
├── checkout/                              checkout & payment (§8.9)
├── track/                                 public tracking (§8.11)
├── pages/  contact.php                    CMS & contact (§8.16)
├── webhooks/                              gateway + courier callbacks (§8.32)
└── admin/                                 ALL console endpoints        ✅
    ├── auth/         dashboard/   orders/       shipments/
    ├── pickups/      catalog/     inventory/    returns/
    ├── vouchers/     payments/    refunds/      payouts/
    ├── customers/    reviews/     support/      analytics/
    └── settings/     me/          audit_logs.php
```

The whole `admin/` tree is built. The customer-facing storefront folders are
next.

## Path prefix note

`api/admin/**` serves `/api/v1/admin/**`, matching this folder and the console's
own `/admin/*` routes. `backend_setup.md` §8 writes these as `/console/**`; the
prefix exists only in the `path` values in `config/routes/admin_*.php`, so
switching back is a find-and-replace there and nothing else changes.
