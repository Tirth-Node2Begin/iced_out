# Iced-Out security runbooks

Operational procedures for the controls implemented from `SECURITY_IMPLEMENTATION_PLAN.md`.
Everything here is a thing a person does on a server or in a dashboard — the code half is done and
tested; these are the steps code cannot take for you.

Ordered by when you will need them: go-live first, then routine operation, then incidents.

---

## 1. Go-live: the production `.env`

The single highest-risk item found in the audit was a **development `.env` inside a deployment
bundle** — `APP_ENV=dev`, `APP_DEBUG=true`, `APP_URL=http://127.0.0.1:8000`, `MAIL_DRIVER=log`.
Every one of those failures is silent: cookies stop being `Secure` (the flag is derived from the
scheme in `APP_URL`), HSTS stops being sent, and every password-reset code is written in full to
`storage/logs`, which under the flat layout is inside the document root.

**`GET /api/v1/ready` now refuses to say the store is healthy while any of that is true.** Check it
first, and check it after every deployment:

```bash
curl -s https://iced-out.node2begin.com/api/v1/ready | python -m json.tool
```

Every key under `checks` must be `true`:

| Check | What it means when false |
| --- | --- |
| `database`, `cache` | A dependency is unreachable |
| `debug_off` | `APP_DEBUG=true` — SMTP failure detail reaches API responses |
| `https_url` | `APP_URL` is not `https://` — **cookies are not `Secure` and HSTS is not sent** |
| `mail_driver` | `MAIL_DRIVER=log` — **every password-reset code is being written to a file** |
| `session_secret` | Shorter than 32 bytes, or still the sample value |
| `razorpay_configured` | One or both gateway credentials are blank |
| `webhook_secret` | `RAZORPAY_WEBHOOK_SECRET` is blank — the webhook refuses every delivery |
| `payment_intents_enforced` | **`PAYMENT_INTENTS_ENFORCE=false` — the browser is being trusted about money again** |

The checks only run when `APP_ENV=production`. A laptop reports `ok: true` with debug on, which is
correct — a readiness endpoint that cried wolf in development is one nobody reads in production.

---

## 2. Go-live: Razorpay

1. **Register the webhook.** Dashboard → Settings → Webhooks → Add.
   * URL: `https://iced-out.node2begin.com/api/v1/webhooks/razorpay`
   * Events: `payment.captured`, `payment.authorized`, `payment.failed`, `order.paid`,
     `refund.processed`, `refund.failed`
   * Copy the secret it gives you into `RAZORPAY_WEBHOOK_SECRET`. **It is not the API key secret.**
     Mixing the two produces a signature that is always wrong with no other symptom.
2. **Verify it is live.** Use the dashboard's "test webhook" button and confirm a row appears:
   ```sql
   SELECT provider, event_id, signature_ok, processed_at FROM webhook_inbox ORDER BY id DESC LIMIT 5;
   ```
   `signature_ok = 1` means the secret matches on both sides.
3. **Prove the blocker is closed**, from a machine with a valid customer session cookie:
   ```bash
   curl -X POST https://.../api/v1/checkout/orders \
     -H 'X-Client-Audience: customer' -H 'Content-Type: application/json' \
     -H "Idempotency-Key: $(uuidgen)" -H 'Origin: https://iced-out.node2begin.com' \
     -b 'io_csess=<token>' \
     -d '{"lines":[...],"payment":{"outcome":"captured","reference":"anything"},...}'
   ```
   The order **must** come back with `status: "Payment failed"`. If it comes back `Processing`,
   `PAYMENT_INTENTS_ENFORCE` is off — stop and fix that before taking a single live payment.
4. Confirm auto-capture is on in the dashboard. The gateway integration sets `payment_capture: 1`,
   but an account-level setting can still leave payments merely authorised.

---

## 3. Go-live: deployment hardening

Run the probe against production. It is **read-only** — GET requests only, no session, nothing
written — so it is safe to run against a live site:

```bash
node tools/deploy-probe.mjs https://iced-out.node2begin.com
```

It exits non-zero on any P0. Then, on the server:

```
[ ] chmod 600 .env
[ ] delete LIVE.zip, database/*.sql, seeds/demo/, README.md, composer.json, phpunit.xml, tests/
[ ] delete setup.php  AND blank SETUP_TOKEN in .env
[ ] delete diagnose.php
[ ] confirm .git/ was never uploaded
[ ] confirm a deny-all .htaccess exists in EACH of: config/ src/ storage/ bin/ seeds/ migrations/ database/
[ ] empty storage/logs of anything written while MAIL_DRIVER=log
```

The last two matter most. `tools/live/build-live.mjs` writes those per-directory files and fails the
build if the root deny list has a hole — but the bundle inspected during the audit was missing them,
so **verify on the server rather than trusting the build**.

**Then plan the move to the split layout.** `node tools/live/build-live.mjs --layout=split` produces
`public_html/` plus `iced-out-api/` one level above it. No code changes — `api/v1/_backend.php`
already walks up to find either shape. It eliminates this entire section structurally: there is no
URL that maps to a directory outside the web root, so no `.htaccess` failure can expose `.env`.
The only thing to get right is `MEDIA_ROOT` resolving to the same directory before and after.

---

## 4. Go-live: Content-Security-Policy

The policy is generated into `.htaccess` by the build, with the SHA-256 of every inline script found
in the export — a static export cannot use a nonce.

**Report-only is the default and that is deliberate.** Roll it out in three steps:

1. `node tools/live/build-live.mjs` — ships `Content-Security-Policy-Report-Only`.
2. Open the site with the browser console visible and do a **full test-mode Razorpay purchase**, plus
   home, product, cart, account and orders. Note every violation.
3. When a week is clean: `node tools/live/build-live.mjs --csp-enforce`.

A CSP that is one directive short does not degrade — it breaks the page, and on checkout that means
a gateway frame that never opens.

**HSTS is still commented out** in `tools/live/templates/htaccess-root`. Enable it only once §1 and
§3 pass and you are certain this host will never be served over http again. **Do not add `preload`**
until `crm.iced-out.node2begin.com` is also https: `includeSubDomains` plus preload would make the
CRM unreachable over http with no way to undo it for months.

---

## 5. Routine: the hourly sweep

```
0 * * * * cd /home/<user>/iced-out-api && php bin/console.php sweep >> storage/logs/sweep.log 2>&1
```

**Run `--dry-run` by hand first**, on a database you care about:

```bash
php bin/console.php sweep --dry-run
```

It releases expired stock reservations, retires unpaid payment intents, purges dead sessions, spent
password-reset codes, expired idempotency keys and half-finished MFA sign-ins, deletes logs over 30
days old, and reports any payment the gateway took that no order ever claimed.

The stock release is the only step anybody would notice, which is why it has a dry run. It touches
only reservations still marked `HELD`, past their expiry, **against orders that are already
cancelled or whose payment failed** — never a live order.

> When this was first run against the development database it found a genuine leak: a
> `Payment failed` order from two weeks earlier still holding its stock. Before this command existed,
> nothing ever gave that back.

Watch the `orphaned pay` line. Anything other than `none` means a shopper was charged and has no
order — see §9.

---

## 6. Routine: what to watch

`ops_signals` is the board; the CRM dashboard already reads it. These are written by
`Iced\Support\SecuritySignals`:

| Signal | Tone | What it means |
| --- | --- | --- |
| `webhook.signature_failed` | rose | Someone is posting to the webhook URL who cannot sign like Razorpay, **or** the secret has rotated on one side only |
| `payment.orphaned` | rose | The gateway took money no order claimed. **Page someone.** |
| `refund.diverged` | rose | The refund ledger and the gateway disagree in either direction |
| `payment.intent_mismatch` | amber | An order claimed a capture the server could not confirm. Either the old exploit being probed, or an honest shopper whose verify call never landed |
| `payment.signature_failed` | amber | A signature did not verify. Should be ~0/day; a run of them is forged payment ids |

Log-only events, for an alert to count rather than a dashboard to show — grep `storage/logs/app-*.log`:

`auth.lockout` · `ratelimit.unavailable` · `admin.step_up_failed` · `admin.mfa_failed` ·
`admin.mfa_disabled` · `admin.mfa_recovery_code_used` · `payment.intent_not_promoted`

`ratelimit.unavailable` deserves special attention: it means the counter store could not be used, and
while it is true the `auth`, `payments` and `checkout` buckets are **failing closed** (503) while
everything else runs unthrottled.

---

## 7. Rotating a secret

### `SESSION_SECRET` — read this before you touch it

Until the recent change, `SESSION_SECRET` was **both** the session-token HMAC key and the password
pepper. Rotating it signed everyone out *and made every stored password hash permanently
unverifiable*. The control you most want during an incident was the one that took the shop down.

`PASSWORD_PEPPER` now exists and defaults to `SESSION_SECRET`, so nothing has changed for any
existing deployment. To rotate safely:

```ini
# 1. Pin the pepper to the CURRENT secret. Do this FIRST, and deploy it.
PASSWORD_PEPPER=<the current SESSION_SECRET value>

# 2. Only then mint a new session key.
SESSION_SECRET=<php bin/console.php key:generate>
```

Result: every session dies (which is the point of rotating it), every password keeps working.

**Both `.env` files must be updated together** — the storefront and the CRM share the session table,
and a mismatch invalidates the other half's sessions.

`PASSWORD_PEPPER` itself can never change without forcing a password reset on every customer and
every staff member. That is a property of peppering, not a limitation of the implementation.

**Two things use this key.** They cost very different amounts to rotate, and only the first is the
reason the value is permanent:

| Use | Where | Cost of rotating |
| --- | --- | --- |
| Password hashes | `PasswordHasher::pepper()`, prefix `pwd:` | Password reset for **everyone**. Effectively one-way. |
| Password-reset code hashes | `AuthTokenRepository::hash()`, prefix `pwreset:` | Outstanding six-digit codes stop working. They live 15 minutes; affected users request another. |

The two are domain-separated by those prefixes, so neither can act as an oracle for the other and
there is no reason to split them into separate variables.

Why the reset codes are keyed at all: the secret in that hash is **six digits**, and every other
input to it — the audience, the email — is already known to whoever is attacking the account. While
it was a bare SHA-256, anyone who could *read* `auth_tokens` recovered a live reset code by trying
all one million candidates. Measured in this repository, in interpreted PHP: **0.44 seconds**. That
turned any read-only exposure (a leaked backup, a read-only SQL injection, a shared-host neighbour
reaching the data directory) into account takeover, because the recovered code sets a password the
attacker chooses, and the short expiry did not help — deriving the code takes less time than reading
the row did.

`backend/tests/Smoke/password-reset-smoke.php` asserts both halves: that the search now fails, and —
as a control, so the assertion cannot pass against a broken harness — that the same search still
breaks the old unkeyed form.

**Deploying this change invalidates reset codes issued before it.** Anyone mid-reset at the moment of
deploy sees "that code is not right" and needs to request another. No action required; worth knowing
if support hears about it in the first fifteen minutes.

### `RAZORPAY_KEY_SECRET` / `RAZORPAY_WEBHOOK_SECRET`

Regenerate in the dashboard **first** — that invalidates the leaked pair immediately — then update
`.env` in both applications and re-register the webhook. Rebuild the frontend only if
`NEXT_PUBLIC_RAZORPAY_KEY_ID` was baked in.

### `DB_PASS`

Change it in cPanel immediately; the app breaks until `.env` catches up, and that is correct.

---

## 8. Database privilege separation (not yet implemented)

Both applications connect with one MySQL account holding cPanel's "ALL PRIVILEGES", which includes
`DROP` and `ALTER` because the same account runs migrations. A compromise of either backend reaches
the entire schema, `crm_*` and `audit_logs` included.

**This is documented rather than done, and the reason is honest:** it is a hosting change with no
code change, it mitigates a *second-stage* compromise, and getting it wrong takes the shop down.
It belongs after everything in §1–§4.

**Target:**

| Account | Grants |
| --- | --- |
| `storefront_db_user` | `SELECT` on catalogue and settings; `SELECT/INSERT/UPDATE` on orders, payments, `payment_intents`, `wallet_*`, `inventory_*`, `users`, `user_sessions`, addresses, reviews, support, returns, `idempotency_keys`, `webhook_inbox`. **No `DROP`, no `ALTER`.** No access to `crm_*` or `audit_logs`. |
| `crm_db_user` | Operational read/write across the console's tables including `crm_*` and `audit_logs`. **No `DROP`, no `ALTER`.** |
| `migration_db_user` | DDL only. Used by `php bin/console.php migrate`, never by a web request. |

**On cPanel:** create three users under MySQL® Databases, grant each against the one database, and
point each `.env`'s `DB_USER`/`DB_PASS` at the right one. `config/database.php` already reads both
from the environment, so no code changes.

**Be honest about the limits.** The storefront must write to `users` (registration, profile,
password) and that is the same table holding staff rows — separating those would need a schema split,
which is out of scope. The realistic benefit is **removing DDL from the web-facing accounts and CRM
tables from the storefront account**. Both are worth having; neither contains a `SESSION_SECRET`
leak.

**Verify before switching production over:** run `node tools/audit.mjs` (check 3 exercises every GET
route against the database) under the restricted user.

---

## 9. Incidents

Universal first move: **`APP_MAINTENANCE=true`** in `.env`. It takes the API down instantly with no
deploy and no data loss, while `/health`, `/ready` and `/version` stay answerable.

### A payment was taken with no order (`payment.orphaned`)

The worst payment outcome and the one that must never be silent.

1. **Detect** — the ops board, or the `orphaned pay` line in the hourly sweep.
2. **Find it** — the signal names the gateway payment id:
   ```sql
   SELECT * FROM payment_intents WHERE razorpay_payment_id = '<id>';
   ```
3. **Decide** — the shopper was charged. Either place the order by hand from the intent's amount and
   the customer's bag, or refund at the gateway. **Do not leave it.**
4. **Investigate** — a run of these means the verify call is failing between the gateway and us.
   Check `payment.intent_not_promoted` in the logs.

### Compromised staff account

1. `UPDATE user_sessions SET revoked_at = NOW() WHERE user_id = ? AND audience = 'staff';`
2. Set the account `status = 'BLOCKED'` **and** revoke sessions explicitly — blocking alone does not
   currently end a live staff session (SEC-ACC-03, still open).
3. Rotate that person's password. This also clears any step-up elevation.
4. `audit_logs` filtered by `actor_id` shows exactly what changed, with `before_json`/`after_json`.
   Customer-side credential changes are audited now too.
5. If they had MFA, check `admin.mfa_recovery_code_used` — a used recovery code is how somebody gets
   in without the phone.

### Session-secret leak

See §7. With `PASSWORD_PEPPER` pinned first this is now a maintenance window rather than a disaster.
If you must rotate before pinning the pepper, **temporarily raise the `password_forgot` rate limit**
— at 5/hour/IP the reset flood will lock out everyone behind a shared address.

### Wallet fraud

**Do not edit `wallet_accounts.balance` by hand.** The ledger is the truth and a manual edit destroys
the audit trail. `wallet_entries` is append-only with `balance_after` on every row, so the exact
point of divergence is visible:

```sql
SELECT a.user_id, a.balance,
       (SELECT COALESCE(SUM(CASE WHEN e.direction='credit' THEN e.amount ELSE -e.amount END), 0)
          FROM wallet_entries e WHERE e.account_id = a.id) AS ledger
  FROM wallet_accounts a
 HAVING a.balance <> ledger;
```

Correct with a **new** `KIND_ADJUSTMENT` entry through `WalletService`, never with an `UPDATE`.

---

## 10. Still open

Items from the plan that are **not** implemented, so nobody assumes otherwise:

| ID | What | Why it is still open |
| --- | --- | --- |
| SEC-DB-01 | Database privilege separation | §8 — hosting change, no code change, correctly sequenced last |
| SEC-SUP-01 | 75 production packages in `frontend/package-lock.json` carry **no `integrity` hash** — `react` and `axios` among them | Needs a clean regeneration; see §12. Not done here because the only reliable fix is a full reinstall, and doing that unasked in a working tree is how you lose an afternoon |
| SEC-ACC-02 | Login lockout is per-email, so a known account can be locked out deliberately | Needs an IP dimension; the fix risks weakening the control it is tuning |
| SEC-API-04 | If a CDN or proxy is ever put in front, every IP bucket collapses to one address | Nothing to do until that happens — **but check before adding Cloudflare** |
| SEC-ENV-01 | `Env::load()` layers `$_SERVER` over `.env` | Not reachable via an HTTP header under mod_php/PHP-FPM; needs the live SAPI confirmed |
| — | CRM frontend for step-up and MFA | The API and the client helper (`src/api/step-up.ts`) exist; the dialogs do not. MFA is opt-in, so nothing is broken until somebody enrols |
| — | Local database schema drift | See §11 — this is not a plan item, it is a live problem |

---

## 11. The development database is out of sync

Found while testing, unrelated to any security change, and it will bite:

```
migration 0016 is recorded as applied, but products.image_media_id does not exist
stock_items has 0 rows, while 133 variant_inventory rows reference it
```

Consequences on the machine this was found on:

* **every checkout fails** with a foreign-key error on `inventory_movements`
* four catalogue GET routes return 500 (`tools/audit.mjs` check 3)
* `tools/schema-audit.php` cannot run at all (check 2)

The likely cause is a database restored from an older `.sql` dump while `schema_migrations` came
along with it, so the registry claims migrations that the tables do not have.

**Check production for the same thing before anything else:**

```sql
SHOW COLUMNS FROM products LIKE 'image_media_id';
SELECT COUNT(*) FROM stock_items;
SELECT COUNT(*) FROM variant_inventory vi
  LEFT JOIN stock_items si ON si.id = vi.stock_item_id
 WHERE vi.stock_item_id IS NOT NULL AND si.id IS NULL;
```

If the column is missing or the last query returns anything above zero, production checkout is
broken in the same way. Repair by re-running the affected migrations against the real schema — not
by editing `schema_migrations`, which is what hid it in the first place.

---

## 12. Supply chain: the frontend lockfile has no integrity hashes

**Verified, and it is the one item on this page that ships attacker-controlled code if it goes
wrong.**

`frontend/package-lock.json` (lockfileVersion 3, 775 entries) contains 386 packages — **75 of them
production dependencies** — that carry a `version` and nothing else: no `resolved` URL, no
`integrity` hash. Among them are `react` and `axios`.

```
node_modules/react   -> {"version": "19.2.8", "license": "MIT"}
node_modules/axios   -> {"version": "1.19.0", "license": "MIT"}
node_modules/next    -> {"version": "16.3.0", "resolved": "...", "integrity": "sha512-..."}   ← correct
```

### Why it matters

`integrity` is the only thing that makes an install reproducible in the security sense. With it, npm
verifies the tarball's SHA-512 against a value fixed at the moment the lockfile was written, and a
registry that serves different bytes is rejected. Without it, npm takes whatever the registry hands
over. A registry compromise, a hijacked maintainer account, or an interposed proxy on the build
machine can substitute the contents of `react` and the build will accept it, bundle it, and deploy
it to every customer's browser — including the checkout page.

The affected packages are exactly the ones a build actually ships, which is the wrong half to be
missing.

### Root cause

Entries that npm **fetched** carry the hash; entries it **inferred from an existing `node_modules`
tree** do not. Verified on this machine: the `nanoid 3.3.17 → 3.3.18` bump made during this work is
the only recently fetched package, and it is the only one in its neighbourhood with both fields.

The tree was therefore populated at some point without a lockfile-driven install, and every
subsequent `npm install` has preserved the gap rather than closing it.

### What does NOT fix it

Both were tried here and both were reverted:

| Attempt | Result |
| --- | --- |
| `npm install --package-lock-only` | No change — 75 still missing. npm read the local tree and considered it up to date. |
| `rm package-lock.json && npm install --package-lock-only` | **Worse** — 705 entries missing, up from 386. Zero version changes, so nothing was gained. |

The lockfile was restored to its exact prior state afterwards; `git diff` shows only the intended
`nanoid` security bump.

### The fix

Must be done from a clean tree, so npm has nothing to infer from and has to ask the registry:

```bash
cd frontend
rm -rf node_modules package-lock.json
npm install                 # fetches everything; writes resolved + integrity for all of it
npx tsc --noEmit            # confirm nothing drifted
npm run build
```

Then verify before committing — this is the check, and it must return zero:

```bash
node -e "const p=require('./package-lock.json').packages; \
  const m=Object.entries(p).filter(([k,v])=>k&&!v.link&&!v.resolved&&!v.integrity); \
  console.log('entries without integrity:', m.length)"
```

Review the version diff with care. A clean resolve may float packages within their semver ranges,
and that is a separate decision from adding the hashes — if versions move, decide deliberately
rather than committing both changes as one.

Do the same for `iced-out-crm/frontend`.

**Until this is done, treat the frontend build as unverifiable.** Everything else on this page
assumes the code that runs in the browser is the code in this repository.
