# Iced_out frontend

The frontend implementation of the Iced_out product plan: a dark editorial storefront, customer purchase journey, account area, and permission-shaped operations console. The current static export generates 144 pages from the complete baseline route inventory. It uses Next.js 16, React 19, strict TypeScript, Tailwind CSS 4, Radix primitives, Motion for React, and TanStack Query.

This package is intentionally frontend-only. Product, CMS, account, order, inventory, and payment values currently come from typed fixture repositories. No backend, database, payment gateway, session service, or stock mutation is implemented here.

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

The production command creates a static export in `out/`:

```bash
npm run build
```

### Payments

Checkout hands the amount to **Razorpay Checkout**. A key is required — there is
deliberately no built-in default, because the published demo key everyone reaches
for is an account with every payment method switched off, and a checkout opened
against it dies on *"No appropriate payment method found"*.

The key is public (it appears in the page source of every Razorpay checkout there
is), and there are two places to put it:

```bash
# backend/.env — preferred. Served to the storefront by GET /config/storefront,
# so changing accounts needs no frontend rebuild. The SECRET belongs here and
# ONLY here.
RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxx
RAZORPAY_KEY_SECRET=xxxxxxxxxxxxxxxxxxxxxxxx

# frontend/.env.local — optional override, for a preview pointed at another
# Razorpay account.
NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxx
```

Test instruments: card `4111 1111 1111 1111` with any future expiry and CVV, OTP
`1234`; or UPI id `success@razorpay`. No money moves on a `rzp_test_` key.

With the secret set, the API creates the Razorpay order before the gateway opens
(`POST /checkout/payments/razorpay/order`) and verifies `razorpay_signature`
afterwards (`POST /checkout/payments/razorpay/verify`) — so the amount is stated
by the server and the result is checked rather than taken on the browser's word.

> **With no API reachable** the checkout falls back to the amount-only flow: the
> real gateway still opens and still takes a real test payment, but the success
> callback is a CLAIM the browser made and the result carries `verified: false`.
> Fine for a test key; never fine for a live one. See
> `src/features/09-payment/razorpay.ts`.

## Structure

```text
src/
  app/                         # route composition only
    (storefront)/              # public catalogue and editorial routes
    (customer-auth)/           # customer authentication screens
    (customer-session)/        # cart, checkout, and account routes
    (staff-auth)/              # isolated staff sign-in and forbidden screens
    (admin)/                   # permission-shaped operations routes
  api/                         # public, customer, and admin HTTP clients
  components/                  # shared layout and UI primitives
  config/                      # declarative route-access rules
  features/                    # numbered product-plan feature modules
  providers/                   # application provider composition
  styles/
    base/                      # reset and global element styles
    components/                # storefront, commerce, page, and admin styles
    utilities/                 # focus and reduced-motion behavior
```

Feature numbers deliberately match the planning sequence, including products, cart, wishlist, search, orders, tracking, payments, coupons/marketing, reviews, notifications, support, dashboard, analytics, shipping, returns, CMS read/authoring, and auth/security. Route files stay thin; feature modules own fixtures, repositories, types, hooks, and domain components.

## Product rules represented in the UI

- Guests can browse, search, filter, evaluate sizes, and keep a device-local wishlist.
- Bag, cart, checkout, account, payment, and ordering routes require a customer session.
- Customer and staff sessions are separate and memory-only in the current preview.
- Staff navigation and routes are shaped by seeded ADMIN, MANAGER, WAREHOUSE, and SUPPORT permissions.
- Product cards and PDPs require an explicit available size before quick-add.
- Money, stock, payment, and order state are display projections; the future API remains authoritative.
- CMS rendering uses a typed block allow-list rather than raw executable content.
- Policy, search, wishlist, tracking, customer-session, staff-auth, and admin metadata follow the documented indexing boundaries.
- Admin families include orders, fulfilment, shipments, catalog, inventory, returns, payments, customers, reviews, support, marketing, notifications, CMS, analytics, access, and settings.

See [docs/frontend-architecture.md](docs/frontend-architecture.md) for the planning-to-code map and backend integration boundaries.

## Quality checks

```bash
npm run check
npm run test:e2e
```

`npm run test:e2e` rebuilds the static export and serves `out/` through a small frontend-only test utility. This avoids development hot-reload state changes while testing intentionally memory-only preview sessions.

The global stylesheet imports the canonical token layer from `../design/styles/tokens/tokens.css`. Original campaign assets live in `public/images/`; captured design-research evidence is not bundled into the app.
