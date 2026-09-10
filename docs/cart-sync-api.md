# The shared bag — `/me/cart` and `/me/wishlist`

> **Who this is for:** whoever wires the Flutter app and the storefront to the
> new endpoints. The backend half is done and live-ready; nothing on either
> client has been changed.
>
> Spec authority: `backend_setup.md` §8.7 (wishlist) and §8.8 (cart). Where this
> file and the spec disagree, the spec wins.

---

## 1. What was actually wrong

The bag never synced because **there was no cart API at all**. Not a bug — a
register that was never built:

| | before | after |
|---|---|---|
| Storefront bag | `localStorage["iced-out.bag"]` | unchanged (still device-local) |
| App bag | a Hive box on the phone | unchanged (still device-local) |
| Server bag | *nothing read `carts` / `cart_items`* | **`/me/cart`, 8 endpoints** |
| Server wishlist | *no table existed* | **`/me/wishlist`, 4 endpoints**, `wishlist_items` |

The tables `carts` and `cart_items` have been in the schema since migration
0004 and no code ever touched them. So one account signed in on a phone and on
a laptop held **two private bags with no third place either could look at.**
Signing in with the same id could not possibly have shown the same cart.

Login was never broken: both clients already hit the same `POST /auth/login`
against the same `users` table. The account was shared; only the bag was not.

**This is why the bag still will not sync after you deploy the backend alone.**
The server side is now there and correct — a client has to start calling it.
Section 6 is that work.

### The second fault, which would have blocked the app anyway

The app could authenticate and **could not write**. `OriginCheck` (the CSRF
guard) refuses any *cookie-authenticated* mutation that carries no `Origin` or
`Referer` header — and a native HTTP client sends neither. Login worked because
there is no session yet at login time, so the guard skips it. Every
authenticated `POST`/`PATCH`/`DELETE` after that came back:

```
403  This request is missing its origin and was refused.
```

So `POST /me/cart/items` from the app would have been refused even with the
endpoint in place. Fixed by accepting a **bearer token** (§3), which is not an
ambient credential and therefore has nothing for CSRF to ride on. The cookie
path is unchanged and still fully guarded.

---

## 2. Endpoints

All of them are `X-Client-Audience: customer` and require a signed-in customer.
**Guests have no server cart** — that is the spec's hard rule, and §5 is what
you do instead.

Every cart verb returns **the whole bag**, so a client never re-reads after
writing.

| Method | Path | Body | Notes |
|---|---|---|---|
| `GET` | `/me/cart` | — | Does not create a cart row just for asking |
| `POST` | `/me/cart/items` | `{ productId, size, quantity? = 1 }` | **Adds** to the line, like "add to bag" on both clients |
| `PATCH` | `/me/cart/items` | `{ productId, size, quantity }` | **Sets** the line; `0` removes it |
| `DELETE` | `/me/cart/items` | `{ productId, size }` *or* `?productId=&size=` | Removing what is not there is a 200 |
| `DELETE` | `/me/cart` | — | Empties the bag **and its coupon** |
| `POST` | `/me/cart/coupon` | `{ code }` | 422 with the exact sentence to show |
| `DELETE` | `/me/cart/coupon` | — | |
| `POST` | `/me/cart/merge` | `{ lines: [{ productId, size, quantity }] }` | The guest bag at sign-in (§5) |
| `GET` | `/me/wishlist` | — | `{ productIds: string[] }` |
| `PUT` | `/me/wishlist` | `{ productIds }` | Full replace — union client-side first |
| `POST` | `/me/wishlist/{productId}` | — | Already saved is a 200 |
| `DELETE` | `/me/wishlist/{productId}` | — | |

Rate limits: reads on `default` (240/min per IP), writes on `cart` (30/min per
customer). Do not push every keystroke of a quantity stepper at it — debounce.

### The cart payload

```jsonc
{
  "data": {
    "lines": [
      {
        "productId": "afterdark-hoodie",   // the slug; also Product.id
        "size": "M",
        "color": "Washed black",           // READ-ONLY, derived — see below
        "sku": "IO-AFTH-M",
        "quantity": 2,
        "unitPrice": 8900,                 // whole rupees, live from the catalogue
        "lineTotal": 17800,
        "available": 6,                    // live stock for this variant
        "maxPerLine": 3,                   // the ceiling this line may be raised to
        "product": { /* the full storefront Product, as GET /catalog/products */ }
      }
    ],
    "itemCount": 2,
    "subtotal": 17800,
    "coupon": { "code": "…", "label": "…", "kind": "percent", "value": 20, "minSubtotal": 5000 },
    "couponCode": "AFTERDARK15",   // as STORED, even when not discounting
    "couponPending": null,         // "AFTERDARK15 needs a subtotal of ₹7,500." when under the minimum
    "discount": 3560,
    "total": 14240,                // subtotal − discount; delivery is not a cart concern
    "version": 7,                  // increments on every server-side change
    "updatedAt": "2026-09-07 11:04:21.883000"
  }
}
```

Money is **whole rupees**, everywhere, as integers.

`total` deliberately excludes delivery — that is priced by
`GET /checkout/delivery-options?subtotal=` (spec §8.9 #51), because the fee
depends on the method the shopper has not chosen yet.

### A line is `(productId, size)` — colour is derived

`product_variants` is UNIQUE on `(product_id, size)` for every live row
(`uq_variants_live_size`), so **a size already names exactly one colour.**

That matters for you: the app's bag line carries a colour and the storefront's
does not, and both must land on the same row. They do, because the server keys
on `(product, size)` and *reads the colour back out of the variant*. Send a
colour or do not; the answer is the same, and `color` in the response is
authoritative — render that rather than the one the device was holding.

### Errors

| Code | When |
|---|---|
| `ICE-CART-422` | product/size not available, or sold out |
| `ICE-CPN-422` | unknown coupon; below its minimum; a voucher code (message points at the wallet) |
| `ICE-WISH-422` | unsaveable id, or the 200-id cap |
| `401` | not signed in |
| `403` | cookie-auth mutation with a missing or untrusted `Origin` (see §3) |

Refusal `message`/`errors[].detail` strings are **written to be shown to the
shopper as they are.** Do not re-word them.

---

## 3. Authentication for a native client

**Send the session as a bearer token.** This is what gets writes past the CSRF
guard.

1. Sign in, declaring the platform:

   ```http
   POST /api/v1/auth/login
   X-Client-Audience: customer
   X-Client-Platform: android      ← android | ios | app | flutter | mobile
   ```

   ```jsonc
   { "data": {
       "customer": { … },
       "session": { "token": "…64 hex…", "expiresAt": "2026-10-07 …" }
   } }
   ```

   `session` is returned **only** for a native platform. A browser does not get
   it, on purpose: the cookie beside it is `HttpOnly`, and putting the same
   token in a readable body would hand a 30-day session to any XSS.
   `POST /auth/register` behaves identically.

2. Send it on every later request:

   ```http
   Authorization: Bearer <token>
   X-Client-Audience: customer
   ```

Cookie first if both are present, so a browser stays on the guarded path. An
invalid token is a plain `401` — it cannot be used to skip the Origin check.

Customer sessions last 30 days (`CUSTOMER_SESSION_TTL`). On `401`, sign in
again; there is no refresh token.

> **Server-side note.** Apache and LiteSpeed strip `Authorization` before a
> CGI/FastCGI handler sees it. `api/.htaccess` now restores it two ways
> (`SetEnvIf` and a `RewriteRule [E=…]`) and `Request::readHeaders` reads the
> `REDIRECT_` form. If bearer auth ever returns 401 for a token you know is
> good, that is the first thing to check — and `CGIPassAuth On` is the third
> lever, deliberately left out of `.htaccess` because an Apache older than
> 2.4.13 would 500 on the directive.

---

## 4. Quantities are the server's decision

`POST` and `PATCH` ask; the server clamps to the lowest of:

- live `available` for the variant,
- the variant's own `max_per_order` (default 3),
- the `inventory.max_per_order` store setting (default 3),
- 10, the column's own `CHECK`.

Asking for 9 when the cap is 3 is **not an error** — you get a bag with 3 in it.
Read `quantity` back from the response; never assume the number you sent. Only
a variant with *nothing* available is a 422.

A bag is **not a reservation.** Stock is held only inside the place-order
transaction, so `available` is advice, and two shoppers can both hold the last
piece in their bags.

---

## 5. The guest bag, and signing in

Guests get no server cart, by rule. So:

1. While signed out, keep the bag exactly where it is today (localStorage /
   Hive).
2. **On a successful sign-in or registration**, `POST /me/cart/merge` with the
   device's lines, then adopt the returned bag as the truth and clear the local
   copy.
3. From then on, treat the server as the bag and keep the local copy only as an
   offline cache.

`merge` **sums** quantities per line and then clamps. Two devices that both went
offline both hold real intent, and "newest device wins" throws half of it away.
Lines that no longer resolve are skipped, not refused — a weeks-old guest bag
must not lose four good items because one product was withdrawn.

Merging twice is safe: the sum is re-clamped to the same ceiling, so a retry
after a dropped connection cannot walk a line upwards.

The wishlist merge is the same shape done client-side: `GET /me/wishlist`, union
with the device list, `PUT /me/wishlist`.

**Sign-out** should clear the local cache only. The server bag stays, which is
the whole point — signing back in anywhere brings it back.

---

## 6. What is left to do (client work)

Nothing below is done. The backend does not need any of it.

**Storefront** — `frontend/src/features/04-cart/cart-context.tsx`:
- when signed in, read and write `/me/cart` instead of `localStorage`; keep
  localStorage as the guest bag and the offline cache;
- call `/me/cart/merge` in the sign-in path;
- **scope the local key per account.** It is a single global
  `"iced-out.bag"` today, cleared only by an explicit sign-out, so on a shared
  browser the next person to sign in inherits the previous shopper's bag. The
  app already fixed this for itself; the website never did.
- `features/05-wishlist/saved-items.ts` — same treatment against `/me/wishlist`.

**App:**
- send `X-Client-Platform` at login, store `session.token`, send it as
  `Authorization: Bearer` (§3);
- read/write `/me/cart`, merge on sign-in;
- render `color` from the response rather than from the stored line;
- two faults worth fixing while you are in there:
  - the Hive box name is scoped on **email**, and the app lets a shopper edit
    their email — after the change it opens a different box, so the bag and
    wishlist appear to have been wiped and the old box is orphaned on disk.
    Scope it on the customer id.
  - `BagLine`'s `productId#colour#size` key **skips a null field**, so a line
    with a size and no colour encodes as `prod#M` and parses back with `M` as
    the *colour*. Harmless while every product has a colour; a live order
    blocker the day one does not. Use fixed slots.

---

## 7. Deploying the backend half

1. Rebuild the bundle: `node tools/live/build-live.mjs`.
2. Upload it.
3. **Apply migration 0030** on the live database — it adds `wishlist_items`,
   and nothing else changes shape:
   - with SSH: `php bin/console.php migrate`
   - without: open `setup.php` in the browser, which runs the same migrator.

   The dump carries `schema_migrations`, so the migrator sees 0001–0029 as
   applied and runs 0030 only.
4. Sanity check, signed in as a customer: `GET /api/v1/me/cart` should answer
   `200` with an empty bag rather than `404`.

The live host is **MySQL 8** while development is MariaDB. Migration 0030 has no
generated columns, so it avoids the `#1215` foreign-key trap that MySQL applies
to `STORED` generated columns (see the note on `carts.active_key`).
