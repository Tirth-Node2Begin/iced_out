# Iced_out Frontend Architecture & Delivery Plan

> **Document type:** Frontend product and engineering blueprint  
> **Status:** Planning source of truth  
> **Brand:** Iced_out  
> **Primary source:** [`product-blueprint.md`](./product-blueprint.md)  
> **Design source:** [`../../design/docs/style-guide.md`](../../design/docs/style-guide.md)  
> **Token source:** [`../../design/styles/tokens/tokens.css`](../../design/styles/tokens/tokens.css)

**Approved scope:** Checkout and order creation require a verified customer session; guest checkout is not supported. The public navigation and routes are New Drop, Men, Women, Collections, Sale, About, and Contact. Categories remain internal catalog classification and filter data only.

---

## 1. Purpose

This document defines the complete frontend to be built for Iced_out. It translates the 20 platform modules and the end-to-end business flows into:

- customer-facing storefront and account experiences;
- admin, manager, warehouse, and support portal experiences under `/admin`;
- routes, rendering modes, state ownership, API boundaries, and feature folders;
- reusable components and interaction contracts;
- responsive, accessible, SEO, performance, testing, and release requirements;
- an implementation sequence that respects module dependencies.

The frontend is not the source of truth for price, stock, eligibility, discounts, shipping, tax, payment, permissions, or order transitions. It presents and orchestrates those rules; the REST API owns and validates them.

### 1.1 Product experience goal

The storefront must feel like a premium fashion editorial that happens to sell. The `/admin` portal must feel like an operations system built around queues that get cleared. They share tokens, primitives, API conventions, and accessibility standards, but not the same information density.

### 1.2 Non-goals

- No direct database access, ORM, or business rules in Next.js.
- No Server Actions that write commerce data.
- No client-side calculation of authoritative totals.
- No hardcoded CMS homepage layout.
- No generic admin template styling that dilutes the Iced_out design language.
- No offline checkout or payment submission.

---

## 2. Actors and frontend surfaces

| Actor | Surface | Primary objective | Frontend posture |
|---|---|---|---|
| Guest shopper | Storefront | Discover, evaluate, and save products to a local wishlist | CSR-only public flows; login is mandatory before bag or checkout |
| Customer | Storefront + account | Buy, track, return, review, and manage preferences | Personalized CSR behind customer session |
| Admin / Brand owner | `/admin` portal | Control the full business and financial view | Permission-aware CSR application |
| Store manager | `/admin` portal | Clear catalog, order, return, review, CMS, and operational queues | Queue-first CSR application |
| Warehouse staff | Scanner-first `/admin` workspace | Pick, pack, dispatch, receive, and count accurately | Touch-first, scan-first, offline-tolerant task UI |
| Support agent | Tickets-first `/admin` workspace | Resolve cases with complete order context | Dense CSR workspace with restricted actions |

### 2.1 Surface boundaries

```text
Public storefront
  Home · New Drop · Men · Women · Collections · Sale · About · Contact
  search · PDP · policy pages · tokenized tracking

Customer session
  Authentication · bag · checkout · account · synchronized wishlist · orders · tracking
  cancellations · returns · refunds · reviews · support

Admin portal (`/admin`)
  Dashboard · catalog · inventory · orders · fulfilment · shipping · returns
  payments · refunds · reconciliation · reviews · customers · support · CMS
  coupons · reports · staff
```

---

## 3. Approved frontend technology stack

The stack is fixed by the product blueprint.

| Concern | Technology | Frontend use |
|---|---|---|
| Framework | Next.js 16 App Router, `output: 'export'` | Client route groups, client layouts, browser-managed metadata, image optimization, PWA shell. **No middleware** — a static export has no runtime to run it |
| UI runtime | React 19 | Server and client components, Suspense, context providers |
| Language | TypeScript 5 strict | Typed API contracts, forms, domain state, components, tests |
| Styling | Tailwind CSS 4 | Token-backed utilities and responsive composition |
| Primitives | shadcn/ui + Radix | Accessible dialogs, sheets, menus, popovers, tabs, selects, tooltips |
| Motion | Framer Motion | 150–500 ms reveals, drawers, presence, route-level choreography |
| Server state | TanStack Query v5 | Query cache, mutations, retries, polling, optimistic UI where allowed |
| Client state | React Context API | Auth, cart, wishlist, theme, consent, and transient UI state |
| Forms | React Hook Form + Zod | Authentication, checkout, account, returns, product forms, admin forms |
| HTTP | Axios | Base client, auth/refresh interceptors, request IDs, normalized errors |
| Tables | TanStack Table | Orders, catalog, stock, customers, tickets, reviews, reports |
| Charts | Recharts / Apache ECharts | Dashboard and analytics visualization |
| Icons | Lucide React | 1.5 px stroke icon system |
| Dates | date-fns | UTC parsing and IST/customer-local formatting |
| Unit/component tests | Vitest + React Testing Library | Hooks, utilities, forms, primitives, shared components |
| End-to-end tests | Playwright | Storefront, checkout, `/admin`, warehouse, and recovery flows |
| Quality | ESLint, Prettier, Lighthouse CI, axe | Code, performance, and accessibility gates |

### 3.1 Rendering rules

| Page family | Mode | Cache/index policy |
|---|---|---|
| Home, New Drop, Men, Women, Collections, Sale, About, Contact, PDP, policy pages | CSR only | Public stable URLs; client fetches and renders API data |
| Search results | CSR only | `noindex`; URL remains shareable |
| Login, register, reset | CSR only | `noindex`, `no-store` |
| Bag, checkout, account, orders, synchronized wishlist, support | CSR | `noindex`, `no-store`; verified customer session required |
| Tokenized public tracking | CSR only | `noindex`, `no-store`; unguessable token |
| Entire `/admin` staff portal | CSR-only shell | Auth- and permission-gated; `noindex`, `no-store` |

Every page renders in the browser. Client Components use Axios and TanStack Query for all REST API reads and mutations; the backend always returns JSON and never HTML. No route may introduce an alternate page-rendering mode without an explicit architecture change.

All route content, loading states, metadata updates, and structured-data injection execute client-side. Route entries contain only the client application boundary and static shell; they never assemble page data during deployment or an incoming page request.

**CSR-only implementation contract:**

- Every route enters through a Client Component boundary.
- All product, category, search, CMS, customer, checkout, and admin requests start through the browser Axios/TanStack Query layer.
- Route modules and layouts do not fetch domain data while a page request or deployment build is executing.
- Deployment outputs static JavaScript, CSS, fonts, images, and a generic application shell only—never route-specific commerce or CMS HTML.
- CI scans route code and fails if domain data bypasses the client API/query layer.

---

## 4. Application route architecture

```text
src/app/
├── layout.tsx
├── (storefront)/
│   ├── layout.tsx
│   ├── page.tsx
│   ├── new-drop/page.tsx
│   ├── men/page.tsx
│   ├── women/page.tsx
│   ├── collections/page.tsx
│   ├── collections/[slug]/page.tsx
│   ├── sale/page.tsx
│   ├── about/page.tsx
│   ├── contact/page.tsx
│   ├── product/[slug]/page.tsx
│   ├── search/page.tsx
│   ├── track/[token]/page.tsx
│   └── pages/[slug]/page.tsx
├── (customer-auth)/
│   ├── auth/login/page.tsx
│   ├── auth/register/page.tsx
│   ├── auth/forgot-password/page.tsx
│   └── auth/reset-password/page.tsx
├── (customer-session)/
│   ├── cart/page.tsx
│   ├── checkout/
│   │   ├── contact/page.tsx
│   │   ├── delivery/page.tsx
│   │   ├── shipping/page.tsx
│   │   ├── payment/page.tsx
│   │   ├── review/page.tsx
│   │   └── confirmation/[orderNumber]/page.tsx
│   └── account/
│       ├── page.tsx
│       ├── profile/page.tsx
│       ├── addresses/page.tsx
│       ├── wishlist/page.tsx
│       ├── orders/page.tsx
│       ├── orders/[orderId]/page.tsx
│       ├── returns/[returnId]/page.tsx
│       ├── reviews/page.tsx
│       ├── notifications/page.tsx
│       ├── support/page.tsx
│       └── security/page.tsx
├── (staff-auth)/admin/
│   ├── login/page.tsx
│   ├── forgot-password/page.tsx
│   ├── reset-password/page.tsx
│   └── forbidden/page.tsx
└── (admin)/admin/
    ├── layout.tsx
    ├── page.tsx
    ├── orders/page.tsx
    ├── orders/queues/[queue]/page.tsx
    ├── orders/[orderId]/page.tsx
    ├── fulfilment/{allocation,pick,pack,dispatch}/page.tsx
    ├── shipments/{active,ndr,manifests}/page.tsx
    ├── shipments/[shipmentId]/page.tsx
    ├── catalog/{products,categories,collections,imports}/page.tsx
    ├── catalog/products/new/page.tsx
    ├── catalog/products/[productId]/page.tsx
    ├── inventory/{overview,movements,counts,transfers,warehouses}/page.tsx
    ├── returns/{requests,qc,exchanges}/page.tsx
    ├── returns/[returnId]/page.tsx
    ├── payments/page.tsx
    ├── payments/transactions/page.tsx
    ├── payments/transactions/[paymentId]/page.tsx
    ├── payments/refunds/page.tsx
    ├── payments/refunds/[refundId]/page.tsx
    ├── payments/mismatches/page.tsx
    ├── payments/reconciliation/page.tsx
    ├── payments/settlements/page.tsx
    ├── payments/settlements/[settlementId]/page.tsx
    ├── customers/page.tsx
    ├── customers/[customerId]/page.tsx
    ├── reviews/page.tsx
    ├── support/{tickets,faq,chat}/page.tsx
    ├── support/tickets/[ticketId]/page.tsx
    ├── marketing/{coupons,campaigns,abandoned-carts,recommendations}/page.tsx
    ├── notifications/{templates,delivery-logs,preferences}/page.tsx
    ├── cms/{home,pages,navigation,redirects}/page.tsx
    ├── analytics/{overview,sales,products,customers,inventory,returns,search,shipping,support}/page.tsx
    ├── access/{staff,roles,permissions,audit-log}/page.tsx
    └── settings/{store,tax,localization,payments,shipping,integrations,security}/page.tsx
```

### 4.1 Navigation model

- Storefront primary navigation: New Drop, Men, Women, Collections, Sale, About, Contact.
- Storefront utility navigation remains Search, Account, Wishlist, and Bag.
- Guests may browse and save to their local wishlist. Selecting **Add to Bag**, **Move to Bag**, **Proceed**, or any `/cart`/`/checkout/**` URL opens the login requirement and preserves the exact return URL and product/variant intent.
- Account navigation: Overview, Orders, Wishlist, Addresses, Reviews, Notifications, Support, Security.
- `/admin` navigation is permission-generated. Hidden permissions do not render disabled links.
- Warehouse mode prioritizes Pick, Pack, Dispatch, Returns QC, Cycle Counts, and scan input.
- Support mode prioritizes My Queue, Unassigned, SLA Risk, Waiting on Customer, and order lookup.

### 4.2 Complete page inventory

The route tree above is the complete baseline page inventory for the current scope. The page families are:

| Surface | Pages included |
|---|---|
| Public brand/storefront | Home, New Drop, Men, Women, Collections index/detail, Sale, About, Contact, search, product detail, policy pages, tokenized tracking |
| Authentication | Customer login/register/forgot/reset; separate staff login/forgot/reset at `/admin/*` |
| Authenticated shopping session | Bag, five checkout steps, order confirmation; every route requires a verified `CUSTOMER` session |
| Customer account | Overview, profile, addresses, wishlist, order list/detail, return detail, reviews, notification preferences, support, security |
| `/admin` overview | Dashboard KPIs, action queues, global search, alerts |
| `/admin/orders` | All orders, named queues, order detail, state history, invoice/payment/shipment/return context |
| `/admin/fulfilment` | Allocation, picking, packing, dispatch |
| `/admin/shipments` | Active shipments, NDR, manifests, shipment detail |
| `/admin/catalog` | Products, product editor, categories, collections, imports |
| `/admin/inventory` | Overview, movements, cycle counts, transfers, warehouses |
| `/admin/returns` | Requests, approval, exchanges, return detail, QC |
| `/admin/payments` | Payment overview, transaction list/detail, refund list/detail, amount/signature mismatches, settlements, gateway/COD reconciliation, exports and recovery queues |
| `/admin/customers` | Customer list and permission-masked customer detail |
| `/admin/reviews` | Review moderation and merchant replies |
| `/admin/support` | Ticket queues/detail, FAQ management, live-chat workspace |
| `/admin/marketing` | Coupons, campaigns, abandoned carts, recommendation controls |
| `/admin/notifications` | Templates, delivery logs, channel preferences |
| `/admin/cms` | Home blocks, About/Contact/policy pages, navigation and redirects |
| `/admin/analytics` | Overview, sales, products, customers, inventory, returns, search, shipping, support |
| `/admin/access` | Staff, roles, permissions, audit log |
| `/admin/settings` | Store, tax, localization, payments, shipping, integrations, security |

Any future page must be added to this inventory with its role, permissions, render mode, API dependencies, empty/error states, and tests before implementation.

### 4.3 Full RBAC model

RBAC is mandatory across the website and `/admin`. Access is **deny by default**.

#### Roles

| Role | Allowed surface | Scope |
|---|---|---|
| `GUEST` | Public storefront, auth, local wishlist, Contact and tokenized tracking | Public resources and browser-local wishlist only; no server cart, checkout, payment, or order creation |
| `CUSTOMER` | Public storefront and `/account/**` | Only records owned by the authenticated customer |
| `SUPPORT` | `/admin` support workspace and approved read-only commerce context | Assigned/visible tickets; masked customer/order/payment data |
| `WAREHOUSE` | `/admin` fulfilment, shipment operations, inventory tasks, return QC | Assigned warehouse and tasks only |
| `MANAGER` | `/admin` operational management | Catalog, pricing, inventory, orders, shipping, returns, refund approvals, reviews, CMS, marketing, operational reports |
| `ADMIN` | Entire `/admin` portal | Full business, finance, staff, roles, settings, integrations, and audit access |

`GUEST` is an access state rather than a persisted staff role. `CUSTOMER` and staff sessions use separate cookie names/audiences so staff privileges never leak into the storefront session. A verified `CUSTOMER` session is a server-enforced precondition for cart mutation, checkout-session creation, payment initiation, and order creation.

#### Role access matrix

Legend: `Own` = owned customer data only; `Read` = permission-masked read; `Work` = execute assigned operational tasks; `Manage` = create/update/approve within granted permissions; `All` = full access.

| Area | CUSTOMER | SUPPORT | WAREHOUSE | MANAGER | ADMIN |
|---|---:|---:|---:|---:|---:|
| Storefront and checkout | Own | — | — | — | — |
| Account, wishlist, orders, returns | Own | Read | — | Read | All |
| `/admin` dashboard | — | Limited | Limited | Manage | All |
| Orders | Own | Read | Assigned | Manage | All |
| Customer PII | Own | Masked | Ship-to only | Masked/permission | All |
| Fulfilment and barcode tasks | — | Read | Work | Manage | All |
| Inventory and movements | Availability only | — | Work | Manage | All |
| Catalog and pricing | Read published | Read published | SKU read | Manage | All |
| Coupons and campaigns | Redeem eligible | Read | — | Manage | All |
| Payments | Own masked | Masked read | — | Operational read | All |
| Refund request | Own eligible | Create request | — | Create/approve | All |
| Refund approval | — | — | — | Manage | All |
| Returns | Own | Read/request | QC assigned | Manage | All |
| Reviews | Own | Read | — | Moderate | All |
| Support tickets | Own | Manage queue | — | Manage/escalate | All |
| CMS | Read published | — | — | Manage | All |
| Operational analytics | — | Support only | Warehouse only | Manage | All |
| Financial analytics | — | — | — | Only with explicit permission | All |
| Staff, roles, permissions | — | — | — | — | All |
| Store/security/integration settings | — | — | — | — | All |
| Audit log | Own security activity | Own actions | Own actions | Operational read | All |

#### Permission naming

Roles are permission bundles. Components and routes check explicit permissions such as:

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

#### Route permission contract

Every protected route exports its required read permission. Mutating controls declare a second, narrower permission and remain subject to the active resource scope.

| Route family | Permission to load | Additional mutation permissions | Required scope |
|---|---|---|---|
| `/admin` | `dashboard.view` | None; cards deep-link to authorized queues | Staff/store scope |
| `/admin/orders/**` | `orders.view` | `orders.manage`, `orders.cancel`, `refunds.request` | Visible stores/orders |
| `/admin/fulfilment/**` | `fulfilment.view` | `fulfilment.allocate`, `.pick`, `.pack`, `.dispatch` | Assigned warehouse/wave/task |
| `/admin/shipments/**` | `shipping.view` | `shipping.manage`, `shipping.manifests.manage`, `shipping.ndr.manage` | Assigned warehouse/provider/store |
| `/admin/catalog/**` | `catalog.view` | `catalog.create`, `.edit`, `.publish`, `pricing.manage` | Assigned store/catalog |
| `/admin/inventory/**` | `inventory.view` | `inventory.adjust`, `inventory.transfer` | Assigned warehouse/SKU |
| `/admin/returns/**` | `returns.view` | `returns.approve`, `returns.qc`, `refunds.request` | Visible store or assigned QC task |
| `/admin/payments` and `/admin/payments/transactions/**` | `payments.view` | `payments.exports.create` for controlled exports | Financial/store scope; masked provider/customer data |
| `/admin/payments/mismatches` | `payments.view` | `payments.mismatches.manage`, `payments.reconcile` | Financial/store scope; reason and audit required |
| `/admin/payments/reconciliation` and `/admin/payments/settlements/**` | `payments.view` | `payments.reconcile`, `payments.exports.create` | Financial/store/provider/date scope |
| `/admin/payments/refunds/**` | `payments.view` | `refunds.request`, `refunds.approve` | Financial/store scope; support remains request-only |
| `/admin/customers/**` | `customers.view_masked` | `customers.view_pii` for unmasking; domain permissions for actions | Visible customers/cases |
| `/admin/reviews/**` | `reviews.view` | `reviews.moderate` | Assigned store/catalog |
| `/admin/support/**` | `support.tickets.view` | `support.tickets.manage`, `support.escalate` | Assigned/visible queues and tickets |
| `/admin/marketing/**` | `marketing.view` | `coupons.manage`, `campaigns.manage`, `recommendations.manage` | Assigned store/campaign |
| `/admin/notifications/**` | `notifications.view` | `notifications.manage` | Assigned store/channel |
| `/admin/cms/**` | `cms.view` | `cms.edit`, `cms.publish` | Assigned site/locale |
| `/admin/analytics/**` | `reports.operational.view` | `reports.financial.view` for financial datasets/exports | Permitted store/date/data class |
| `/admin/access/staff` | `staff.manage` | `staff.manage` | `ADMIN` only |
| `/admin/access/{roles,permissions}` | `roles.manage` | `roles.manage`; cannot grant permissions the actor lacks | `ADMIN` only |
| `/admin/access/audit-log` | `audit.view` | None; immutable read/export | Permitted audit domain |
| `/admin/settings/**` | `settings.manage` | `settings.manage`; sensitive changes require re-authentication | `ADMIN` only |

`/admin/login`, `/admin/forgot-password`, `/admin/reset-password`, and `/admin/forbidden` are staff-auth utility routes rather than operational pages. They never load protected business data.

Do not scatter checks like `role === "MANAGER"` throughout components. The authenticated session returns `role`, `permissions`, and scope constraints. UI uses permission helpers; the API independently enforces the same permission and scope.

#### Authorization pipeline

1. A client-side `<RouteGuard>` in the root client layout protects `/cart`, `/checkout/**`, `/account/**`, and `/admin/**` route families, matching the pathname against a declarative rule table of `pattern → { audience, permission }`. It blocks render and redirects, showing a skeleton while the session resolves. **There is no Next.js middleware anywhere in the repository** — middleware needs a server/edge runtime, and the build is a static `output: 'export'`. This costs nothing in security: the API is the only real authorization boundary, and hidden UI is never a security control.
2. A guest reaching `/cart` or `/checkout/**` is redirected to `/auth/login` with an allow-listed `returnTo` plus a short-lived server-validated intent token; successful login resumes that exact variant/action.
3. `/admin/login` is public to staff; authenticated staff visiting it are redirected to their first permitted admin page.
4. `/admin/**` accepts only `ADMIN`, `MANAGER`, `WAREHOUSE`, or `SUPPORT` staff sessions.
5. The `/admin` layout loads the authoritative staff session, permission set, and scopes before rendering navigation.
6. Each page declares a required permission; direct URL access without it returns `/admin/forbidden`, never a partially rendered page.
7. Each sensitive action uses a `Can`/`PermissionGate` check, but hidden UI is never treated as security.
8. The REST API rechecks authentication, role, permission, ownership, warehouse assignment, and record state for every request; order creation rejects a missing/unverified customer even if a client bypasses the route guard.
9. Query keys include the active identity/scope where needed; logout or permission change clears protected caches.
10. Permission changes take effect on the next request/session refresh; removed access closes open admin views and returns the user to their first permitted route.
11. Every privileged mutation records actor, permission used, reason where required, request ID, and before/after state in the audit log.

#### Row and field scope

RBAC grants the capability; resource scope narrows which records and fields are accessible:

- Customers may only access rows whose `user_id` matches their session.
- Tokenized tracking only exposes the one shipment associated with the unguessable token.
- Warehouse staff are limited to assigned warehouses, waves, orders, and return-QC tasks.
- Warehouse customer data is restricted to fulfilment-required ship-to fields.
- Support agents see only the payment/customer fields required to resolve a case; sensitive values remain masked.
- Managers do not receive staff/role/settings access and receive financial data only with `reports.financial.view`.
- No staff member may grant a permission they do not possess; only `ADMIN` can manage roles.

---

## 5. Module-to-frontend ownership map

| # | Module | Customer frontend | Admin frontend | Critical frontend responsibility |
|---|---|---|---|---|
| 1 | User Management | Register, login, profile, addresses, order history, account deletion | Customer profile and safe order lookup | Merge guest wishlist and resume the preserved intent after login; block deletion with open transactions |
| 2 | Product Management | Product cards, PDP, variants, media, size chart | Eight-step product editor, variant matrix, media, pricing, SEO | Never infer availability from published product data; bind selection to variant IDs |
| 3 | Inventory Management | Stock labels, low-stock urgency, sold-out states | Stock overview, ledger, counts, transfers, alerts | Display available stock from API; never allow negative or client-derived availability |
| 4 | Shopping Cart | Authenticated mini-cart, cart drawer/page, quantity, unavailable lines, totals | Cart lookup for support where permitted | Gate add/move-to-bag behind login; replace local cart with every mutation response |
| 5 | Wishlist | Hearts, wishlist page, login-gated move to bag, variant alerts | Demand signals in customer/product views | Guest-local persistence and login merge; preserve sold-out items |
| 6 | Search & Filter | Suggest overlay, results, facets, sort, URL filters | Zero-result query reporting | Debounce at 150 ms; keyboard navigation; filters are URL-owned |
| 7 | Order Management | Confirmation, history, detail, cancel, invoices | Queue, detail, audit trail, allowed transitions | Render API-provided next actions; never invent a state transition |
| 8 | Order Tracking | Tokenized and account timelines, EDD, NDR action | Shipment timeline and exception queues | Smart polling in v1; same status history drives both customer and staff views |
| 9 | Payment | Method selector, gateway handoff, retry, refund status | Payment attempts, mismatches, reconciliation | Treat browser redirect as provisional; show pending verification safely |
| 10 | Coupon & Discount | Apply/remove coupon, progress-to-eligibility messages | Coupon builder, assignment, performance | Surface the API's specific human reason; never reduce error copy to “invalid” |
| 11 | Review & Rating | Rating, media upload, fit feedback, verified reviews | Moderation queue and merchant replies | Permit review UI only for eligible delivered items; keep rejection reasons auditable |
| 12 | Recommendation System | Similar, complete-the-look, trending, recently viewed | Performance readouts | Lazy-load and fail silently without blocking PDP conversion |
| 13 | Notification | Preference center, web-push prompt, in-app status | Templates, delivery logs, campaign controls | Separate transactional from marketing consent; reflect channel and quiet-hour rules |
| 14 | Customer Support | FAQ, chatbot, tickets, live chat, CSAT | Ticket queue, transcript, full order context, SLA | Carry context across handoff; restrict support agents from approval actions |
| 15 | Admin Dashboard | — | KPIs and action queues | Every metric drills into a filtered work list; net revenue is default |
| 16 | Analytics & Reports | Consent-aware event emission | Funnels, product, size, returns, inventory, courier reports | Use materialized API summaries; never scan or aggregate operational data in-browser |
| 17 | Shipping Management | Pincode, EDD, shipping choices, COD eligibility | Providers, zones, rates, AWB, manifests, NDR | Recalculate after address/cart changes; never promise a stale EDD |
| 18 | Return & Refund | Eligibility, item selection, evidence, exchange, refund timeline | Approval, QC, refund queues | Show expected refund arithmetic before confirmation; only show eligible actions |
| 19a | CMS — Read | Render home, About, Contact and policy pages | — | Render ordered API blocks through a typed registry; unknown blocks fail safely. **Ships Phase 1** |
| 19b | CMS — Authoring | — | Block editor, preview, schedule, version/revert, redirects | **Ships Phase 9** |
| 20 | Authentication & Security | Sessions, MFA-ready security, route guards | Staff auth, RBAC, activity logs | UI visibility is permission-aware but API authorization remains authoritative |

### 5.1 Feature-folder mapping

Each module owns a predictable frontend slice:

```text
src/features/<module>/
├── api/           # Axios calls and TanStack Query options
├── components/    # Module-owned UI
├── hooks/         # Query/mutation and orchestration hooks
├── schemas/       # Zod form and response boundary schemas
├── types/         # UI/domain contract types
├── utils/         # Pure module helpers
└── index.ts        # Explicit public exports
```

Cross-module components belong in `components/commerce`, `components/admin`, `components/ui`, or `components/layout`, not in a random feature.

---

## 6. Customer storefront flows

### 6.1 Discovery: home → destination/listing → search → PDP

1. The CMS-driven homepage renders ordered blocks through a typed component registry (19a); unknown block types render nothing and log, never a crash.
2. Product rails contain published products that are in stock or support notification signup.
3. New Drop, Men, Women, Collections, and Sale are stable top-level destinations. Each reads filters from the URL and fetches its route-owned product query plus facets; the removed generic category route is never linked or generated.
4. Desktop displays a filter rail; ≤991 px uses a bottom sheet; applied filters remain visible as removable chips.
5. Search suggestions appear after 150 ms and group products, collections, storefront destinations, and trending queries.
6. Zero-result search provides a correction, popular destinations/collections, best sellers, and an exit path.
7. The PDP client route fetches and renders product media, price, ratings summary, size chart, metadata, and structured data in the browser.
8. Colour is chosen before size. Colour changes swap media and valid size options.
9. Availability refreshes separately on a short TTL. Sold-out sizes remain visible, disabled, struck through, and connected to “Notify me”.
10. Reviews, recommendations, and recently viewed load below the fold without delaying LCP.

**Required states:** skeleton, loading-more, partial API failure, empty destination/collection, zero search, unpublished product, archived/redirected product, all variants sold out, exact variant sold out, low stock, image/video failure.

**Public destination contracts**

| Page | Data and behavior |
|---|---|
| Home | Scheduled CMS blocks, New Drop rail, Men/Women entry points, collection rail, Sale rail, brand story and service/trust content |
| New Drop | Current and recent published drop products ordered by launch priority/date, with countdown only when backed by a server schedule |
| Men | Men-owned product query with URL filters, facets, sorting and pagination; no redirect through a generic category page |
| Women | Women-owned product query with URL filters, facets, sorting and pagination; no redirect through a generic category page |
| Collections | Published collection index and `/collections/[slug]` detail with ordered products, campaign media and collection metadata |
| Sale | Only variants with an effective server price below their selling/MRP comparison price; discount percentage is computed, never authored |
| About | CMS-managed brand story, materials/craft, values and approved brand media; unknown block types fail safely |
| Contact | Public contact details, FAQ entry points and rate-limited contact form; never places PII in a URL or analytics event |

The backend may still use product categories for classification, facets, reporting, and admin catalog management. No public `category/[slug]` route, Lookbook route, or Journal route is generated.

### 6.2 Wishlist

- Guest hearts write locally and synchronize after login; this is the furthest a guest can progress toward purchase.
- Logged-in hearts store the viewed colour/size where available.
- Wishlist cards retain out-of-stock items and present restock signup.
- Move-to-bag requires login. The login prompt preserves the wishlist item and selected variant, then revalidates and resumes the move after authentication.
- Deep links from notifications reopen the PDP with the saved variant selected.

### 6.3 Cart

1. Add-to-bag remains disabled until required variant choices exist; its label names the missing choice.
2. For a guest, Add to Bag opens the mandatory login/register gate and stores only a short-lived, signed return intent. No guest cart mutation is sent.
3. For a verified customer, the mutation sends `{ variant_id, qty }`, never price.
4. Optimistic feedback may animate the badge, but the full API cart replaces client state.
5. The drawer opens with the new line highlighted and a recommendation rail below.
6. Quantity over available stock is clamped by the API and explained inline.
7. Remove offers a five-second undo toast; restoring still revalidates server-side.
8. Every cart read exposes price, stock, publication, coupon, and shipping changes before checkout.
9. Login synchronizes the local wishlist and executes at most the one preserved bag intent after fresh stock/price validation; there is no guest-cart merge.

### 6.4 Coupon

- Coupon entry displays applied state, discount, and removal action.
- Rejections map field and domain errors next to the input.
- Eligibility progress copy must preserve exact API meaning, such as “Add ₹450 more”.
- Coupon state may change on cart read or checkout revalidation; the revised total is acknowledged before proceeding.

### 6.5 Checkout

Checkout is a resumable five-step CSR journey for verified customers only. `/cart`, every `/checkout/**` route, checkout-session creation, payment initiation, and order creation all enforce the customer session independently. A guest sees login/register before any checkout data or payment option loads.

```text
Contact → Delivery address → Shipping method → Payment method → Review
```

Shared checkout layout:

- progress indicator with completed/current/upcoming states;
- persistent order summary on desktop and collapsible summary on mobile;
- saved progress and resume support;
- server-provided totals after every meaningful change;
- safe navigation guard when a mutation or gateway handoff is in progress;
- `noindex`, `no-store`, and no offline submission.

Step contracts:

| Step | UI responsibilities | Blocking validation |
|---|---|---|
| Contact | Prefill the authenticated customer; allow correction/verification without changing identity ownership | Verified customer session plus valid reachable email and mobile |
| Delivery | Saved/new address, pincode lookup, address validation | Serviceable pincode and complete address |
| Shipping | Standard, express, same-day where eligible; EDD and price | Selection still eligible for latest cart/address |
| Payment | UPI, card, netbanking, wallet, EMI, BNPL, COD, saved token | Method eligibility and server-returned payable total |
| Review | Itemized final total, policies, address, method, consent | Fresh cart, coupon, stock, reservation, idempotency key |

Payment result UI must support: success, verification pending, failure with retry, gateway unavailable with alternatives, amount under review, stock conflict with alternatives, auto-refund initiated, and duplicate submit returning the original order.

### 6.6 Order confirmation

- Confirmation uses the API order result, not gateway redirect parameters.
- Show order number, timeline start, delivery summary, payment state, invoice availability, and support route.
- If payment is still verifying, show a durable pending state that polls safely and does not encourage a second order.

---

## 7. Customer account flows

### 7.1 Authentication and session

- Registration supports email/mobile and Google/Apple entry points.
- Login synchronizes the guest-local wishlist and resumes one signed return intent after identity is confirmed; no guest cart exists.
- Axios refresh logic queues requests during token rotation so parallel `401` responses do not trigger multiple refreshes.
- On refresh failure, clear protected query data, preserve only the safe local wishlist, and redirect with an allow-listed return URL.
- Forgot/reset-password messages never reveal whether an account exists.
- Account deletion shows open-order blockers and the exact path to resolution.

### 7.2 Orders, tracking, cancellation

- Orders list supports status, date, and search filters with URL persistence.
- Order detail includes frozen item/totals snapshots, payment, shipment, invoice, support, and a single canonical timeline.
- Completed timeline steps are gold with checkmarks; pending steps are muted open circles.
- Tracking polls while the page is active; later phases may replace polling with SSE.
- Cancellation starts with eligibility, rechecks on confirm, collects a reason, previews revised/refund totals, and explains manager-review or post-shipment alternatives.

### 7.3 Returns, exchanges, refunds

Return wizard:

```text
Eligible items → Quantities → Reason/evidence → Outcome → Pickup → Review
```

- The return entry point only appears when server eligibility passes.
- Damage and quality reasons require photos and show upload progress/retry.
- Refund, exchange, and store credit show distinct value and timing.
- Exchange variant choice shows live replacement stock; unavailable choices are disabled.
- Customer sees reverse pickup and QC as a timeline, including partial/failure evidence.
- Refund detail shows arithmetic, destination, reference ID, expected time, retry/support state, and completion.

### 7.4 Reviews

- Review form is available per delivered product and order.
- Fields: rating, title, body, up to five images, and fit feedback.
- Draft survives navigation until submit or explicit discard.
- Account review history shows pending, approved, rejected-with-reason, and merchant reply states.

### 7.5 Support

- Start with searchable FAQ and contextual suggested articles.
- Chatbot answers only from live order/refund/fit data and hands off with transcript.
- Ticket form attaches an order/return/payment context when relevant.
- Ticket detail exposes status, messages, attachments, SLA expectation, and CSAT after resolution.

---

## 8. `/admin` portal flows

### 8.1 Admin shell

- Permission-generated navigation and route guards.
- Global order, payment/reference, product, customer, SKU, AWB, and ticket search.
- Command palette for frequent actions.
- Environment and staff identity indicators.
- Notification center for queue breaches and provider failures.
- Unsaved-change protection for complex editors.

### 8.2 Dashboard and queues

The landing view prioritizes work:

1. orders awaiting confirmation;
2. ready to pack;
3. awaiting dispatch;
4. NDR pending;
5. returns awaiting QC;
6. refunds pending approval;
7. payment mismatches and unreconciled settlement lines;
8. reviews awaiting moderation;
9. tickets breaching SLA;
10. low/out-of-stock variants.

Every KPI tile drills into a prefiltered queue. Net revenue is the default; gross is an explicit toggle. Financial widgets do not render without permission.

### 8.3 Catalog and product publishing

The product editor follows the backend publish gate:

```text
Details → Variants → Media → Pricing → Inventory → Shipping → SEO → Size chart
```

- Save draft independently of publish eligibility.
- Variant matrix supports size × colour × material and unique SKU feedback.
- Media is organized per colourway with crop, ordering, alt text, and validation.
- Discount percentage is computed from prices.
- Publish checklist identifies and deep-links every blocker.
- Archive replaces delete once orders exist.
- Bulk import gives per-row validation results and downloadable correction output.

### 8.4 Inventory and warehouse

- Inventory pages present `on_hand`, `reserved`, and `available` distinctly.
- Movement ledger is immutable in UI; corrections create adjustment movements with a reason.
- Warehouse task screens keep scan input focused, use ≥44 px targets, and provide audible/visual success and error feedback.
- Pick rejects the wrong SKU immediately.
- Pack cannot complete until scanned items exactly match the order.
- AWB generation has retry state; reprint reuses the existing AWB.
- Cycle count supports queued local scans during a brief network loss, but posting waits for connectivity and revalidation.
- Return QC requires scan, checklist, evidence, pass/partial/fail result, and explicit stock outcome.

### 8.5 Orders, shipping, NDR, and returns

- Order detail combines state history, items, payment attempts, shipment, communication, refund/return links, and activity log.
- Only API-provided actions are enabled for the current state and permission.
- NDR workspace supports reschedule, address correction, reattempt, and RTO with reason capture.
- Return approval displays customer history and fraud indicators without auto-rejecting the customer.

### 8.6 Payments, refunds, settlements, and reconciliation

Payments is a first-class `/admin/payments` module, not a tab hidden inside order detail.

**Navigation and page contracts**

| Page | Primary content | Primary actions |
|---|---|---|
| Payment overview | Captured value, pending verification, failed payments, mismatches, refunds pending, unreconciled value, COD awaiting remittance and provider health | Drill into a prefiltered queue; no destructive action on KPI cards |
| Transactions | Server-paginated payments with order, masked customer, method, provider, amount/currency, status, provider reference and timestamps | Filter by date/status/provider/method; open detail; permission-controlled export |
| Transaction detail | Frozen amount, order link, provider references, verification state, immutable attempt/webhook timeline, refunds and settlement matches | Re-query provider, request refund, or send to mismatch review when permitted |
| Refunds | Requested, pending approval, queued, processing, failed and completed refunds with exact item/discount/fee/tax arithmetic and destination | Request, approve/reject with reason, retry through the server workflow, open linked return/support case |
| Mismatches | Amount, currency, signature, duplicate, captured-without-order and order-without-capture exceptions, backed by `payment_reconciliation_cases` (assignee, severity, SLA clock, decision, reason, resolution actor) | Compare internal/provider facts, re-fetch authoritative status, assign, resolve with reason; never type a replacement amount |
| Reconciliation | Gateway settlement and courier COD-remittance imports, matched/unmatched/duplicate lines, fee/tax/net variance and source-file status | Import, auto-match, manually link with reason, unmatch via compensating action, export approved report |
| Settlements | Provider settlement/COD-remittance batches with gross, fees, tax, refunds, net, match progress and variance | Filter/open a settlement; import or export only with the required reconciliation/export permission |
| Settlement detail | Settlement header, source file, payment/refund/COD lines, totals, variance and reconciliation history | Re-run unmatched lines, annotate, close only when policy permits |

**Rules and safety**

- The payment detail timeline combines `payments`, append-only `payment_attempts`, verified webhook events, refunds, settlement lines and audit history. Browser redirects are labelled provisional and never shown as capture truth.
- Raw card number, CVV, gateway secret, signature secret and unredacted provider payload never enter the UI. References, email, mobile, payout account and UPI details are masked by the API for the active permission.
- `SUPPORT` may view masked context and create a refund request. Only `MANAGER`/`ADMIN` with `refunds.approve` can approve; high-risk exports and mismatch resolution require their narrower permissions.
- A refund approval modal shows item value, prorated coupon, return fee, shipping/COD treatment, tax, destination, currency, final amount and expected completion time before confirmation.
- Reconciliation accepts signed/provider exports through a validated upload flow, reports row-level errors, and never silently drops an unmatched or duplicate line.
- Every re-query, mismatch decision, manual match/unmatch, refund request/approval/rejection, retry and export records actor, permission, reason, request ID and before/after state.
- UI actions call idempotent server workflows. Repeated clicks, delayed webhooks and page refreshes cannot create a second capture, refund or settlement match.

**Mandatory UI states:** loading, empty, filtered-empty, provider unavailable, verification pending, captured, failed, amount/currency/signature mismatch, duplicate callback, partial/full refund, refund retry exhausted, settlement import validation failure, unmatched/duplicate line, COD remittance overdue, stale rollup and unauthorized field/action.

### 8.7 Reviews and support

- Review queue supports approve, reject with policy reason, and public brand reply.
- Negative sentiment alone is never a rejection reason.
- Ticket workspace keeps customer/order/payment/shipment/return context alongside the thread.
- SLA timers, waiting-on-customer pause, escalation, reassignment, and reopen state are visible.

### 8.8 CMS and marketing (19b)

- Typed block editor supports hero, New Drop/product/collection rails, Men/Women/Sale destination tiles, brand story, About content, Contact panel, policy content, promo strip, and announcement bar.
- Blocks can reorder, duplicate, schedule, expire, preview, publish, version, revert, and validate.
- Banner requires desktop/mobile media and alt text.
- Signed preview is visibly non-production and never crawlable.
- Coupon builder mirrors all API rules and previews eligibility in plain language.

### 8.9 Analytics

Required reports:

- sales, net/gross revenue, orders, conversion funnel;
- product and collection performance;
- size-curve demand and `size_unavailable` events;
- return reasons and fit feedback correlation;
- search terms and zero-result queries;
- wishlist-to-purchase ratio;
- inventory health and sell-through;
- coupon and abandoned-cart recovery performance;
- courier SLA, NDR, and RTO;
- support SLA and CSAT.

Charts summarize; accessible data tables and exports provide the source values.

---

## 9. End-to-end flow ownership

| Flow | Frontend orchestration | Required recovery UI |
|---|---|---|
| F0 Master map | Link storefront, account, `/admin`, and scanner journeys through stable IDs | Cross-surface deep links retain context |
| F1 Authentication | Forms, social entry, refresh, guest-wishlist sync, signed-intent resume, deletion | Expired session, sync changes, invalid return intent, reset failure, open-order blocker |
| F2 Discovery | CMS home, URL facets, suggestions, PDP variants | Zero result, archived product, stale availability, recommendations unavailable |
| F3 Cart | Optimistic intent followed by full server cart replacement | Clamp, price change, unavailable line, remove undo, merge explanation |
| F4 Coupon | Apply/remove and cart repricing | Exact API reason and eligibility progress |
| F5 Checkout | Resumable five steps and idempotent place-order | Failure/retry, pending verify, stock conflict, auto-refund, gateway alternative |
| F6 Order lifecycle | Customer timeline and staff state/audit view | Illegal/stale action refresh and terminal-state clarity |
| F7 Fulfilment | Scanner-first allocate/pick/pack/label/manifest tasks | Short pick, wrong scan, AWB retry, missed pickup, damage |
| F8 Tracking/NDR | Live customer timeline and NDR staff actions | No-scan warning, reschedule, address correction, RTO |
| F9 Post-delivery | Return window and review timing | Clearly show pending actions and closed windows |
| F10 Cancellation | Eligibility, reason, revised total, confirmation | Manager review, too-late alternative, refund status |
| F11 Return/exchange | Item wizard, evidence, outcome, reverse timeline, QC | Rejection with appeal, pickup retry, partial QC, exchange price difference |
| F12 Refund | Calculation, destination, timeline, reference | Retry/escalation and support ticket deep link |
| F13 Wishlist alerts | Variant-aware saving and notification deep links | Stock revalidation and frequency/consent state |
| F14 Cart recovery | Restore cart snapshot from secure deep link | Highlight unavailable or changed lines; never silently delete |
| F15 Reviews | Verified review form and moderation | Draft recovery, policy rejection reason, upload retry |
| F17 Notifications | Preference center and delivery log visibility where appropriate | Provider failure remains an ops concern; customer settings remain truthful |
| F18 Support | FAQ/chat/ticket/CSAT and permitted `/admin` context | Escalation, waiting state, reopen, blocked closure |
| F19 Daily operations | KPI drilldowns and prioritized queues | Stale rollup timestamp and manual refresh |
| F20 Product publish | Eight-step editor and publish checklist | Per-field blockers, retryable media/reindex/publish feedback |
| F21 Inventory | Ledger, scans, adjustments, counts, transfers | Conflict refresh, reason-required correction, offline scan queue |
| F22 CMS publish | Home/About/Contact/policy blocks, preview, scheduling, publish/version/revert | Missing assets/alt/redirect, invalid internal target, publish retry |
| F23 Edge cases | Standard conflict and recovery patterns across modules | No generic dead end; every error offers a safe next action |

---

## 10. State, API, and data architecture

### 10.1 State ownership

| State | Owner | Persistence |
|---|---|---|
| Catalog, facets, PDP, orders, returns, tickets, reports | TanStack Query | Query cache; API is source of truth |
| Auth identity and session status | Auth Context | Secure cookie/refresh flow; no raw token in local storage |
| Cart | Cart Context backed by Query | Authenticated server cart; safe UI snapshot only for undo; cleared on logout |
| Wishlist | Wishlist Context backed by Query | Guest local state or customer API |
| Theme | Theme Context | Preference storage and `data-theme` |
| Checkout draft | Query/API plus form-local state | Server progress per checkout session |
| Forms | React Hook Form | Local until explicit draft save/submit |
| Filters/sort/pagination | URL search params | Browser history/shareable URL |
| Drawer, modal, selection, command palette | Component/UI Context | Ephemeral |

### 10.2 Query conventions

Use a query-key factory per module, for example:

```ts
orders.keys.all
orders.keys.list(filters)
orders.keys.detail(orderId)
orders.keys.timeline(orderId)
```

- Invalidate narrowly after mutation.
- Poll only active, time-sensitive screens.
- Pause polling in hidden tabs where safe.
- Cancel stale suggestion and facet requests.
- Recommendations may fail without taking down the PDP.
- Permission changes clear admin query caches before navigation is rebuilt.

### 10.3 Axios client

```text
api/public-client.ts      # catalog/content, no credentials
api/customer-client.ts    # customer cookie/session, refresh handling
api/admin-client.ts       # staff session, scope, and permission-aware errors
api/error-normalizer.ts   # response envelope → typed AppError
api/request-context.ts    # request ID, idempotency key, locale, timezone
```

Normalized errors preserve `message`, module error `code`, field, detail, status, request ID, and retryability. UI copy should use safe API-provided domain messages and never expose stack traces or gateway internals.

### 10.4 Mutation policy

- Optimistic: wishlist heart, reversible cart intent, safe local preference changes.
- Pessimistic: price, coupon, stock, shipping, checkout, payment, order state, refund, inventory, and permissions.
- Idempotency key: order creation, payment confirmation, refund initiation, and any API contract requiring replay safety.
- Double-submit protection: disable action while active, preserve retry, and still rely on server idempotency.

---

## 11. Shared component system

### 11.1 Primitives

`Button`, `IconButton`, `Input`, `Textarea`, `Select`, `Checkbox`, `RadioGroup`, `Switch`, `Dialog`, `Sheet`, `Popover`, `Tooltip`, `Tabs`, `Accordion`, `Toast`, `Badge`, `Skeleton`, `EmptyState`, `ErrorState`, `Pagination`, `Breadcrumbs`, `FileUpload`, `ConfirmDialog`.

### 11.2 Commerce components

| Component | Contract |
|---|---|
| ProductCard | Media, badge, wishlist, name, mono price, colour, stock state; no embedded business rules |
| ProductMediaGallery | Per-colour media, responsive image, zoom, video, thumbnails, accessible controls |
| Price | INR/currency formatter, compare-at price, discount badge computed from API values |
| ColourSwatch | Actual colour chip, name for assistive tech, gold selected ring |
| SizePill | Available, selected, low-stock, and sold-out/struck states |
| SizeChart | Modal/sheet, measurement units, fit guidance |
| AddToBag | Missing-selection labels, pending, success, conflict, full-width mobile behavior |
| CartLine | Variant, quantity, price-change/unavailable notices, remove/undo |
| CouponField | Apply, applied, rejection, eligibility progress |
| OrderSummary | Server totals, discounts, shipping, tax, payable amount |
| OrderTimeline | Gold completed steps and muted future steps; timestamp, courier, refund states |
| ReturnWizard | Eligible lines, reasons, upload, outcome, estimate, pickup, review |

### 11.3 Admin components

`AdminShell`, `PermissionGate`, `RouteGuard`, `KpiTile`, `ActionQueue`, `DataTable`, `FilterBar`, `SavedView`, `BulkActionBar`, `StatusBadge`, `AuditTimeline`, `ActivityLog`, `ScannerInput`, `ScanFeedback`, `ProductEditorStepper`, `VariantMatrix`, `MediaManager`, `PublishChecklist`, `InventoryLedger`, `SlaTimer`, `TicketWorkspace`, `BlockEditor`, `ReportChart`.

`SavedView` has no persistence table in the schema, so in v1 it is **URL-encoded** — filters, sort, and columns serialize into the query string, which makes a view shareable by copying the link and needs no migration. A persisted `admin_saved_views` table is on the backlog, not in the 121-table baseline.

---

## 12. Iced_out design implementation

### 12.1 Visual direction

Five fixed adjectives: **dark, editorial, glassy, gold-accented, oversized**.

- Page background: `#121212`.
- Primary type: warm cream `#f4f2ed`.
- Brand accent: antique gold `#cebd63`; hover `#ad9d49`.
- Raised opaque surfaces: `#232323`.
- Glass surface: 5% white fill, 15% white 1 px border, 32 px backdrop blur.
- Error: clay `#ce7563`; warning/info use the documented semantic tokens.
- No visual gradients in product UI. Imagery uses a flat darkener and film grain.
- The cart drawer owns the only standard shadow.

> ⚠️ **Phase 0 exit blocker.** `--state-warning` (`#d9a441`) and `--state-info` (`#7fa8c9`) are referenced throughout order and stock states in this document but are **absent from `tokens.css`**. Add both, with verified AA contrast on `#121212`, before component work begins — otherwise order and stock states cannot be built.

### 12.2 Typography

| Role | Family | Rules |
|---|---|---|
| Display | Chillax 400 | Editorial headings, product names, section titles; responsive `clamp()` |
| Body | Satoshi 300 | Descriptions, forms, support copy |
| Commerce/meta | Roboto Mono 400 | Prices, SKUs, sizes, order IDs, nav, badges; uppercase with 1 px tracking |

Prices must never use the body font. Self-host WOFF2 subsets with `font-display: swap`; three families maximum.

### 12.3 Shape, spacing, and motion

- 8 px spacing foundation using the documented ladder.
- 8 px radius for controls; 16 px for surfaces/media; surfaces tighten to 8 px at ≤479 px.
- 1 px borders only.
- Controls: 200 ms ease.
- Cards and surfaces: 500 ms cubic-bezier(.165,.84,.44,1).
- Reveal: opacity plus 20 px vertical translation; critical content appears immediately when its client-side data resolves and must not depend on reveal animation.
- Hover changes fill, border, and colour; nothing lifts, scales dramatically, or gains a new shadow.

### 12.4 Storefront versus admin density

- Storefront uses oversized display type, editorial negative space, high-impact media, and progressive disclosure.
- The `/admin` portal uses the same tokens and shapes with smaller type, denser tables, sticky filters, and action-first hierarchy.
- Warehouse screens reduce decoration further and maximize scan clarity and touch target size.

---

## 13. Responsive and accessibility requirements

### 13.1 Breakpoints

`479`, `767`, `991`, and `1440` px, verified from 360 px through 4K.

- Product grids: 1 → 2 → 3 → 4 columns.
- Filter rail becomes a bottom sheet at ≤991 px.
- PDP becomes stacked; add-to-bag becomes sticky and full-width below the fold.
- Cart drawer becomes full-width on small mobile.
- Admin tables provide card/list fallback or controlled horizontal scroll; actions stay reachable.
- Warehouse layout supports rugged Android portrait screens and hardware keyboard-wedge scanners.

### 13.2 Accessibility gate

- WCAG 2.1 AA across storefront, checkout, account, and `/admin`.
- Visible gold `:focus-visible` outline with offset.
- Full keyboard search suggestions, filters, dialogs, checkout, tables, and admin actions.
- Correct focus trapping/restoration for Radix overlays.
- ≥44 px touch targets.
- Skip link and logical headings/landmarks.
- `aria-live` for cart count, stock changes, scan result, payment state, and toasts.
- Sold-out state uses text/decoration in addition to colour.
- Reduced-motion mode removes reveals and nonessential marquee movement.
- Charts provide equivalent data tables or summaries.
- Manual keyboard and screen-reader smoke tests accompany automated axe checks.

---

## 14. SEO, performance, PWA, and resilience

### 14.1 SEO

- CSR-only routes for all catalog and editorial pages; the static application shell contains no product or editorial page data.
- PDP JSON-LD: `Product`, `Offer`, `AggregateRating`, `BreadcrumbList`.
- Canonical product, New Drop, Men, Women, collection and Sale URLs with SEO-safe pagination.
- Split product/listing/content sitemaps.
- Required title, description, OG image, alt text, and redirect target before publish.
- `noindex`: search, cart, checkout, account, tracking, and every `/admin/**` route.

### 14.2 Performance budgets

| Metric | Gate |
|---|---|
| PDP JavaScript | ≤180 KB gzipped |
| LCP image | ≤150 KB, preloaded/priority |
| LCP | ≤2.0 s |
| INP | ≤200 ms |
| CLS | ≤0.1 |
| Fonts | Three families, WOFF2, self-hosted, subset |
| Critical third parties | Maximum two; everything else deferred or server-side |

Use explicit image dimensions, AVIF/WebP, responsive `srcset`, lazy below the fold, route-level code splitting, dynamic import for charts/editors, and Suspense boundaries that do not destabilize layout.

### 14.3 PWA and weak-network behavior

- Cache application-shell assets, previously fetched catalog API responses, and imagery for read-only browsing.
- Preserve cart and form-safe drafts.
- Never queue checkout/order/payment as an offline write.
- When connectivity returns, offer an explicit retry after stock and price revalidation.
- Display offline/stale status without pretending data is current.

### 14.4 Real-time phases

1. v1: TanStack Query smart polling for tracking, payment verification, and active admin queues.
2. v2: SSE for tracking and operational queues.
3. v3: WebSocket sidecar if scale and bidirectional requirements justify it.

---

## 15. Analytics contract

Minimum customer events:

`view_item_list`, `select_item`, `view_item`, `select_variant`, `size_unavailable`, `search`, `view_search_results`, `add_to_wishlist`, `remove_from_wishlist`, `add_to_cart`, `remove_from_cart`, `view_cart`, `apply_coupon`, `begin_checkout`, `add_shipping_info`, `add_payment_info`, `purchase`, `refund`, `review_submit`, `support_start`.

Every event includes only consent-appropriate fields, stable product/variant IDs, source list/position, currency, and request/session correlation where allowed. Do not send raw PII to analytics. `size_unavailable`, zero-result search, wishlist-to-purchase, return reasons, and checkout failure stage are first-class business signals.

---

## 16. Security and privacy in the frontend

- Hold the access token (15 min) in **JavaScript memory only** — never `localStorage`, never `sessionStorage`, never a non-`HttpOnly` cookie. It is lost on page refresh and recovered by a silent refresh call.
- The refresh token (30 d) is an `HttpOnly; Secure; SameSite=Lax` cookie, path-scoped to `/api/v1/auth/refresh`, rotating with reuse detection and family revocation. The client never reads it.
- Keep customer and staff sessions separate at two levels — **different cookie names and different JWT audiences**. A customer refresh cookie presented to `/admin` is rejected on audience, before any role check. A customer session never grants `/admin` access.
- Protect every `/admin/**` page with a deny-by-default route guard and a declared permission.
- Treat missing authentication as `401`/login redirect and missing authorization as `403`/`/admin/forbidden`.
- Render admin navigation, data, and actions only from the authoritative permissions and scopes returned for the current staff session.
- Recheck role, permission, tenant/store scope, resource scope, and allowed state transition in every API request; hidden UI is never the security boundary.
- Never place staff permissions, editable roles, or authorization decisions in local storage.
- Sanitize CMS rich content and constrain allowed block schemas.
- Protect uploaded media flows by type, size, and API-signed upload rules.
- Avoid exposing customer PII in URLs, logs, analytics, error reports, or warehouse views.
- Mask payment, mobile, email, bank/UPI, and address data according to role.
- Send a **double-submit CSRF token on refresh and on every cookie-authenticated mutation**. This is mandatory, not conditional — the refresh endpoint is cookie-authenticated, so the authentication model requires it by construction.
- Expire sensitive query caches on logout, role/permission change, scope change, or account switch.
- Mask restricted fields in the API response as well as the UI; warehouse and support roles must not receive unnecessary PII or financial data.
- Require confirmation, permission revalidation, and reason capture for destructive admin actions.

---

## 17. Testing and quality gates

### 17.1 Test layers

| Layer | Required coverage |
|---|---|
| Unit | Formatters, query keys, reducers, permission utilities, calculations used only for display |
| Component | Commerce states, form errors, dialogs, tables, scanner feedback, CMS blocks |
| Contract | API envelope parsing, Zod response boundaries, error normalization |
| Integration | Query/mutation behavior, auth refresh queue, cart replacement, checkout steps |
| E2E | All critical flows listed below |
| Accessibility | axe plus manual keyboard/screen-reader pass |
| Performance | Lighthouse CI and bundle budgets |
| Visual | Storefront and `/admin` reference screenshots at required breakpoints |

### 17.2 Mandatory Playwright journeys

- Register/login → guest-local wishlist synchronization → preserved Add-to-Bag intent resumes once.
- Discovery → variant selection → add to cart.
- Guest Add to Bag, Move to Bag, cart URL and checkout URL all require login and preserve a safe return intent.
- Authenticated prepaid checkout; unauthenticated order/payment API calls return `401` without creating rows.
- COD checkout and ineligible COD explanation.
- Payment failure → retry → success.
- Payment verification pending and tab-close recovery.
- Admin payment overview → transaction detail → immutable attempt/webhook timeline.
- Payment mismatch review → provider re-query → reasoned resolution with audit entry.
- Settlement/COD-remittance import → auto-match → manual exception → reconciliation completion.
- Refund request → permission-gated approval → retry/completion; support cannot approve.
- Coupon apply and every rejection class.
- Last-unit concurrency produces one successful order and one stock conflict.
- Order tracking update and NDR reschedule.
- Cancellation → refund.
- Return → pickup → QC → restock → refund.
- Exchange with replacement reservation and price difference.
- Review submission and moderation.
- Product draft → blocked publish → valid publish.
- Pick → pack → label → manifest → dispatch.
- Wrong barcode and short-pick recovery.
- CMS draft → preview → schedule/publish → revert.
- Support ticket escalation and permission-restricted refund request.
- Staff login → first permitted `/admin` page; customer credentials cannot create a staff session.
- Direct navigation to an unauthorized `/admin/**` URL returns `/admin/forbidden` without rendering protected data.
- Role navigation shows only permitted destinations for `SUPPORT`, `WAREHOUSE`, `MANAGER`, and `ADMIN`.
- Support cannot approve refunds; warehouse cannot read finance or unmasked customer PII; manager cannot manage staff, roles, or protected settings.
- API calls made by a forged or stale UI action return `403` and leave cached data consistent.
- Role/permission revocation during a session clears protected caches, rebuilds navigation, and blocks the next page/action request.
- Warehouse assignment and customer/order ownership scopes prevent cross-scope record access.

### 17.3 Definition of done per feature

- Typed API and UI contracts.
- Loading, empty, success, error, conflict, permission, and offline states.
- Responsive behavior at 360, 480, 768, 992, 1440, and 1920 px.
- Keyboard and screen-reader semantics.
- Analytics and error reporting.
- Unit/component tests and critical E2E coverage.
- Documentation for route, permissions, query keys, mutations, and edge cases.
- No regression against performance budgets.

---

## 18. Recommended frontend source structure

```text
frontend/
├── public/
│   ├── fonts/
│   ├── icons/
│   ├── images/
│   └── manifest/
├── src/
│   ├── app/                         # route groups from §4
│   ├── components/
│   │   ├── ui/                      # shadcn/Radix primitives
│   │   ├── commerce/
│   │   ├── admin/
│   │   ├── common/
│   │   └── layout/
│   ├── features/
│   │   ├── 01-users/
│   │   ├── 02-products/
│   │   ├── 03-inventory/
│   │   ├── 04-cart/
│   │   ├── 05-wishlist/
│   │   ├── 06-search/
│   │   ├── 07-orders/
│   │   ├── 08-tracking/
│   │   ├── 09-payment/
│   │   ├── 10-coupons/
│   │   ├── 11-reviews/
│   │   ├── 12-recommendations/
│   │   ├── 13-notifications/
│   │   ├── 14-support/
│   │   ├── 15-dashboard/
│   │   ├── 16-analytics/
│   │   ├── 17-shipping/
│   │   ├── 18-returns/
│   │   ├── 19a-cms-read/
│   │   ├── 19b-cms-admin/
│   │   └── 20-auth-security/
│   ├── api/
│   ├── providers/
│   ├── hooks/
│   ├── lib/
│   │   ├── analytics/
│   │   ├── auth/
│   │   ├── errors/
│   │   ├── permissions/
│   │   ├── query/
│   │   └── seo/
│   ├── styles/
│   │   ├── index.css
│   │   ├── base/
│   │   ├── themes/
│   │   ├── components/
│   │   └── utilities/
│   ├── config/
│   ├── constants/
│   └── types/
├── e2e/
├── tests/
└── package.json
```

---

## 19. Delivery phases

The frontend follows backend dependency order while shipping coherent vertical slices.

| Phase | Scope | Exit outcome |
|---|---|---|
| 0 | Tooling, tokens (**including `--state-warning` and `--state-info`**), primitives, API client, Query, auth shell, `RouteGuard`, testing | Stable foundation and CI gates |
| 1 | Auth/security, users, storefront shell, **CMS read (19a)** | Browseable branded home and working identity |
| 2 | Products, categories, search, PDP, inventory availability | Complete discovery and variant evaluation |
| 3 | Cart, wishlist, coupons, recommendations | Persistent pre-purchase journey |
| 4 | Shipping, authenticated checkout, payment, order confirmation | Verified-customer purchase path with mandatory login gate |
| 5 | Account orders, tracking, cancellation, notifications | Complete post-purchase visibility |
| 6 | Returns, exchanges, refunds, reviews, support | Complete customer lifecycle |
| 7 | `/admin` shell, dashboard, orders, catalog, inventory | Core merchant operations |
| 8 | Warehouse, shipping/NDR, return QC, refund approvals | End-to-end fulfilment and reverse logistics |
| 9 | **CMS authoring (19b)**, coupons, notifications, analytics, staff/RBAC | Full business control plane |
| 10 | PWA hardening, SSE, performance, accessibility, security, UAT | Production readiness |

Module 19 is split because the homepage is CMS-driven from Phase 1 while the block editor is not needed until Phase 9. **19a — CMS Read** is the public block API plus the typed client block registry, seeded from fixtures. **19b — CMS Authoring** is the editor, versioning, preview, scheduling, revert, and redirects.

### 19.2 Phase cross-map

These 11 frontend phases, the blueprint's 13, and `database.md`'s 10 implementation steps measure different things and are not in conflict. The mapping:

| `frontend.md` phase (11) | Blueprint phase (13) | `database.md` step (10) |
|---|---|---|
| 0 · Tooling, tokens, primitives | 6 · Design system | — |
| 1 · Auth, users, storefront shell, CMS read (19a) | 7 · Frontend architecture | 2 · Identity, catalog, inventory |
| 2 · Products, search, PDP | 8 · Backend architecture | 2 · Identity, catalog, inventory |
| 3 · Cart, wishlist, coupons | 8 · Backend architecture | 3 · Cart, checkout, orders |
| 4 · Shipping, checkout, payment | 9 · Commerce build-out | 4 · Payments & money path |
| 5 · Orders, tracking, cancellation | 9 · Commerce build-out | 5 · Shipping & fulfilment |
| 6 · Returns, reviews, support | 9 · Commerce build-out | 6–7 · Returns, refunds, coupons |
| 7 · Admin shell, dashboard, catalog | 10–11 · Growth and ops build-out | 8 · CMS, reviews, notifications |
| 8 · Warehouse, NDR, QC, refunds | 11 · Ops build-out | 9 · Admin, audit, analytics |
| 9 · CMS authoring (19b), coupons, RBAC | 11 · Ops build-out | 9 · Admin, audit, analytics |
| 10 · Hardening, accessibility, UAT | 12–13 · Testing, launch | 10 · Hardening, backup, PITR drill |

### 19.1 Release strategy

- Feature flags protect unfinished modules and high-risk payment/fulfilment changes.
- Seeded demo data covers every state before UAT.
- Storefront can launch only when the purchase and recovery paths are complete.
- The `/admin` portal can launch only when route/action/API authorization, resource scopes, audit history, and queue recovery states are complete.
- Every fixed production bug receives a failing automated test before the fix.

---

## 20. Frontend acceptance checklist

- [ ] All 20 modules (19 split into 19a/19b) have an owned feature folder and route/component entry points.
- [ ] **No Next.js middleware exists in the repository.** `<RouteGuard>` covers `/cart`, `/checkout/**`, `/account/**`, and `/admin/**`, and renders a skeleton while the session resolves.
- [ ] `--state-warning` and `--state-info` exist in `tokens.css` with verified AA contrast on `#121212`.
- [ ] The access token lives in JavaScript memory only; the refresh token is an `HttpOnly` path-scoped cookie; CSRF double-submit tokens accompany refresh and every cookie-authenticated mutation.
- [ ] All documented frontend journeys have loading, success, conflict, failure, and recovery states.
- [ ] The complete page inventory in §4.2 is implemented; every future page is registered with its role, permission, render mode, API dependencies, states, and tests.
- [ ] `/admin` is the only staff route prefix; `/admin/login` is the staff entry point and protected pages use `/admin/**`.
- [ ] Every `/admin/**` page is deny-by-default and declares a required permission; unauthorized direct URLs reach `/admin/forbidden` without protected data.
- [ ] Page, navigation, action, API, row/resource, and field-level authorization pass for `SUPPORT`, `WAREHOUSE`, `MANAGER`, and `ADMIN`.
- [ ] Customer and staff sessions are separate; permission revocation clears protected caches immediately.
- [ ] Public catalog/editorial pages are CSR-only and update metadata/structured data in the browser after route data resolves.
- [ ] Every route crosses a Client Component boundary and all domain requests begin only after browser startup.
- [ ] The deployment output contains a generic application shell but no route-specific commerce, CMS, customer, or admin HTML.
- [ ] CI rejects route or layout code that fetches domain data outside the browser Axios/TanStack Query layer.
- [ ] Cart, checkout, account, tracking, and `/admin` are `noindex` and `no-store` as required.
- [ ] Cart and checkout totals always come from the API.
- [ ] Guests can browse/search/view products and use the local wishlist, but Add to Bag, Move to Bag, `/cart`, `/checkout/**`, payment initiation and order creation all require a verified customer session.
- [ ] Login/register preserves only an allow-listed return URL and one signed product/variant intent, synchronizes the wishlist, revalidates stock/price, and resumes at most once.
- [ ] Sold-out sizes stay visible, disabled, and struck through.
- [ ] Payment UI handles pending verification without creating duplicate orders.
- [ ] `/admin/payments` includes overview, transaction/detail, refund/detail, mismatch, reconciliation and settlement-detail pages with the documented permissions, masked fields, audit history and recovery states.
- [ ] Tracking, returns, and refunds show durable timelines/ledgers.
- [ ] Admin queues, full RBAC enforcement, resource scopes, field masking, and activity/audit trails are implemented.
- [ ] Scanner flows work with keyboard-wedge hardware and rugged mobile layouts.
- [ ] CMS output renders only typed, validated blocks.
- [ ] WCAG 2.1 AA, reduced motion, keyboard operation, and 44 px touch targets pass.
- [ ] LCP, INP, CLS, JS, image, font, and third-party budgets pass CI.
- [ ] Mandatory Playwright journeys pass against seeded data.
- [ ] No secret, token, PII, or authoritative commerce calculation leaks into client storage or logs.

---

## 21. Final frontend principle

Every Iced_out interface must answer three questions clearly:

1. **What is true right now?** — current price, stock, payment, shipment, refund, task, or permission state.
2. **What can this person do next?** — one safe, role-appropriate primary action.
3. **What happens if it fails?** — an explicit recovery path that preserves context and never creates duplicate money, stock, or work.

That rule applies equally to a shopper choosing the last Black/M hoodie and a warehouse operator resolving a short pick. The visual language makes the product feel premium; the state and recovery design make the platform trustworthy.