# Iced_out CRM — backend

The console + CRM JSON API. Core PHP, no framework.

**This is one of two backends against one database.** The storefront's lives in
`../../backend/` and answers the customer surface (`/auth`, `/catalog`,
`/checkout`, `/me`, `/home`); this one answers `/admin/**` and nothing else.
Everything below the route table — the kernel, the middleware pipeline, the
repositories, the services, the presenters — is shared code, present in both
copies, and a fix to it has to land in both.

Read [../README.md](../README.md) first for the split, the ports, and the three
`.env` keys that must agree between the two halves.

---

Core PHP 8.2+ JSON API for the Iced_out storefront and console. No framework, no
ORM, no SSR — it serves `/api/v1/**` and nothing else.

The authoritative build specification is [`../backend_setup.md`](../backend_setup.md):
183 endpoints, 67 domain tables, and one rule — **the frontend's rendered truth
is the contract**. Where this README and that document disagree, that document wins.

## Status

**112 endpoints live.** The whole console is built — every one of the 30 admin
pages has the API behind it — plus the system and auth endpoints.

| Area | Spec | State |
|---|---|---|
| Kernel, pipeline, envelope, migrations, seeds | §2–§4 | **done** |
| System · customer auth · staff auth | §8.1, §8.2, §8.17 | **done** |
| Console dashboard | §8.18 | **done** (queues, trading, activity, pulse, summary) |
| Console orders | §8.19 | **done** (confirm/cancel/dispatch guards enforced) |
| Console shipments, pickups, NDR | §8.20 | **done** (state machine §9.4) |
| Console catalog | §8.21 | **done** (slug/SKU minting, listing room) |
| Console inventory | §8.22 | **done** (StockService is the only writer) |
| Console returns + vouchers | §8.23, §8.24 | **done** (machine §9.5, idempotent voucher issue) |
| Console payments, refunds, payouts | §8.25 | **done** (COD collect, CSV export) |
| Console customers · reviews · support | §8.26–§8.28 | **done** |
| Console analytics · settings · staff profile · audit log | §8.29, §8.30 | **done** |
| Media upload + serving | §8.31 | **done** (stock item photos) |
| Storefront reads, cart, checkout, tracking, CMS, webhooks | §8.5–§8.16, §8.31–§8.32 | not started |

Seeded with fixture parity (§12): 5 products / 23 variants, 28 orders, 12
payments, 5 shipments, 7 returns, 7 reviews, 3 support queries, 3 warehouses,
5 stock items and a 200-day trading series whose numbers reproduce the
frontend's own generator exactly.

### Fixture parity is enforced, not assumed

`tests/Contract/FixtureParityTest.php` pins every console register cell against
the frontend module it came from — the order rows, the payment ledger, payout
net, shipments, returns, stock, customer counts, reviews, support, the catalog
register, per-size PDP stock and today's trading figures. A seed or presenter
change that would move a cell on screen fails there rather than in a browser.

Where two frontend fixtures state different things about the same record, the
seed reproduces **both screens** and reconciles them with real data rather than
picking a winner. IO-2026-1046 is the worked example: the order register calls
it Confirmed with a captured payment while the ledger calls `pay_ICE1046`
Failed, so the seed adds the retry payment that makes both true.

## Rendering model

Core PHP only — no framework, no template engine. The backend **never renders
HTML**: it returns JSON under `/api/v1/**` and nothing else. The storefront and
console stay client-side rendered (`next.config.ts` → `output: "export"`), so
there is no SSR anywhere in the stack.

## Requirements

- PHP **8.2+** with `pdo_mysql`, `mbstring`, `openssl`, `gd`
- MySQL **8.x** in production. MariaDB 10.4+ works for local dev — migrations
  resolve `{{collation}}` per server (`utf8mb4_0900_ai_ci` on MySQL 8,
  `utf8mb4_unicode_ci` on MariaDB, which has no 0900 collations).
- Redis 7 optional. Without it, the cache/rate-limit/lock store falls back to
  files under `storage/cache` and the queue falls back to the `job_queue` table.
- Composer optional for running — `autoload.php` registers the same PSR-4 map by
  hand — but required for PHPUnit and PHPStan.

## First run

**Windows: double-click `server.bat`.** It finds PHP, creates `.env` if it is
missing, mints a `SESSION_SECRET`, creates and migrates the database, seeds it
when it is empty, and starts the API on **http://127.0.0.1:8000**. Anything it
cannot fix it names — including MySQL not running, which is the failure people
actually hit.

```
server.bat                 http://127.0.0.1:8000
server.bat 9000            another port
server.bat 8000 0.0.0.0    reachable from other machines
```

Anywhere else, or by hand:

```bash
cp .env.example .env
php bin/console.php preflight     # secret + database + schema + seed-if-empty
php -S 127.0.0.1:8000 -t api dev-server.php
```

`preflight` is safe to re-run: migrations are forward-only and checksummed, and
seeds only run into an **empty** store, so it never undoes work in a database
you have been using.

### Open the site at `http://127.0.0.1:3000`, not `localhost:3000`

Two reasons, and both bite.

**Speed.** On Windows `localhost` resolves to `::1` first, and PHP's built-in
server is IPv4-only, so every request waits for the IPv6 attempt to fail before
falling back. Measured on this project:

| Client address | Per request |
|---|---|
| `http://127.0.0.1:8000` | **34 ms** |
| `http://localhost:8000` | 260 ms |

**Sessions.** `127.0.0.1` and `localhost` are different *sites* to a browser, so
a `SameSite=Lax` session cookie is not sent across that line — a page on
`localhost:3000` calling an API on `127.0.0.1:8000` looks signed out on every
request. The frontend therefore calls the API on **whatever host the page is
open on** (`src/api/clients.ts`), so the two match by construction; only the
port is configured. Open the site on `127.0.0.1` and you get both the speed and
a working session.

### `server.bat` must stay ASCII with CRLF line endings

`cmd.exe` mis-parses a batch file saved with Unix line endings — it silently
drops the first characters of lines — and mangles non-ASCII punctuation under
codepage 437. If you edit it, keep it plain.

Prefer phpMyAdmin? Import `database/iced_out.sql` instead of `db:create` +
`migrate`, then run `seed` for the demo accounts. See
[`database/README.md`](database/README.md).

Then:

```bash
curl http://127.0.0.1:8080/api/v1/health
curl -H "X-Client-Audience: public" -H "Content-Type: application/json" \
     -d '{"email":"shopper@example.com","password":"secret1"}' \
     http://127.0.0.1:8080/api/v1/auth/login
curl -H "X-Client-Audience: public" -H "Content-Type: application/json" \
     -d '{"email":"admin@iced-out.example","password":"preview1"}' \
     http://127.0.0.1:8080/api/v1/admin/auth/login
```

Demo accounts (dev seed only): customer `shopper@example.com` / `secret1`,
staff `admin@iced-out.example` / `preview1`.

## Console

```
php bin/console.php migrate [--fresh]   apply pending migrations
php bin/console.php migrate:status      applied / pending / changed
php bin/console.php seed [name]         idempotent seeds
php bin/console.php routes              print the route table
php bin/console.php key:generate        mint a SESSION_SECRET
php bin/console.php db:create           create the configured database
php bin/console.php db:export           regenerate database/*.sql

php bin/worker.php <queue> [--once]     queue consumer
php bin/scheduler.php                   cron tick (every minute)
```

## Serving model

Production is **single origin** (spec §3.1) — Nginx serves `frontend/out/` at `/`
and proxies `/api/v1/` to PHP-FPM. Cookies are then first-party, `SameSite=Lax`
works, and no CORS preflight ever fires.

```nginx
root /srv/iced-out/frontend/out;

location / {
    try_files $uri $uri.html $uri/ /404.html;
}

location /api/v1/ {
    root /srv/iced-out/backend/api;
    rewrite ^/api/v1/(.*)$ /$1 break;

    # /auth/login → auth/login.php, else the front controller
    try_files $uri $uri.php /index.php$is_args$args;

    location ~ \.php$ {
        include fastcgi_params;
        fastcgi_pass unix:/run/php/php8.3-fpm.sock;
        fastcgi_param SCRIPT_FILENAME $request_filename;
    }
}
```

Apache/XAMPP needs no extra config — `api/.htaccess` does the same thing.

For split-origin dev (Next on `:3000`, PHP on `:8080`), set
`CORS_ALLOWED_ORIGINS=http://127.0.0.1:3000` and point the frontend at
`NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8080/api/v1`. Use `127.0.0.1` on both
sides so the cookie domain matches.

## Layout

```
api/                 THE WEB ROOT — one file per endpoint, path mirrors URL
├── index.php          front controller for parameterised paths
├── bootstrap.php      shared boot (not directly reachable)
├── health.php  ready.php  version.php  config/
├── auth/              customer auth
└── admin/             ALL console endpoints
database/            importable .sql for phpMyAdmin (generated by db:export)
bin/                 console, worker, scheduler
config/              app, database, permissions, routes/ (one file per module)
src/Kernel/          Application, Router, Endpoint, Request/Response, Pipeline, Container, Database
src/Middleware/      the ordered pipeline of spec §2.3
src/Controller/      thin: parse → service → present
src/Service/         business rules and transactions
src/Repository/      all SQL, one class per aggregate
src/Presenter/       domain → the exact wire shapes of spec §7
src/Domain/          Money, Principal, value objects
src/Integration/     TrackingProvider (placeholder), gateways, storage
src/Support/         Clock, Env, Config, Logger, Validator, Migrator, IdAllocator, SchemaExporter
migrations/          checksummed .sql, forward-only — the schema's source of truth
seeds/               idempotent upserts
tests/               Unit, Contract, Concurrency
dev-server.php       router for `php -S` only; reproduces api/.htaccess
```

See [`api/README.md`](api/README.md) for how an endpoint file is written and
where new ones go.

Layering is one-directional and CI-enforceable:
`Router → Middleware → Controller → Service → Repository → PDO`.
Presenters sit between Service and Controller and are the only place display
formatting happens.

## Nothing an operator can change is a constant in PHP

Every policy value, threshold and vocabulary lives in the `store_settings`
table and is read through `Service\Settings\StoreSettings`. Change a row and
the next request behaves differently — no deploy, no restart.

| Settings key | What it drives |
|---|---|
| `delivery` | fees, free-over threshold, promise windows (storefront config + dispatch) |
| `cod` | cash-on-delivery cap and fee |
| `inventory` | low-stock threshold, reservation TTLs, per-category size and type vocabularies |
| `shipping` | courier list, delivery-failure reasons, max attempts, handling states |
| `returns` | return reasons, outcomes, return window |
| `payments` | gateways, refund reasons, payment methods |
| `catalog` | product / collection / variant state vocabularies |
| `security` | login lockout threshold and window, idempotency TTL |
| `sessions` | customer and staff session lifetimes |
| `id_pools` | the reserved static-export slots (spec §11) |
| `id_series` | prefix, width and floor for every minted id |
| `order_number`, `support`, `business` | numbering and store identity |

Two rules make this hold:

- **Route files never enumerate a vocabulary.** `config/routes/` is loaded
  before any database connection exists, so a list written there could only be
  a stale copy. Rules check the *shape* of a request; services check the
  *vocabulary* against whatever the table says today.
- **CHECK constraints guard state machines, not vocabularies.**
  `orders.status` and `shipments.status` keep theirs, because the application
  branches on those values and a row outside the set is a bug. Refund reasons,
  return reasons, support topics, gateways and stock categories lost theirs in
  migration `0013` — pinning them in DDL meant an operator could not add one
  without a migration.

`config/app.php` holds only bootstrap fallbacks used before the settings are
seeded. Credentials and deployment wiring (database, secrets, cookie names,
Razorpay keys) stay in the environment: they are not policy.

`tests/Contract/` proves it — the dynamism suite changes a setting and asserts
the API's behaviour changes with it.

## Uploads

`POST /api/v1/admin/media` takes a multipart file and returns
`{ media_id, url, width, height, bytes }`. The bytes are validated the way
spec §14 requires and in this order:

1. the size is checked against `media.max_bytes_*`;
2. the type is **sniffed from the file header**, never read from the request —
   a browser-supplied content type is an attacker-supplied content type;
3. the format must be in `media.allowed_mime`;
4. the image is **re-encoded**, which strips EXIF and anything smuggled in a
   comment block and guarantees the bytes on disk are the image they claim to
   be, and scaled down to `media.max_edge`;
5. it is written under a **random** storage key.

Nothing under `storage/media` is web-reachable. Reads go through
`GET /api/v1/media/{id}`, which looks up where the asset actually lives and
serves it with a content type this server chose plus `nosniff`. That endpoint
is the only path from an upload to a response body.

A form uploads first and submits the returned id, so the record stays a flat
map of strings and the operator finds out whether the image was accepted while
they can still pick another one. Sending an empty value clears the photo.

## Things that are easy to get wrong

- **Money never touches a float.** `Domain\Money` is integer paise; the database
  holds `DECIMAL(12,2)`; `Presenter\Format` makes the strings (`₹17,800` for
  customers, `17800` for the console register).
- **Dates render in Asia/Kolkata, always.** `X-Client-Timezone` is analytics
  data, not a display input. Storage is UTC `DATETIME(6)`.
- **Public ids come from the reserved pools** (`Support\IdAllocator`, spec §11).
  A new order that does not take an `ord-local-*` slot has no pre-rendered page.
- **No CSRF token exists.** The frontend sends none; requiring one breaks every
  mutation. The defence is `SameSite=Lax` plus the Origin/Referer check in
  `Middleware\OriginCheck`.
- **Delivery tracking is not built here** (spec §9.8). `Integration\Tracking`
  holds the seam and a placeholder that returns nothing, so pages render and no
  courier event is ever invented.

## Tests run against their own database

Any environment variable overrides `.env`, so the suites point somewhere
disposable and can never drop the database you have accounts in:

```bash
DB_NAME=iced_out_test php bin/console.php preflight
DB_NAME=iced_out_test php -S 127.0.0.1:8001 -t api dev-server.php
```

This is not a nicety. A test run that resets the working database deletes the
accounts someone registered while developing, and the symptom — "my password
stopped working" — looks nothing like the cause.

## Tests

```bash
composer install
composer test     # phpunit
composer stan     # phpstan level 8
```

`tests/Contract` pins the transport envelope and the middleware guards —
those shapes are what `frontend/src/api/*` already implements, so a change there
breaks the UI silently.
