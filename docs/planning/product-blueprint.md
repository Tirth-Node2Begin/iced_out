# 🧊 Iced-Out — Premium Clothing E-Commerce Platform

> **Enterprise-grade, cloud-delivered e-commerce system for a premium streetwear brand — an API-first commerce engine powering a dark, editorial storefront, a complete order & inventory back office, and a merchant admin console.**

**Version:** `1.0` &nbsp;·&nbsp; **Status:** `Documentation & Architecture Phase` &nbsp;·&nbsp; **Last Updated:** `August 2026`
**Design Language:** `Iced-Out` — see the [`style guide`](../../design/docs/style-guide.md), [`design tokens`](../../design/styles/tokens/tokens.css), and [`Tailwind configuration`](../../design/config/tailwind.config.js)

---

## 📑 Table of Contents

1. Project Overview
2. Module Map — the 20 Modules
3. Problem Statement
4. Target Market & Personas
5. Project Vision
6. Primary Objectives
7. Non-Functional Requirements (NFRs)
8. Technology Stack
9. System Architecture
10. Development Principles
11. Project Structure
12. Documentation Repository
13. Core Modules — summary (1 → 20)
14. **End-to-End Flows — the complete commerce lifecycle**
15. Real-Time, Resilience & Offline Strategy
16. CSR Storefront Discoverability & Performance Doctrine
17. Third-Party Integrations
18. Hardware & Peripheral Support
19. UI/UX Vision — the Iced-Out Design Language
20. Database Standards & Documentation
21. API Standards & Documentation
22. Security Standards
23. Localization, Tax & Compliance
24. Testing Strategy
25. DevOps & Deployment
26. Development Roadmap
27. Success Metrics
28. Expected Documentation Size
29. Glossary
30. Final Goal

---

# 📌 Project Overview

Iced-Out is a **complete e-commerce ecosystem for a premium clothing brand** — not a storefront template and not a shopping-cart plugin.

Every commercial operation, from a shopper's first impression on the homepage to the brand owner's month-end revenue report, runs through one centralized, API-first platform built on **20 core modules**.

The platform ships as **two products on one API**:

| Product | Audience | Rendering | Purpose |
|---|---|---|---|
| **Storefront** | Customers (public web + PWA) | CSR-only SPA | Browse, discover, buy, track, review, return |
| **Admin Console** | Admin · Manager · Warehouse Staff · Support | CSR-only SPA | Run catalog, inventory, orders, shipping, CMS, analytics |

### System Coverage at a Glance

| Domain | Modules | Capabilities |
|---|---|---|
| **Identity** | 1, 20 | Registration, social login, profiles, addresses, JWT, RBAC, rate limiting |
| **Catalog** | 2, 3 | Products, categories, size/colour/material variants, media, SKUs, stock by variant |
| **Discovery** | 5, 6, 12 | Search, suggestions, filters, sorting, wishlist, recommendations, recently viewed |
| **Buying** | 4, 9, 10 | Authenticated cart, persistence, coupons, shipping calculation, Razorpay/Stripe/PayPal, COD |
| **Fulfillment** | 7, 8, 17, 18 | Order lifecycle, tracking, couriers, delivery zones, returns, exchanges, refunds |
| **Engagement** | 11, 13, 14 | Reviews & ratings, email/SMS/push notifications, support tickets & chat |
| **Operations** | 15, 16, 19a, 19b | Admin dashboard, payment operations, sales & inventory reports, CMS for storefront pages and banners |

---

# 🗺 Module Map — the 20 Modules

| # | Module | Primary Actor | Depends On |
|---|---|---|---|
| 1 | 👤 **User Management** | Customer | 20 |
| 2 | 👕 **Product Management** | Admin / Manager | 20 |
| 3 | 📦 **Inventory Management** | Manager / Warehouse Staff | 2 |
| 4 | 🛒 **Shopping Cart** | Customer | 2, 3, 10, 17 |
| 5 | ❤️ **Wishlist** | Customer | 2, 13 |
| 6 | 🔍 **Search & Filter** | Customer | 2, 3, 11 |
| 7 | 📋 **Order Management** | Customer / Manager | 3, 4, 9, 17 |
| 8 | 🚚 **Order Tracking** | Customer / Warehouse | 7, 17 |
| 9 | 💳 **Payment** | Customer | 7 |
| 10 | 🎟️ **Coupon & Discount** | Admin / Customer | 1, 4 |
| 11 | ⭐ **Review & Rating** | Customer / Manager | 1, 2, 7 |
| 12 | 🤖 **Recommendation System** | Customer | 2, 6, 7 |
| 13 | 🔔 **Notification** | System | 1, 3, 5, 7, 10 |
| 14 | 💬 **Customer Support** | Customer / Support | 1, 7 |
| 15 | ⚙️ **Admin Dashboard** | Admin / Manager | all |
| 16 | 📊 **Analytics & Reports** | Admin | 2, 3, 7, 9 |
| 17 | 🚛 **Shipping Management** | Manager | 7, 8 |
| 18 | 🔄 **Return & Refund** | Customer / Manager | 7, 9, 3 |
| 19a | 📝 **CMS — Read** | System (renders for Customer) | 2 |
| 19b | 📝 **CMS — Authoring** | Admin / Manager | 19a |
| 20 | 🔐 **Authentication & Security** | Platform | — |

**Build order:** `20 → 1 → 19a → 2 → 3 → 6 → 4 → 10 → 9 → 7 → 17 → 8 → 18 → 13 → 5 → 11 → 12 → 15 → 16 → 19b → 14`

> **Module 19 is split, and the count stays at 20.** The homepage is CMS-driven from Phase 1, but the block editor is not needed until Phase 9, so one undivided CMS module scheduled last made a browsable Phase 1 homepage impossible. **19a — CMS Read** is the public block API plus a typed client block registry, seeded from fixtures, and ships in Phase 1. **19b — CMS Authoring** is the block editor, versioning, preview, scheduling, revert, and redirects, and ships in Phase 9.

---

# 🚨 Problem Statement

Most growing D2C clothing brands run commerce on a patchwork of disconnected tools — a hosted storefront here, a spreadsheet of stock there, courier portals in six browser tabs, and a WhatsApp group standing in for an order management system. The result:

- **Fragmented operations** — storefront, inventory, and shipping never agree on the truth
- **Oversell & stockouts** — apparel sells by *size and colour*, but most systems track stock at product level, so "Black Hoodie – M" sells three times over
- **Checkout leakage** — 60–75% cart abandonment with no recovery mechanism and no diagnosis of *where* it broke
- **Return blindness** — apparel returns run 25–40%, yet nobody knows which SKU or size caused them, so the size chart never improves
- **COD & RTO bleed** — cash-on-delivery orders ship without risk checks, then return at full freight cost
- **Zero real-time visibility** — the owner learns about a bad week from the bank statement, not a dashboard
- **Manual reconciliation** — gateway settlements, COD remittances, refunds, and GST reconciled by hand
- **Weak retention** — customer data exists but is never segmented, so repeat purchase is left to luck
- **No discovery** — no search suggestions, no facets, no recommendations; shoppers see 400 products and buy none
- **Weak discoverability controls** — unstable URLs, incomplete metadata, and missing structured data make a client-rendered catalog harder for search engines to understand

**This platform solves all of the above with one unified, real-time, API-first commerce system.**

---

# 🏪 Target Market & Personas

### Market segments

| Segment | Examples | Critical Needs |
|---|---|---|
| **D2C Streetwear & Apparel** | Iced-Out and peers | Size/colour matrices, size charts, drops, curated collections, return control |
| **Fashion & Accessories** | Jewellery, footwear, eyewear | Rich media, zoom, colourways, gifting, high-AOV trust signals |
| **Multi-Category Lifestyle** | Apparel + accessories + footwear | Deep category trees, cross-sell, bundled recommendations |
| **Premium & Limited-Drop Brands** | Capsule collections | Stock scarcity, restock alerts, early-access campaigns |

### Personas & role matrix

| Persona | Role | Lives In | Owns |
|---|---|---|---|
| **Shopper** | `CUSTOMER` | Storefront | Account, addresses, authenticated cart, wishlist, orders, returns, reviews, preferences |
| **Brand Owner** | `ADMIN` | Console | Everything — full access, financial reports, staff management, settings |
| **Store Manager** | `MANAGER` | Console | Catalog, pricing, coupons, orders, returns, reviews, CMS — no staff/settings |
| **Warehouse Staff** | `WAREHOUSE` | Console (scanner-first) | Stock, pick/pack, dispatch, return QC — no pricing, no customer PII beyond ship-to |
| **Support Agent** | `SUPPORT` | Console (tickets-first) | Tickets, chat, order lookup, refund *requests* — cannot approve refunds |

---

# 🎯 Project Vision

Build one of the **most premium, scalable, modern, and maintainable clothing e-commerce platforms** — with enterprise-level architecture and a genuinely luxurious shopping experience.

This project is **NOT** a clone of Shopify, WooCommerce, or Magento.

Those platforms serve as business inspiration; this system improves on them with:

- Cleaner architecture (thin controllers, service-owned business rules, safe repositories)
- Better shopping experience (dark, editorial, fast, accessible — the Iced-Out design language)
- Better performance (CSR-only storefront, CDN-hosted static assets, cached catalog reads, sub-300 ms API p95)
- Better code organization (feature modules, shared contracts, mirrored validation)
- Better scalability (queue-backed, horizontally scalable, drop-day ready)
- Better developer experience (typed end-to-end, contract-first, documented per endpoint)
- Modern technologies with no framework lock-in on the backend
- **Variant-level inventory truth** — stock is a fact about *Black / M*, never about "the hoodie"
- Enterprise-grade documentation as a first-class deliverable

---

# 🎯 Primary Objectives

### Business Objectives

- Run the **entire brand** — catalog, stock, orders, shipping, returns, marketing, support — on one platform
- Measurably raise **conversion rate** and **average order value**; measurably cut **cart abandonment** and **RTO**
- Guarantee **one source of inventory truth** at size × colour granularity — zero oversell
- Give the owner **real-time revenue, stock, and fulfillment visibility** from any device
- Turn first-time buyers into repeat customers through wishlist and lifecycle notifications
- Keep the business **GST-compliant and audit-ready by default**
- Reduce return rate through better size guidance, richer media, and verified review signal

### Technical Objectives

- Enterprise ready · modular architecture · high performance
- API-first development — one API serves storefront, console, scanner app, and future mobile apps
- Idempotent, replay-safe money paths (payments, refunds, stock decrements)
- Scalable codebase · maintainable structure · premium UI/UX
- CSR-only storefront with client-managed metadata, structured data, and Core Web Vitals budgets
- Future ready & easy to extend · mobile-first (responsive + PWA)

---

# 📏 Non-Functional Requirements (NFRs)

| Category | Target |
|---|---|
| API Performance | p95 ≤ **300 ms** for core endpoints; ≤ **150 ms** for catalog reads (cached) |
| Storefront Performance | LCP ≤ **2.0 s** · INP ≤ **200 ms** · CLS ≤ **0.1** on 4G mid-range mobile |
| Checkout Speed | Cart → order confirmation in ≤ **60 seconds** for a returning customer |
| Search Latency | Faceted search results in ≤ **200 ms** for catalogs up to 100k SKUs |
| Availability | **99.9%** uptime overall · **99.95%** for checkout & payment paths |
| Inventory Accuracy | Stock reflected across storefront in ≤ **5 seconds**; oversell rate ≤ **0.1%** of units |
| Scalability | 5,000 req/s peak (drop events) · 1M+ orders/year · 500k SKU-variants |
| Data Safety | Transactional writes on all money/stock paths · RPO ≤ **5 min** · RTO ≤ **1 hour** |
| Security | OWASP Top 10 compliant · PCI-DSS SAQ-A posture · encrypted secrets · full audit trail |
| Usability | A new ops user can process an order end-to-end within **30 minutes** of training |
| Compatibility | Latest 2 versions of Chrome/Edge/Firefox/Safari · iOS 15+ / Android 10+ · warehouse Android scanners |
| Accessibility | **WCAG 2.1 AA** across storefront and console — checkout is AA-mandatory, no exceptions |
| Discoverability | 100% of PDPs, destination pages, and collection pages use stable URLs, client-managed metadata, and valid `Product` structured data after API data loads |

---

# 🛠 Technology Stack

## Frontend

| Layer | Technology | Purpose |
|---|---|---|
| Framework | **Next.js 16** (App Router), `output: 'export'` | CSR-only storefront and admin application shells. **No Next.js middleware anywhere in the project** |
| UI Library | **React 19** | Component model |
| Language | **TypeScript 5** (strict mode) | End-to-end type safety |
| Styling | **Tailwind CSS 4** | Utility-first styling driven by `design/config/tailwind.config.js` + `design/styles/tokens/tokens.css` |
| Components | **shadcn/ui** + Radix Primitives | Accessible base, restyled to Iced-Out tokens |
| Animation | **Framer Motion** | Reveal choreography & micro-interactions (150–500 ms, per §19) |
| Server State | **TanStack Query v5** | API caching, retries, optimistic updates |
| Client State | **React Context API** | Auth, cart, wishlist, theme, UI state |
| Forms | **React Hook Form + Zod** | Checkout, address, and admin forms with schema validation |
| HTTP Client | **Axios** | Interceptors for auth, token refresh, error normalization |
| Data Tables | **TanStack Table** | Orders, inventory, and catalog grids in the console |
| Charts | **Recharts / Apache ECharts** | Dashboard & analytics (Module 15, 16) |
| Icons | **Lucide React** | Consistent icon system (1.5 px stroke, per §19) |
| Dates | **date-fns** | Date/time utilities and IST formatting |

**Developer Tooling:** ESLint · Prettier · Husky + lint-staged · Commitlint (Conventional Commits) · Vitest + React Testing Library · Playwright · Lighthouse CI

### Rendering Strategy — CSR only

| Surface | Strategy | Why |
|---|---|---|
| **Storefront** — home, New Drop, Men, Women, Collections, Sale, PDP, About, Contact | **CSR-only SPA** | The browser loads the static application shell, fetches JSON from REST endpoints, and renders every page client-side. |
| **Storefront** — cart, checkout, account, order tracking | **CSR-only SPA** (`no-store`, `noindex`) | Personal, session-bound, never publicly cacheable. |
| **Admin** — every admin/ops screen under `/admin` | **CSR-only SPA** | Behind staff authentication and RBAC; ships as static assets to a CDN. |

> **Documented decision.** Every frontend surface is CSR-only. The team accepts that some crawlers and social preview agents do not execute JavaScript; per-route metadata and structured data appear after the client loads route data. No alternate page-rendering path may be introduced without an explicit architecture change.

All route content, loading states, metadata updates, and structured-data injection execute in the browser. Route files provide only the client application boundary and static shell; page data is never assembled during deployment or an incoming page request.

**CSR-only invariant:** every route enters through a Client Component boundary; all commerce and CMS data fetching begins only after the browser application starts. Build jobs may produce JavaScript, CSS, fonts, images, and a generic application shell, but never route-specific product, destination, collection, content, customer, or admin HTML. CI must reject frontend route code that fetches domain data outside the browser API/query layer.

**What stays true regardless:** the backend serves **JSON only, never HTML**. Next.js consumes the same REST API that the warehouse scanner app and the future mobile app consume. No server actions writing to the database, no ORM in the frontend, no business logic in the rendering layer.

**No Next.js middleware, anywhere:** middleware is a server/edge runtime feature, and a static export has no runtime to execute it — adopting an edge runtime to get it back would re-introduce the server-rendering path this section forbids. Route guards for `/cart`, `/checkout/**`, `/account/**`, and `/admin/**` are therefore **100% client-side**: a `<RouteGuard>` inside the client layout blocks render and redirects. This costs nothing in security, because the API is the only real authorization boundary and hidden UI is never a security control; it costs a brief flash on a protected route, which the guard covers with a skeleton. `next.config` uses `output: 'export'`, and `sitemap.xml`, `robots.txt`, and redirects are served by the **backend/CDN**, never by Next.js route handlers.

---

## Backend

**Core PHP 8.3+** — no framework, full architectural control.

**Standards:** Composer (PSR-4 autoloading) · PSR-12 coding style · PHPStan (static analysis) · PHPUnit

### Layered Architecture

```
            HTTP Request
                 ↓
     Router (Front Controller)
                 ↓
        Middleware Pipeline
 (auth · rbac · rate-limit · idempotency · cors · validation · logging)
                 ↓
            Controllers          → thin, HTTP-only
                 ↓
             Services            → business logic & transactions
                 ↓
           Repositories          → all SQL lives here
                 ↓
              Models             → typed entities
                 ↓
         MySQL 8 (InnoDB)
```

### Backend Responsibilities

- REST APIs (storefront-public, storefront-session, console-private, webhooks)
- Authentication & authorization (customer sessions + staff RBAC + API keys) — Module 20
- Business logic: pricing, coupons, tax, shipping rates, inventory allocation
- Database transactions and money-path integrity
- Background jobs & scheduled tasks (queue workers + cron)
- Notifications — email / SMS / WhatsApp / web push — Module 13
- Invoice, credit note, packing slip, shipping label & PDF/Excel generation
- Webhook ingestion (payment gateways, couriers) & outbound webhooks
- Integration adapters (Razorpay, Stripe, PayPal, Shiprocket, Delhivery, messaging)
- Search indexing, catalog denormalization, and cache invalidation
- Media storage, image derivatives (WebP/AVIF), and exports

---

## Database

**MySQL 8.0+** (8.4 LTS recommended) · InnoDB · `utf8mb4`

Expected Database Size: **≈120 Tables (121 exact)**

The baseline moved from 120 to 121 when `payment_reconciliation_cases` was added — `/admin/payments/mismatches` needs an assignee, an SLA clock, a decision, a reason, and a resolution actor, none of which a `payments.status = 'MISMATCH'` flag can hold.

### Database Standards

- Normalized schema (3NF), with **justified denormalized read models** for catalog, cart, and analytics
- Foreign keys & referential integrity
- Composite indexes on every hot read path (`product_id, size_id, color_id`)
- ACID transactions for every money and stock write
- Views for reporting; materialized summary tables for dashboards
- Stored procedures & triggers only where genuinely justified (documented case-by-case)
- Audit tables with JSON diffs
- Soft deletes (`deleted_at`) on catalog and customer data; **hard-append** on ledgers
- Versioned migrations + seed data

---

## Search

**Meilisearch or Typesense** — self-hosted, rebuilt from `domain_events_outbox`.

The faceted-search NFR is ≤200 ms at 100k SKUs. MySQL `FULLTEXT` is an **emergency fallback only** and will not meet that budget once facets are applied, so it is never the target. Pick between Meilisearch and Typesense before Phase 2 — both meet the NFR and the choice is operational preference. PDP stock always comes from live inventory, never from the search document.

---

## Caching, Queues & Background Jobs

- **Redis:** catalog & facet cache, **cart read cache**, session/refresh-token store, rate limiting, distributed locks (stock reservations), job queue
- **Fallback:** MySQL-backed queue table for constrained hosting
- **Queue workers:** order confirmation, payment reconciliation, label generation, search reindex, email/SMS/push dispatch, image derivatives, recommendation rebuilds
- **Cron:** abandoned-cart sweeps, reservation expiry, low-stock alerts, settlement import, sitemap regeneration, nightly reports, backups
- **Locks:** stock decrement and invoice-number allocation are lock-protected; every consumer is idempotent

---

## State Management

- **Context API** — auth session, cart, wishlist, theme, UI preferences
- **TanStack Query** — all server state (single source of truth for API data)
- **Cart** — server-authoritative, resolved **only** from the authenticated customer session (`carts.user_id`); the client never computes final prices, discounts, shipping, or tax
- **No anonymous cart identifier of any kind** — no cart token, no cookie, no row. A cart token is precisely the mechanism by which guest carts return, and guests cannot hold a cart

---

## API Communication

REST APIs — JSON over HTTPS.

```
Storefront (Next.js CSR SPA)   Admin (Next.js CSR SPA)   Scanner / Mobile
              └──────────────────────┬─────────────────────────┘
                                     ↓
                            REST API (/api/v1)
                                     ↓
                              Core PHP 8.3+
                                     ↓
                                 Services
                                     ↓
                               Repositories
                                     ↓
                                  MySQL 8
```

---

# 🏛 System Architecture

```
┌──────────────────────────────── CLIENTS ─────────────────────────────────────┐
│  Storefront (CSR + PWA)      │  Admin Portal (CSR)   │  Warehouse Scanner App │
│  Customer Order-Tracking     │  Support Desk         │  Future Mobile App     │
└─────────────────────────────────────┬─────────────────────────────────────────┘
                                      │  HTTPS · REST (JSON) · JWT / API key
┌─────────────────────────────────────▼─────────────────────────────────────────┐
│                      EDGE — CDN · WAF · Image CDN · Rate limit                 │
└─────────────────────────────────────┬─────────────────────────────────────────┘
                                      ▼
┌───────────────────────────────────────────────────────────────────────────────┐
│                      API LAYER — Nginx → PHP-FPM (8.3+)                        │
│  Router → Middleware (auth · rbac · idempotency · rate-limit · validation)     │
│         → Controllers → Services → Repositories → Models                       │
└──────┬─────────────────┬──────────────────┬──────────────────┬────────────────┘
       │                 │                  │                  │
   MySQL 8            Redis          Object Storage      Queue / Cron Workers
 (primary DB)  (cache·cart·locks·  (media·invoices·   (sync·labels·emails·
                queue·tokens)       labels·exports)     reindex·reports)
                                      ▲
              Webhooks (in/out) ──────┘
   Razorpay · Stripe · PayPal · Shiprocket · Delhivery · Bluedart ·
   WhatsApp Business API · SMS · SMTP · Web Push · GA4 / Meta Pixel
```

### Request Lifecycle

1. Browser client sends request with JWT / session token → 2. Edge applies WAF, rate limits, and cache rules → 3. Router resolves the API route → 4. Middleware validates token, checks permissions, enforces idempotency → 5. Controller validates input → 6. Service executes business logic inside a transaction → 7. Repository performs SQL → 8. Events emit to queues (notifications, webhooks, search reindex) → 9. Standard JSON envelope returns → 10. TanStack Query caches the response and React updates the browser UI.

---

# 🏗 Development Principles

### Architecture
- Modular architecture · feature-based folder structure · API-first development
- Component-driven development · separation of concerns
- **One engine per concern** — one pricing engine, one coupon engine, one stock engine. No screen gets its own copy.

### Code Quality
- Clean Code · SOLID · DRY · KISS
- Strict typing everywhere (TypeScript strict + PHP declared types)
- Code review required on every merge; money-path changes require two reviewers

### Reusability
- Reusable components · reusable hooks · reusable API clients
- Shared validators (Zod ↔ backend validators kept in sync, contract-tested)

### Operations
- 12-Factor configuration (env-driven, no secrets in code)
- Every feature ships with documentation + tests
- Backwards-compatible API evolution; deprecations announced with a sunset header

---

# 📂 Project Structure

```
iced-out/
├── README.md
├── INFO.md
├── CHANGELOG.md
├── ROADMAP.md
├── CONTRIBUTING.md
│
├── frontend/
│   ├── public/
│   └── src/
│       ├── app/
│       │   ├── (storefront)/        # CSR-only — public storefront
│       │   │   ├── page.tsx                     # Home (CMS-driven, 19a)
│       │   │   ├── new-drop/                    # Latest published drop
│       │   │   ├── men/                         # Men's destination
│       │   │   ├── women/                       # Women's destination
│       │   │   ├── collections/                 # Collection index + [slug]
│       │   │   ├── sale/                        # Discounted assortment
│       │   │   ├── product/[slug]/              # PDP
│       │   │   ├── search/
│       │   │   ├── about/
│       │   │   ├── contact/
│       │   │   ├── track/[token]/               # Tokenised order tracking
│       │   │   └── pages/[slug]/                # CMS content pages (19a)
│       │   ├── (customer-auth)/     # CSR — login, register, forgot/reset password
│       │   ├── (customer-session)/  # CSR — cart, checkout, account
│       │   ├── (staff-auth)/admin/  # CSR — staff login, forgot/reset, forbidden
│       │   └── (admin)/admin/       # CSR-only SPA — admin + ops
│       ├── components/
│       │   ├── ui/                  # shadcn/ui primitives, restyled to tokens
│       │   ├── commerce/            # ProductCard, PriceTag, SizePill, CartLine…
│       │   ├── common/              # Buttons, cards, tables, empty states
│       │   └── layout/              # Shells, navbar, mega-menu, footer, cart drawer
│       ├── features/                # One folder per module
│       │   │                        # 01-users … 19a-cms-read, 19b-cms-admin, 20-auth-security
│       │   └── <module>/
│       │       ├── components/
│       │       ├── hooks/
│       │       ├── api/
│       │       ├── schemas/         # Zod boundary schemas — load-bearing, not optional
│       │       ├── types/
│       │       ├── utils/
│       │       └── index.ts         # The module's public surface
│       ├── hooks/
│       ├── lib/                     # axios client, query client, seo, analytics
│       ├── providers/               # Auth, Cart, Wishlist, Theme contexts
│       ├── constants/
│       ├── config/
│       ├── styles/                  # tokens.css lives here
│       └── types/
│
├── backend/
│   ├── public/                      # index.php (front controller)
│   ├── app/
│   │   ├── Controllers/
│   │   │   ├── Storefront/          # catalog, cart, checkout, account
│   │   │   ├── Console/             # products, inventory, orders, CMS, reports
│   │   │   └── Webhooks/            # payments, couriers
│   │   ├── Services/
│   │   │   ├── Pricing/  Coupons/  Tax/  Inventory/  Shipping/
│   │   │   ├── Checkout/ Payments/ Orders/ Returns/
│   │   │   └── Search/   Recommendations/ Notifications/ Analytics/
│   │   ├── Repositories/
│   │   ├── Models/
│   │   ├── Middleware/
│   │   ├── Validators/
│   │   ├── Integrations/            # Gateways, Couriers, Messaging
│   │   ├── Jobs/                    # Queue + cron workers
│   │   └── Helpers/
│   ├── config/
│   ├── routes/
│   ├── storage/                     # logs, uploads, invoices, labels, exports
│   └── tests/
│
├── database/
│   ├── migrations/
│   ├── seeds/
│   ├── views/
│   ├── procedures/
│   ├── triggers/
│   └── diagrams/
│
├── design/
│   ├── config/                     # Tailwind and design tooling
│   ├── docs/                       # design language reference
│   ├── styles/                     # tokens, themes, base, components, utilities
│   └── research/                   # audit prompts and captured evidence
│
├── docs/
└── assets/
```

---

# 📚 Documentation Repository

The documentation is the **single source of truth** for the entire development lifecycle.

```
docs/
├── 00-project/
├── 01-business/
├── 02-system-architecture/
├── 03-modules/             # one folder per module, 01 → 20
├── 04-database/
├── 05-api/
├── 06-ui-ux/
├── 07-development/
├── 08-testing/
├── 09-devops/
├── 10-integrations/
├── 11-security/
└── 12-flows/               # journeys, state machines, edge cases
```

### Documentation Scope

- Product & business documentation
- Software architecture & system design
- Database design & data dictionary
- API documentation (contract-first)
- UI documentation & UX guidelines, anchored to the Iced-Out design language
- Flow documentation — every journey, state machine, and edge case
- Development, deployment & testing guides
- Coding standards & naming conventions
- Integration playbooks (payments, couriers, messaging)
- Security policies, RBAC matrix & threat model
- Glossary & onboarding guide

---

# 📦 Core Modules — Summary

> Reference only. Each module is specified in full in `docs/03-modules/<nn>-<module>/`.
> **The depth of this document lives in §14 — Flows.**

| # | Module | Purpose | Key capabilities |
|---|---|---|---|
| 1 | 👤 **User Management** | Own the customer identity | Registration · login/logout · Google & Apple login · profile · multiple addresses · change password · account deletion · order history · saved payment methods |
| 2 | 👕 **Product Management** | The clothing catalog | CRUD · categories (T-Shirts · Hoodies · Jackets · Jeans · Sneakers) · variants (size · colour · material) · images & videos · description · pricing & discount pricing · SKU · tags · featured · new arrivals · best sellers |
| 3 | 📦 **Inventory Management** | One stock truth at size × colour | Stock quantity · size-wise · colour-wise · low-stock alerts · out-of-stock handling · stock history · inventory reports · warehouse management |
| 4 | 🛒 **Shopping Cart** | Hold and price intent | Add · remove · update quantity · save cart · persistence & merge · price calculation · coupons · shipping calculation |
| 5 | ❤️ **Wishlist** | Capture unconverted desire | Add · remove · move to cart · price-drop / back-in-stock / low-stock notifications |
| 6 | 🔍 **Search & Filter** | 400 products → the right 3 | Search · suggestions · filters (category · price · size · colour · brand · rating · availability) · sorting (newest · price ↑↓ · popularity) |
| 7 | 📋 **Order Management** | The order lifecycle | Create · cancel · return · refunds · invoice generation · order history · status machine |
| 8 | 🚚 **Order Tracking** | Answer WISMO before it's asked | Real-time status · tracking number · courier integration · delivery updates · estimated delivery date |
| 9 | 💳 **Payment** | Take money safely, return it cleanly | Online payments · COD · Razorpay / Stripe / PayPal · verification · refund processing · transaction history |
| 10 | 🎟️ **Coupon & Discount** | Precise, abuse-resistant promotions | Coupon creation · % discount · flat discount · minimum order value · expiry · user-specific coupons |
| 11 | ⭐ **Review & Rating** | Trust + fit signal | Ratings · reviews · image reviews · verified-purchase badge · moderation · fit feedback |
| 12 | 🤖 **Recommendation System** | Make the catalog feel curated | Similar products · recently viewed · recommended for you · trending |
| 13 | 🔔 **Notification** | Right message, right channel, right time | Email · SMS · push · WhatsApp — order, shipment, discount, wishlist price-drop, restock |
| 14 | 💬 **Customer Support** | Resolve before it becomes a refund | Contact support · live chat · FAQ · ticket system · chatbot |
| 15 | ⚙️ **Admin Dashboard** | The owner's cockpit | Sales · orders · revenue · customers · products · inventory · manage everything |
| 16 | 📊 **Analytics & Reports** | Data → decisions | Sales · revenue · product performance · customer behaviour · inventory · conversion rate |
| 17 | 🚛 **Shipping Management** | Parcel out the door, correctly priced | Providers · charges · delivery zones · tracking API · return shipping |
| 18 | 🔄 **Return & Refund** | Handle apparel's 25–40% reality | Return request · approval · refund processing · exchange management |
| 19a | 📝 **CMS — Read** | Render CMS-driven storefront pages | Public block API · typed client block registry · unknown blocks fail safely |
| 19b | 📝 **CMS — Authoring** | Change the store without a deploy | Hero banners · new-drop and collection sections · About · Contact · policy pages · promotional sections · versioning · preview · scheduling · revert · redirects |
| 20 | 🔐 **Authentication & Security** | The trust layer | JWT · roles (Admin · Manager · Customer · Warehouse) · password encryption · API protection · rate limiting · input validation |

---

# 🔁 End-to-End Flows

> This is the operational heart of the document. Every flow below is written as it will be built:
> **actors · numbered steps · system side-effects · data written · notifications fired · failure branches.**

### Flow index

| ID | Flow | Primary actor | Modules touched |
|---|---|---|---|
| **F0** | Master flow map | — | all |
| **F1** | Registration & Authentication | Customer | 1, 20 |
| **F2** | Discovery — home → category → search → PDP | Customer | 2, 6, 12, 19a |
| **F3** | Add to Cart | Customer | 2, 3, 4 |
| **F4** | Coupon Application | Customer | 4, 10 |
| **F5** | **Checkout & Payment** | Customer | 3, 4, 7, 9, 17 |
| **F6** | Order Lifecycle | System | 7, 13 |
| **F7** | Warehouse Fulfilment | Warehouse Staff | 3, 7, 17 |
| **F8** | Shipment Tracking & NDR | System / Courier | 8, 17, 13 |
| **F9** | Delivery & Post-Delivery | System | 7, 11 |
| **F10** | Cancellation | Customer / Manager | 7, 3, 9 |
| **F11** | **Return, Exchange & Refund** | Customer / Warehouse / Manager | 18, 3, 9, 17 |
| **F12** | Refund Money Movement | System | 9, 18 |
| **F13** | Wishlist → Restock / Price Drop | Customer | 5, 3, 13 |
| **F14** | Abandoned Cart Recovery | System | 4, 10, 13 |
| **F15** | Review & Rating | Customer / Manager | 11, 13 |
| **F17** | Notification Dispatch | System | 13 |
| **F18** | Customer Support | Customer / Support | 14, 7, 18 |
| **F19** | Admin Daily Operations | Admin / Manager | 15, 16 |
| **F20** | Product Publish | Admin / Manager | 2, 3, 6, 19b |
| **F21** | Inventory Movement | Warehouse | 3 |
| **F22** | CMS Publish | Admin / Manager | 19b |
| **F23** | Edge cases & recovery matrix | System | all |

**F16 is intentionally unused.** Analytics is Module 16 and surfaces operationally through F19, so there is no flow numbered 16. The gap is preserved deliberately rather than closed by renumbering, because every existing cross-reference to F17–F23 stays valid.

---

## F0 · Master Flow Map

```
                          ┌──────────────────────────────┐
                          │   VISITOR lands on store     │
                          └──────────────┬───────────────┘
                                         ▼
   ┌────────────────────────────────────────────────────────────────────┐
   │  DISCOVER   home → category → filter/sort → search → PDP           │  F2
   │             recommendations · recently viewed · reviews · size chart│
   └───────────────┬────────────────────────────────┬───────────────────┘
                   │ wishlist                       │ add to cart
                   ▼                                ▼
        ┌──────────────────┐            ┌────────────────────────┐
        │  WISHLIST    F13 │            │  CART            F3/F4 │
        │  price drop      │───────────►│  qty · coupon · ship   │
        │  back in stock   │  move      │  persistence · merge   │
        └──────────────────┘            └───────────┬────────────┘
                                                    │ checkout
                    ┌───────────────────────────────▼───────────────────────┐
                    │  CHECKOUT                                        F5   │
                    │  contact → address → shipping → payment → review      │
                    │  stock RESERVED · idempotent order · gateway          │
                    └───────────────────────────────┬───────────────────────┘
                                    payment confirmed (webhook = truth)
                                                    ▼
   ┌────────────────────────────────────────────────────────────────────────┐
   │  ORDER LIFECYCLE                                                  F6   │
   │  PLACED → PAYMENT_CONFIRMED → PROCESSING → PACKED → SHIPPED →          │
   │  OUT_FOR_DELIVERY → DELIVERED                                          │
   └───────┬──────────────────────┬──────────────────────┬──────────────────┘
           │ warehouse            │ courier              │ customer
           ▼                      ▼                      ▼
   ┌───────────────┐     ┌─────────────────┐     ┌──────────────────┐
   │ FULFILMENT F7 │     │ TRACKING     F8 │     │ CANCEL       F10 │
   │ pick·pack·AWB │     │ scans·NDR·RTO   │     │ RETURN       F11 │
   └───────────────┘     └─────────────────┘     └────────┬─────────┘
                                                          ▼
                                             ┌────────────────────────┐
                                             │ QC → restock → REFUND  │  F12
                                             └────────────────────────┘
                                                          │
   ┌──────────────────────────────────────────────────────▼─────────────────┐
   │  RETAIN   review invite F15 · segments · notifications F17              │
   │           support F18 · next-order recommendations                       │
   └────────────────────────────────────────────────────────────────────────┘
```

**Three rules that govern every flow below:**

1. **The server owns truth.** The client sends intent (`variant_id`, `qty`, `coupon_code`); the server computes price, tax, shipping, stock, and eligibility. No client-supplied amount is ever trusted.
2. **The webhook is the truth, not the redirect.** Payment and courier state come from signed server-to-server callbacks; browser redirects only *hint* at what happened.
3. **Every money/stock write is idempotent and logged.** Same idempotency key → same result. Every stock change writes a ledger row. Every status change writes a history row.

---

## F1 · Registration & Authentication Flow

### F1.1 Registration (email or mobile)

```
Customer            Storefront           API                    DB / Queue
   │  fills form        │                 │                          │
   ├───────────────────►│  POST /auth/register                       │
   │                    ├────────────────►│                          │
   │                    │                 │ validate (Zod ↔ backend) │
   │                    │                 │ check uniqueness         │
   │                    │                 ├─ create user (UNVERIFIED)┤
   │                    │                 ├─ generate 6-digit OTP ───► queue
   │                    │◄────────────────┤ 201 { user_id, otp_sent }│
   │  enters OTP        │                 │                          │
   ├───────────────────►│  POST /auth/otp/verify                     │
   │                    ├────────────────►│ verify code + expiry     │
   │                    │                 ├─ mark VERIFIED           │
   │                    │                 ├─ issue access + refresh  │
   │                    │                 ├─ merge guest wishlist    │
   │                    │                 ├─ resume signed bag intent► F3.4
   │                    │◄────────────────┤ 200 { tokens, profile }  │
   │◄───────────────────┤ redirect to intended page (or /account)    │
```

**Steps**

1. Customer submits name + email/mobile (+ optional password).
2. Backend validates format, checks `users` for an active duplicate, and rate-limits by IP (5/min) and identifier (10/hour).
3. A user row is created as `UNVERIFIED`; an OTP is generated, hashed, stored with a 10-minute expiry, and queued for dispatch (F17).
4. Customer submits the OTP. Max 5 attempts, then the OTP is burned and a new one must be requested.
5. On success: status → `VERIFIED`, access token (15 min) returned in the response body and held in JavaScript memory only, refresh token (30 d) set as an `HttpOnly; Secure; SameSite=Lax` cookie path-scoped to `/api/v1/auth/refresh` (see F1.4 for the normative rules).
6. Post-auth side-effects run safely: the local guest wishlist is merged, consent records are written, and at most one signed bag intent is revalidated and resumed. There is no guest cart to merge.
7. Welcome notification queued (F17).

**Failure branches**

| Branch | Behaviour |
|---|---|
| Email/mobile already registered & verified | `409 ICE-AUTH-409` → "Account exists. Log in instead." with a login deep link |
| Email registered but unverified | Resend OTP, do not create a second row |
| OTP expired | `410` → offer resend (max 3 resends / hour) |
| OTP wrong 5× | Lock OTP, require a fresh request, log to `login_attempts` |
| Rate limit hit | `429` with `Retry-After`, CAPTCHA challenge on the next attempt |

### F1.2 Login

1. Customer enters identifier + password **or** requests OTP login.
2. Backend loads the user, verifies with Argon2id (constant-time), checks `is_blocked` and lockout state.
3. On success → issue tokens, record `user_sessions` (device, IP, user-agent), merge the local wishlist, then revalidate and resume at most one signed bag intent before returning the profile.
4. On failure → increment `login_attempts`; progressive delay at 3 failures, CAPTCHA at 5, 15-minute lockout at 10. The response is identical for "wrong password" and "no such user" — no account enumeration.

### F1.3 Social login (Google · Apple)

1. Storefront opens the provider's OAuth consent screen.
2. Provider returns an authorization code → backend exchanges it server-side for an ID token.
3. Backend verifies the ID token signature, issuer, audience, and expiry.
4. **Account resolution:** verified email matches an existing user → link the social account. No match → create a new `VERIFIED` user. Never create a duplicate for a verified email.
5. Apple's "hide my email" relay addresses are stored as-is and treated as valid contact addresses.
6. Tokens issued, side-effects identical to F1.1 step 6.

### F1.4 Session lifecycle & refresh rotation

```
access token (15 min)  ── expires ──►  silent refresh
                                          │
        refresh token (30 d, httpOnly, device-bound)
                                          │
                              ┌───────────┴────────────┐
                       valid & unused              reused / stolen
                              │                          │
                     issue new pair               revoke entire family
                     rotate refresh               force re-login
                                                  alert the user (F17)
```

**Token placement — normative, stated once, and binding on every document.**

| Token | Placement | Rules |
|---|---|---|
| Access (15 min) | **JavaScript memory only** | Never `localStorage`, never `sessionStorage`, never a non-`HttpOnly` cookie. Lost on page refresh and recovered by a silent refresh call |
| Refresh (30 d) | **`HttpOnly; Secure; SameSite=Lax` cookie**, path-scoped to `/api/v1/auth/refresh` | Rotates on every use, with reuse detection and family revocation |

**CSRF is mandatory, not conditional.** Because the refresh endpoint is cookie-authenticated, a double-submit CSRF token is required on refresh and on **every** cookie-authenticated mutation. There is no "where the API authentication model requires it" — the model requires it.

**Customer and staff sessions are separated at two levels.** Different cookie names *and* different JWT audiences. A customer refresh cookie presented to an `/admin` endpoint is rejected on audience, before any role check runs.

### F1.5 Forgot password → reset

1. Customer requests reset → backend **always** returns `200` (no enumeration) and, if the account exists, queues a single-use, 30-minute, hashed reset token.
2. Customer opens the link, sets a new password (validated against a strength policy and a breached-password list).
3. On success: password re-hashed, **every session revoked**, security notification sent, `audit_logs` written.

### F1.6 Account deletion

1. Customer requests deletion → re-authentication required.
2. System checks blockers: an in-flight order, an open return, or a pending refund blocks deletion and explains why.
3. Account enters `PENDING_DELETION` with a 30-day grace period; logging back in cancels it.
4. After 30 days, a cron job anonymizes: name, email, phone, addresses, and payment tokens purged; orders retained with an anonymized customer reference for statutory and accounting integrity; reviews anonymized to "Verified Buyer".

---

## F2 · Discovery Flow — home → destination/collection → search → PDP

### F2.1 Homepage (CSR only)

1. The browser downloads the static application shell and route bundle from the CDN.
2. The mounted route calls `GET /cms/home` through TanStack Query, which returns the ordered, currently-scheduled block list (F22).
3. Product rails (New Arrivals, Best Sellers, Trending) resolve from cached catalog reads, already filtered to published + in-stock-or-notifiable.
4. The client composes recently viewed data, wishlist heart states, and the cart badge after their browser-side data sources resolve.
5. `view_item_list` analytics events fire on rail impression.

### F2.2 Destination and collection browsing

```
/men?category=hoodies&size=M&color=black&sort=price_asc&page=2
        │
        ├─ CSR: GET /catalog/destinations/men/products (+ filters from URL)
        ├─ CSR: GET /facets?destination=men        (counts per option)
        └─ render: 4-col desktop / 2-col mobile grid · filter rail · sort control
```

**Public route contract:** the only top-level catalog destinations are `/new-drop`, `/men`, `/women`, `/collections`, `/collections/[slug]`, and `/sale`. Internal categories still classify products and power filters, but there is no public `/category/[slug]` page.

**Rules in play:** filter state lives in the URL (shareable, back-button correct) · facet counts respect other active filters · options that would return zero results are disabled, not hidden · out-of-stock products rank last unless "In stock only" is on · pagination uses one clean destination or collection canonical.

### F2.3 Search

1. Customer types in the navbar overlay. After 150 ms of quiet, the client calls `GET /search/suggest?q=`.
2. Suggestions return in three groups: **products** (thumbnail, name, price), **categories**, **trending queries**. Fully keyboard navigable.
3. Enter → `/search?q=` → full result page with the same facet rail as a destination page.
4. Typo tolerance and synonyms apply (`hoody → hoodie`, `tshirt → t-shirt`, `sneaker → sneakers`).
5. **Zero results** → show: corrected-spelling suggestion, popular categories, best sellers. The query is logged to `search_queries` and appears in the weekly zero-result report (F19).

### F2.4 Product Detail Page — the conversion moment

```
┌──────────────────────────┬───────────────────────────────────────┐
│                          │  ICED-OUT                             │
│   image gallery          │  Oversized Hoodie                     │
│   (zoom · video ·        │  ₹3,499   ₹4,999   30% OFF            │
│    per-colour sets)      │                                       │
│                          │  COLOUR  ● Black  ○ White  ○ Sand     │
│                          │  SIZE    S   M   L   X̶L̶  (sold out)  │
│                          │          ↳ Size chart · fit feedback  │
│                          │                                       │
│                          │  [ ADD TO BAG ]      [ ♡ WISHLIST ]   │
│                          │                                       │
│                          │  ✓ In stock · only 5 left in M        │
│                          │  ✓ Delivery by Wed, 6 Aug — 400001    │
│                          │  ✓ 7-day easy returns                 │
└──────────────────────────┴───────────────────────────────────────┘
   Description · Fabric & care · Model wears size M (6'1")
   Reviews (4.6 ★ · 128) — 71% say true to size
   You may also like · Complete the look · Recently viewed
```

**Flow**

1. The browser route calls `GET /products/{slug}` and renders the PDP — product, variants, media, price, rating summary, size chart, client-managed metadata, and `Product` + `AggregateRating` JSON-LD.
2. **Colour first, then size.** Selecting a colour swaps the image set and re-derives which sizes exist for that colourway.
3. Live availability comes from `GET /products/{slug}/availability` with a short query stale time; the add-to-bag action always rechecks stock through the API.
4. Sold-out sizes render **disabled and struck-through — never hidden** — with "Notify me" attached (→ F13).
5. Pincode check returns the estimated delivery date and COD eligibility (Module 17).
6. Below the fold, lazy-loaded: reviews (F15), recommendations (Module 12), recently viewed. These must never delay LCP.
7. Every interaction emits analytics: `view_item`, `select_variant`, `size_unavailable`, `add_to_wishlist`, `add_to_cart`.

**The `size_unavailable` event matters.** It is the single best predictor of lost apparel revenue and drives the size-curve report (F19).

---

## F3 · Add to Cart Flow

```
Customer            Storefront              API                    Redis / DB
   │ select size+colour │                    │                          │
   │ tap ADD TO BAG     │                    │                          │
   ├───────────────────►│ auth gate          │                          │
   │                    ├─ guest? show login; retain one signed intent  │
   │                    ├─ verified CUSTOMER? continue                  │
   │                    ├───────────────────►│ POST /cart/items         │
   │                    │                    │ { variant_id, qty }      │
   │                    │                    │                          │
   │                    │                    ├─ authorize CUSTOMER      │
   │                    │                    ├─ resolve cart by user_id │
   │                    │                    ├─ validate variant is published
   │                    │                    ├─ check available stock   │
   │                    │                    ├─ enforce per-variant cap (10)
   │                    │                    ├─ upsert line (merge qty) │
   │                    │                    ├─ RE-PRICE WHOLE CART ────► pricing engine
   │                    │◄───────────────────┤ 200 { cart, totals }     │
   │◄ cart drawer opens ┤ badge++ · toast    │                          │
```

**Steps**

1. Add-to-bag is disabled until both colour and size are chosen — the button label states what's missing ("Select a size").
2. A guest may browse and maintain a local wishlist, but **cannot create or mutate a bag**. Add to Bag, Bag, Cart, Checkout, Payment, and Place Order all require an authenticated, verified `CUSTOMER`.
3. When a guest taps Add to Bag, the client opens login and retains one short-lived signed intent containing only the product variant, quantity, and safe return path. No guest cart row, token, or cookie is created.
4. After authentication, the client revalidates the intent and sends only `variant_id` and `qty`. Never a price.
5. The API independently authorizes the verified customer and resolves the cart only through `carts.user_id`; unauthenticated mutations return `401` and non-customer principals return `403`.
6. Validation order: customer authorized → variant exists → product published → stock available → per-variant cap → line upsert.

   The cap is **per variant, per cart** — `cart.max_quantity_per_variant = 10`, not a limit on the order as a whole. `product_variants.max_per_order` may lower that ceiling for an individual variant; it may never raise it.

7. **The entire cart is re-priced on every mutation** (F4 order of operations) — line totals, item discounts, coupon, shipping estimate, tax, grand total.
8. Response returns the full cart; the client replaces state rather than patching it, so client and server can never drift.
9. Cart drawer opens with the line highlighted, plus a "frequently bought together" rail (Module 12).

**Quantity update:** identical path via `PATCH /cart/items/{id}`; requesting more than available clamps to the maximum and tells the customer exactly what happened.

**Remove:** `DELETE` with a 5-second undo toast; the undo restores from a client-held snapshot, revalidated server-side.

### F3.4 Authentication gate and intent resume

| Situation | Resolution |
|---|---|
| Guest taps Add to Bag | Open login and retain one signed, short-lived bag intent; do not mutate cart state |
| Authentication succeeds | Re-check role, signature, expiry, variant publication, and stock before one idempotent add |
| Authentication is cancelled or fails | Discard the bag intent; the guest wishlist remains available locally |
| Guest opens `/cart` or any `/checkout/*` URL directly | Return to the login gate with a safe signed return path; do not render personal commerce data |
| Intent is expired, altered, unavailable, or out of stock | Reject it with a clear message and return to the originating product or wishlist |

### F3.5 Cart integrity on every read

Every `GET /cart` re-validates and reports changes **before** checkout, never at payment:

- Price changed since the item was added → line flagged, new price applied, customer told
- Variant unpublished or deleted → line flagged `unavailable`
- Stock dropped below the line quantity → quantity clamped, customer told
- Coupon expired or now ineligible → coupon dropped with a plain-language reason
- Free-shipping threshold crossed or lost → shipping recalculated

---

## F4 · Coupon Application Flow

```
Customer enters "ICE20"
        │
        ▼
POST /cart/coupon { code }
        │
        ├─ 1. Code exists & is active? ───────────────► no → ICE-CPN-404 "Invalid code"
        ├─ 2. Within start/expiry window? ────────────► no → ICE-CPN-410 "This code expired on 31 Dec"
        ├─ 3. Global usage limit remaining? ──────────► no → ICE-CPN-409 "This offer has ended"
        ├─ 4. Per-user limit remaining? ──────────────► no → ICE-CPN-409 "You've already used this code"
        ├─ 5. User eligible (segment / assignment)? ──► no → ICE-CPN-403 "Not valid for this account"
        ├─ 6. Cart meets minimum order value? ────────► no → ICE-CPN-422 "Add ₹450 more to use ICE20"
        ├─ 7. Cart has eligible items? ───────────────► no → ICE-CPN-422 "Valid on hoodies only"
        ├─ 8. Stacking policy allows it? ─────────────► no → ICE-CPN-409 "Cannot combine with the current offer"
        │
        ▼
   APPLY → compute discount → cap it → re-price cart → persist to cart_coupons
        │
        ▼
   200 { cart, totals, applied_coupon: { code, discount: "700.00", label: "20% OFF" } }
```

**Rules**

- Every rejection returns a **human sentence**, not just a code. "Add ₹450 more to use ICE20" converts; "Invalid coupon" does not.
- The coupon is **re-validated three times** — on cart read, at checkout start, and at order creation — because carts sit for days.
- Redemption uses one vocabulary across all three documents: **reserve → consume → release**. The redemption is **reserved** at order creation, **consumed** at payment or COD confirmation, and **released** on eligible cancellation or full refund (F10, F11). Applying a coupon to a cart never consumes usage, so abandoned carts don't burn the limit.
- Discounts are capped at the eligible subtotal; no line can be driven below zero.

---

## F5 · Checkout & Payment Flow — the money path

This is the most carefully specified flow in the system. Every step is idempotent, every failure has a defined recovery, **a verified customer session is mandatory**, and no state advances on a browser redirect alone.

### F5.1 The five steps

```
┌─ 1. CONTACT ──────────────────────────────────────────────┐
│  Verified customer only → email + mobile prefilled        │
│  Direct guest access → strict login gate before rendering │
├─ 2. DELIVERY ADDRESS ─────────────────────────────────────┤
│  Saved addresses · new address · pincode serviceability   │
│  → estimated delivery date · COD eligibility              │
├─ 3. SHIPPING METHOD ──────────────────────────────────────┤
│  Standard (4–6 d) · Express (2–3 d) · Same-day (select)   │
│  Free above ₹1,999 · rate from zone × weight × value      │
├─ 4. PAYMENT METHOD ───────────────────────────────────────┤
│  UPI · Card · Netbanking · Wallet · EMI · BNPL · COD      │
│  Saved tokens · COD fee shown                              │
├─ 5. REVIEW & PLACE ORDER ─────────────────────────────────┤
│  Final itemised total — the number they'll be charged     │
└───────────────────────────────────────────────────────────┘
```

Progress is saved per step; a customer can leave and resume. Checkout is `noindex`, `no-store`, and never cached.

### F5.2 Order creation & stock reservation

```
Customer      Storefront          API                 DB                Gateway
   │  Place Order  │               │                   │                    │
   ├──────────────►│  POST /checkout/orders             │                    │
   │               │  Idempotency-Key: <uuid>           │                    │
   │               ├──────────────►│                   │                    │
   │               │               │ ── BEGIN TRANSACTION ──                 │
   │               │               │ 1. idempotency check (replay → 200 same)│
   │               │               │ 2. re-price cart from scratch           │
   │               │               │ 3. re-validate coupon (3rd time)        │
   │               │               │ 4. SELECT … FOR UPDATE on each variant  │
   │               │               │ 5. RESERVE stock (15 min TTL)           │
   │               │               │ 6. create order  PENDING_PAYMENT        │
   │               │               │ 7. snapshot items, address, totals      │
   │               │               │ ── COMMIT ──                            │
   │               │◄──────────────┤ 201 { order_id, order_number, amount }  │
   │               │               │                   │                    │
   │               │  POST /checkout/payment/initiate   │                    │
   │               ├──────────────►│ create gateway order ──────────────────►│
   │               │◄──────────────┤ { gateway_order_id, key }               │
   │◄ gateway UI ──┤               │                   │                    │
```

**Why reserve rather than deduct:** the customer has not paid yet. Reserving makes the unit unavailable to everyone else for 15 minutes (COD: 10) without falsifying `on_hand`. A cron sweep releases expired reservations and returns the stock to `available`.

**Why `SELECT … FOR UPDATE`:** two customers tapping "Place Order" on the last M in the same millisecond. The row lock serialises them — the first reserves, the second fails cleanly with `ICE-INV-409` and is told which size is still available. This is the anti-oversell guarantee, and it is the reason stock lives in the database and not in a cache.

### F5.3 Payment confirmation — the webhook is truth

```
        ┌──────────────── two independent paths ────────────────┐
        │                                                        │
   Browser redirect                                     Gateway webhook
   (fast, unreliable)                                (authoritative, signed)
        │                                                        │
        ▼                                                        ▼
POST /checkout/payment/verify                    POST /webhooks/payment/razorpay
        │                                                        │
        ├─ verify signature                       ├─ verify HMAC signature
        ├─ FETCH status server-to-server ◄────────┼─ store raw payload first
        ├─ compare amount to the paise            ├─ idempotent on event_id
        │                                                        │
        └────────────────────┬───────────────────────────────────┘
                             ▼
                  confirmPayment(order, payment)   ← runs once, whoever arrives first
                             │
              ── BEGIN TRANSACTION ──
              1. lock order row; if already confirmed → return (idempotent)
              2. payment → CAPTURED, write payments + payment_attempts
              3. convert RESERVATION → DEDUCTION (SALE_CONFIRM ledger rows)
              4. order → PLACED → PAYMENT_CONFIRMED
              5. consume the coupon redemption
              6. generate invoice number from the locked sequence
              7. clear the cart
              ── COMMIT ──
                             │
              queue: order-confirmation notification (email·SMS·push·WhatsApp)
              queue: invoice PDF · ops "new order" alert · analytics purchase event
```

**Critical property:** if the customer closes the tab immediately after paying, the webhook still confirms the order. If the webhook is delayed, the verify call confirms it. Whichever arrives first wins; the second is a no-op. The customer is never punished for a flaky network.

### F5.4 COD flow

1. COD eligibility is evaluated at step 4: order value ≤ ₹5,000 · pincode COD-serviceable · customer has < 2 prior RTOs · not a first order above ₹3,000.
2. If eligible, the COD fee (₹49, waived above ₹1,999) is added as a visible line — never a surprise at the door.
3. High-value COD triggers an OTP confirmation on the order before it enters `PROCESSING`.
4. Order is created directly as `PAYMENT_CONFIRMED` with `payment_method = COD`, `payment_status = PENDING`. Stock is **reserved** at order creation and **converts to a deduction** when the OTP or risk check clears — the 10-minute COD reservation is that OTP window. Where no OTP is required, the reserve and the conversion happen in the same transaction, so the effect is immediate without the state machine having to lie about it.
5. Payment is marked `CAPTURED` only on delivery confirmation, and reconciled against the courier's COD remittance file.

### F5.5 Failure branches — every one has a defined recovery

| Failure | System behaviour | Customer sees |
|---|---|---|
| Payment failed / declined | Order stays `PENDING_PAYMENT`; reservation held for the remaining TTL | "Payment failed — retry" with the cart intact and the same order resumable |
| Customer abandons at the gateway | Reservation expires in 15 min; order auto-cancels; stock released | Abandoned-cart recovery (F14) |
| Money debited, webhook not received | Reconciliation job polls the gateway every 5 min for `PENDING_PAYMENT` orders < 24 h old; auto-confirms on `captured` | Order confirms on its own, usually within minutes |
| Money debited, gateway says failed | Auto-refund queued; support ticket auto-created (F18) with the payment reference | "We've initiated your refund — 3–5 working days" |
| Amount mismatch | Confirmation **blocked**, `ICE-PAY-409`, manual review queue | "We're verifying your payment" — never a silent wrong-amount order |
| Stock vanished between reserve and confirm | Payment auto-refunded in full; order cancelled | Immediate notification with the exact size that went out, plus alternatives |
| Duplicate submit (double tap / retry) | Idempotency key returns the original order | One order, one charge |
| Gateway down | Alternate gateway offered; COD surfaced if eligible | "Try another payment method" |
| Reservation expired but payment succeeded | Re-attempt reservation; if it fails, full auto-refund + apology + a recovery coupon | Full refund, explained |

### F5.6 Authentication invariant

1. Checkout sessions, payment attempts, coupon redemptions, and orders always reference a verified `users.id`; guest checkout and guest orders do not exist.
2. Storefront route guards cover `/cart`, every `/checkout/*` route, payment return routes, and Place Order actions. API middleware repeats the same check so a bypassed client cannot proceed.
3. If a session expires mid-checkout, the draft remains server-side for the same user, sensitive fields are hidden, and login is required before the customer can resume.

---
## F6 · Order Lifecycle Flow

### F6.1 The happy path

```
Order Placed
      ↓          payment webhook confirms · stock deducted · invoice generated
Payment Confirmed
      ↓          ops accepts · warehouse allocates · pick list generated
Processing
      ↓          picked · packed · weighed · AWB generated · label printed
Packed
      ↓          manifest closed · handed to courier · first scan received
Shipped
      ↓          courier out-for-delivery scan
Out For Delivery
      ↓          POD captured (COD: cash collected)
Delivered
```

### F6.2 State machine — the complete contract

| From | To | Trigger | Side-effects | Customer notified |
|---|---|---|---|---|
| — | `PENDING_PAYMENT` | Checkout starts | Stock **reserved** (15 min) | — |
| `PENDING_PAYMENT` | `PLACED` → `PAYMENT_CONFIRMED` | Payment webhook / verify | Reservation → deduction · invoice · coupon redeemed · cart cleared | ✓ Order confirmation (all channels) |
| `PENDING_PAYMENT` | `PAYMENT_FAILED` | Gateway failure | Reservation retained until TTL | ✓ Retry prompt |
| `PENDING_PAYMENT` | `EXPIRED` | 15-min TTL | Reservation released | → F14 recovery |
| `PAYMENT_CONFIRMED` | `PROCESSING` | Ops accept (auto after 15 min) | Allocated to a warehouse · pick list | ✓ "We're preparing your order" |
| `PROCESSING` | `PACKED` | Warehouse pack scan | Weight captured · AWB created · label printed | ✓ "Packed & ready to ship" |
| `PACKED` | `SHIPPED` | Manifest handover / first courier scan | Tracking link live · EDD recomputed | ✓ Tracking number + link |
| `SHIPPED` | `OUT_FOR_DELIVERY` | Courier scan | — | ✓ "Arriving today" |
| `OUT_FOR_DELIVERY` | `DELIVERED` | POD scan | Return window opens · review invite in 3 d · COD marked collected | ✓ "Delivered" + review nudge |
| `OUT_FOR_DELIVERY` | `DELIVERY_FAILED` | NDR scan | NDR case opened · reattempt scheduled | ✓ "We missed you — reschedule" |
| `DELIVERY_FAILED` ×3 | `RTO_INITIATED` → `RTO_DELIVERED` | Courier | Stock restocked on receipt · prepaid auto-refunded | ✓ At each step |
| any pre-`SHIPPED` | `CANCELLED` | Customer / Manager | Stock released · refund queued · coupon released | ✓ Cancellation + refund ETA |

**`RETURN_REQUESTED` is not an order state.** `DELIVERED` is terminal for forward fulfilment. A return is its own aggregate — a `return_requests` row with its own state machine (F11) — and it never moves the order back to an earlier fulfilment state. Were it an order state, invariant 4 below would contradict itself and every report keyed on delivery date would drift. What the customer sees as one continuous story is a **projection**: `v_order_timeline` unions order, shipment, return, refund, and support events.

**Invariants**

1. A state is never skipped. An out-of-sequence transition returns `ICE-ORD-409` and is logged.
2. Every transition writes `order_status_history` (actor, timestamp, reason, source: `customer` / `staff` / `webhook` / `system`).
3. **One source, two views.** The customer timeline (F8) and the console audit trail read the same rows.
4. Terminal states — `DELIVERED`, `CANCELLED`, `REFUNDED`, `RTO_DELIVERED` — never transition backwards; corrections are new records, never edits.
5. Order totals are frozen at creation. Nothing downstream re-prices a placed order.

---

## F7 · Warehouse Fulfilment Flow

```
 NEW ORDER QUEUE                    Warehouse console (scanner-first UI)
        │
        ▼
 1. ALLOCATE          → pick warehouse by stock availability + zone proximity
        │                split into multiple shipments only if unavoidable
        ▼
 2. PICK LIST         → batched by zone/bin, wave-picked across orders
        │                scan SKU barcode → validates variant, decrements pick task
        ▼
 3. PACK              → scan order → scan each item → system verifies exact match
        │                weigh parcel → capture actual weight → choose box size
        ▼
 4. AWB + LABEL       → rate-shop (cheapest provider meeting promised TAT)
        │                generate AWB · print 4×6 label · print invoice · packing slip
        ▼
 5. MANIFEST          → group the day's shipments per courier → close manifest
        │
        ▼
 6. HANDOVER          → courier scans pickup → order → SHIPPED → tracking live
```

**Steps in detail**

1. **Allocation.** On `PAYMENT_CONFIRMED`, the order is allocated to the warehouse that can ship it complete and closest to the destination zone. Splitting is a last resort — split shipments double freight and halve customer satisfaction.
2. **Pick.** Pick lists are generated in bin sequence, batched into waves across orders. Every pick is a **barcode scan** — the scan is the proof, not a tick box. A wrong scan is rejected at the shelf, which is the cheapest possible place to catch it.
3. **Pack.** Scanning the order opens its item list; each item is scanned into the parcel. The system will not allow packing to complete until scanned items exactly match ordered items. `WRONG_ITEM_SENT` returns (F11) are a warehouse-accuracy metric reported weekly.
4. **Weigh & label.** Actual weight is captured and compared to the estimate; a variance beyond tolerance flags the product's stored weight for correction (which is what silently inflates freight bills). AWB generation is **idempotent per order** — a reprint reuses the same AWB.
5. **Manifest & handover.** Manifests close per courier per day. The courier's pickup scan moves every shipment on the manifest to `SHIPPED` in one event.

**Failure branches**

| Failure | Behaviour |
|---|---|
| Item not found at the bin | Pick task flagged `SHORT_PICK` → cycle count triggered (F21) → order rerouted to another warehouse or put on hold with customer notification |
| AWB generation fails | Order stays `PACKED`, enters a retry queue, ops alerted after 3 failures. Never silently stuck. |
| Courier pickup missed | Manifest rolls to the next day; affected customers get a proactive delay notification |
| Damaged during packing | Item swapped from stock, damaged unit written off via `DAMAGE` (F21) |

---

## F8 · Shipment Tracking & NDR Flow

### F8.1 Scan → customer timeline

```
Courier scan event
        │
        ▼
POST /webhooks/courier/{provider}      ← HMAC verified
        │
        ├─ 1. store RAW payload first (providers change formats without notice)
        ├─ 2. idempotency check on (provider, awb, event_code, event_time)
        ├─ 3. normalize provider status → our vocabulary
        ├─ 4. append shipment_events
        ├─ 5. advance order state if the mapping says so (F6)
        ├─ 6. recompute EDD
        └─ 7. queue customer notification (F17)
                        │
                        ▼
             Customer timeline updates live
```

### F8.2 What the customer sees

```
✓ Order Confirmed        03 Aug, 4:12 PM
✓ Packed                 03 Aug, 7:40 PM
✓ Shipped                04 Aug, 9:05 AM   ·  AWB 3491XXXXXX  ·  Delhivery
○ Out for Delivery       expected 06 Aug
○ Delivered              expected 06 Aug
```

Completed steps are gold with a checkmark; pending steps are muted with an open circle (§19). The tracking page is reachable **without login** via an unguessable token — because the recipient is often not the buyer.

### F8.3 Silence detection

Webhooks fail quietly, which is the worst way to fail. If a shipment records no scan for **6 hours**, a poller takes over and queries the courier API directly. At **48 hours** of no movement, a support ticket is auto-created (F18) and the customer receives a proactive update *before* they have to ask. Silence is never treated as good news.

### F8.4 NDR (non-delivery) branch

```
DELIVERY_FAILED
      │
      ├─ reason: customer unavailable / address incomplete / customer refused / OTP failed
      ▼
NDR case opened → customer contacted within 2 h (WhatsApp + SMS + call task)
      │
      ├─ customer responds: reschedule ──► reattempt (max 3)
      ├─ customer responds: new address ─► address updated, reattempt
      ├─ customer refuses ───────────────► RTO_INITIATED
      └─ no response in 48 h ────────────► RTO_INITIATED
                                                │
                          RTO_DELIVERED → QC → restock (F21) → refund if prepaid (F12)
```

RTO is expensive freight in both directions. Every NDR reason is logged and reported — address-quality failures are fixed at checkout (address validation), not in the warehouse.

---

## F9 · Delivery & Post-Delivery Flow

```
DELIVERED (POD scan)
      │
      ├─ t+0     order timeline completes · delivery notification (all channels)
      ├─ t+0     COD: payment marked CAPTURED, queued for remittance reconciliation
      ├─ t+0     return window opens (7 days)
      ├─ t+3d    review invitation (F15) — one reminder at t+7d, then never again
      ├─ t+7d    return window closes (delivery + 7 days) → order becomes final
      └─ t+8d    post-window follow-up: "complete the look" email (Module 12)
```

The window closes at **delivery + 7 days**, matching `returns.default_window_days`. The `t+8d` entry is a post-window follow-up only and confers no return eligibility.

---

## F10 · Cancellation Flow

```
Customer taps "Cancel order"
        │
        ▼
GET /me/orders/{id}/cancel-eligibility
        │
        ├─ state < PACKED  ──────────────► SELF-SERVE, instant
        ├─ state = PACKED  ──────────────► requires Manager approval
        └─ state ≥ SHIPPED ──────────────► not cancellable → offer "refuse on delivery" or return (F11)
        │
        ▼
POST /me/orders/{id}/cancel { reason_code }
        │
   ── BEGIN TRANSACTION ──
   1. lock order; re-check state (it may have advanced while the dialog was open)
   2. order → CANCELLED, write status history with actor + reason
   3. release reservation OR restock deducted units (ledger row, F21)
   4. release coupon redemption back to the pool (F4)
   5. cancel the shipment / void the AWB if one exists
   6. queue refund (F12) — never fired inside this transaction
   ── COMMIT ──
        │
        ▼
   Notifications: cancellation confirmed + refund amount + expected timeline
```

**Partial cancellation** (removing one item from a multi-item order) follows the identical path scoped to the line, with coupon discount **re-prorated** across the remaining items — if removing the item drops the cart below the coupon's minimum order value, the coupon is removed and the customer is shown the revised total before confirming.

---

## F11 · Return, Exchange & Refund Flow

The single most operationally expensive flow in apparel. It is specified end to end.

A return is **its own aggregate** — a `return_requests` row with the state machine below. It never appears in `orders.status`, and it never moves the order back to an earlier fulfilment state; `DELIVERED` stays terminal (F6.2). The customer's single continuous timeline is a projection (`v_order_timeline`) that unions order, shipment, return, refund, and support events.

```
Return Requested
      ↓
Return Approved  ────────────► Rejected (outside window / policy / condition)
      ↓
Reverse Pickup Scheduled
      ↓
Picked Up
      ↓
Received at Warehouse
      ↓
Quality Check  ─────────────► QC Failed → returned to customer / scrapped
      ↓ QC Passed
Restocked
      ↓
Refund Initiated
      ↓
Refund Completed
```

### F11.1 Request

1. Customer opens a delivered order → `GET /me/orders/{id}/return-eligibility`. The button only exists when eligibility passes, so nobody starts a journey that ends in "no".
2. Eligibility is computed server-side from: delivery date + return window, product return policy (innerwear, customized, final-sale drops are non-returnable), whether a return already exists, and the customer's return-abuse flag.
3. Customer selects **items and quantities** (not the whole order), picks a **reason code**, optionally uploads photos (mandatory for `DAMAGED_IN_TRANSIT` and `QUALITY_ISSUE`), and chooses the outcome: **refund**, **exchange**, or **store credit**.
4. The refund estimate is shown **before** confirming: item price − prorated coupon discount − return shipping fee where applicable.

### F11.2 Approval

| Path | Condition |
|---|---|
| **Auto-approved** | Within window · standard reason · customer return rate < 40% · order value below the review threshold |
| **Manual queue** | High-value order · quality/damage claim · return rate > 60% over 5+ orders · third return this month |
| **Rejected** | Outside window · non-returnable product · already returned · policy violation — always with a written reason, always appealable via support (F18) |

Reason codes drive downstream fixes:

| Code | Restockable | Feeds back into |
|---|---|---|
| `SIZE_SMALL` / `SIZE_LARGE` | ✅ | Size chart + PDP fit signal (F15) |
| `NOT_AS_DESCRIBED` | ✅ | Product media & copy (F20) |
| `QUALITY_ISSUE` | ❌ | Vendor QC scorecard |
| `DAMAGED_IN_TRANSIT` | ❌ | Packaging spec + courier review |
| `WRONG_ITEM_SENT` | ✅ | Warehouse pick accuracy (F7) |
| `CHANGED_MIND` | ✅ | — (fee applies) |
| `LATE_DELIVERY` | ✅ | Courier SLA review |

### F11.3 Reverse logistics

1. On approval, a **reverse pickup** is created with the courier (Module 17); the customer gets a pickup window and a QR/label if self-ship is required.
2. Pickup attempts follow the same reattempt logic as forward delivery (3 attempts), then the return auto-closes with a notification.
3. The reverse leg is tracked; the customer sees the same timeline UI as the forward leg.

### F11.4 Quality check — the gate that protects stock accuracy

```
Received at warehouse
      │
      ▼
 QC station: scan return → open expected item list
      │
      ├─ correct item? correct variant? tags intact? unworn? unwashed?
      │
      ├─ PASS ──────► restock (RETURN_IN ledger row) → available++ → refund proceeds
      ├─ PARTIAL ───► restock what passed, reject the rest, refund prorated
      └─ FAIL ──────► RETURN_SCRAP or ship back to customer
                      photos captured · reason logged · customer notified with evidence
```

**Stock is restocked only after QC passes.** An item in reverse transit is never counted as available — this is the second half of the anti-oversell guarantee.

### F11.5 Exchange variant

An exchange is modelled as a **return + a zero-value replacement order** so stock, shipping, and reporting all stay truthful.

1. Customer selects the replacement variant (usually a different size).
2. **Replacement stock is reserved at approval**, not at dispatch — so the exchange cannot fail later for want of stock, which is the most infuriating possible outcome.
3. The replacement ships after the returned item passes QC.
4. Price difference: higher-priced replacement → a payment link for the difference; lower-priced → the difference is refunded.
5. The replacement order carries its own AWB and tracking, linked to the original for support context.

---

## F12 · Refund Money Movement Flow

```
Refund triggered by: cancellation (F10) · return QC pass (F11) · RTO (F8) · payment error (F5.5)
        │
        ▼
  Compute refundable amount
        │  item price
        │  − prorated coupon discount
        │  − return shipping fee (change-of-mind only)
        │  − COD fee (non-refundable if the order was delivered)
        │  + shipping refunded only when the entire order is returned
        ▼
  Choose destination
        ├─ Prepaid  ──► original payment method (gateway refund API)
        ├─ COD      ──► verified bank account / UPI (customer submits, one-time verification)
        └─ Any      ──► store credit (instant)
        ▼
  refunds row created  → REFUND_PENDING
        ▼
  Gateway refund API called (idempotent on refund_id)
        ▼
  Gateway webhook confirms → REFUNDED
        ▼
  Side-effects: coupon redemption released · credit note generated ·
                customer notified · settlement line reconciled
```

**Rules**

1. Refunds are **queued, never fired synchronously** inside an order transaction — a slow gateway must never hold a database lock.
2. Every refund is traceable end to end: order → payment → refund → gateway refund ID → settlement line.
3. Partial refunds are line-scoped and always show their arithmetic to the customer before confirmation.
4. The refund status is visible on the order timeline the whole way — "refund initiated" is a *state*, not an email that was sent once.
5. Store credit is instant and posts to its own append-only credit ledger; gateway refunds carry a 3–5 working-day promise and the promise is stated up front.
6. A failed gateway refund retries with backoff and, after 3 failures, auto-creates a support ticket with full context (F18).

---
## F13 · Wishlist → Restock & Price-Drop Flow

```
Customer taps ♡ on a product card or PDP
        │
        ├─ guest?  → stored locally, merged into the account at login (F1.1 step 6)
        └─ logged in? → POST /me/wishlist/items { product_id, variant_id }
                                │
                                ▼
                   wishlist_items row (remembers the size/colour viewed)
                                │
        ┌───────────────────────┼────────────────────────┐
        ▼                       ▼                        ▼
  PRICE DROP              BACK IN STOCK             LOW STOCK
  price < price_at_add    available 0 → >0          available ≤ 3
        │                       │                        │
        └───────────────────────┴────────────────────────┘
                                ▼
                  Notification (F17) — email · push · WhatsApp
                  frequency-capped, consent-checked, quiet-hours aware
                                ▼
                  Deep link → PDP with the exact variant preselected
                                ▼
                  One tap → login if needed → cart (F3) → checkout (F5)
```

**Restock fan-out on a drop.** When a hyped variant restocks, thousands of subscribers exist. The dispatcher sends in **subscription order** (first to subscribe, first to know — the fair rule and the one customers accept), throttled in batches so the storefront survives the traffic it just created.

**Rules:** a wishlist item survives a stock-out — that is the entire point. Guests may add, remove, and view local wishlist items without logging in. Moving any item to the bag is the hard authentication boundary and re-validates stock after login. Notification frequency is capped per user per week. Wishlist-add is a first-class analytics event: a high wishlist-to-purchase ratio on a product is a **price-resistance signal**, reported in F19.

---

## F14 · Abandoned Cart Recovery Flow

```
Cart inactive 60 min · identified email/phone · not converted
        │
        ▼
  abandoned_carts row created — snapshot of items, totals, and the reason we can infer
        │
        ├─ t + 1 h    Email + Push   "You left something behind"        no discount
        ├─ t + 24 h   WhatsApp/Email "Still thinking? Your size is running low"  social proof + stock urgency
        └─ t + 72 h   Email          "Here's 10% — ICEBACK10"           single-use, 48-hour expiry
        │
        ▼
  Any click → cart restored exactly (items, quantities, coupon) → checkout
        │
        ▼
  Converted → recovery attributed to the touch, sequence stopped immediately
```

**Rules**

1. The sequence **stops the moment** the cart converts, is emptied, or the customer unsubscribes. A recovery email after purchase is worse than no email.
2. Discounts appear only in the third touch. Discounting at t+1h trains customers to abandon deliberately.
3. Recovery coupons are **single-use, cart-bound, and short-lived** — they never leak into coupon-sharing forums.
4. Out-of-stock items in a restored cart are flagged, not silently dropped.
5. Max one recovery sequence per customer per 7 days.
6. Recovery revenue is reported separately in F19 — this flow must earn its send volume.

---

## F15 · Review & Rating Flow

```
Order DELIVERED
      │
      ├─ t+3d  review invitation (email + push), deep-linked per product
      ├─ t+7d  one reminder — then never again
      ▼
Customer writes review
      │  rating 1–5 · title · body · photos (≤5)
      │  size purchased · fit: Runs small / True to size / Runs large
      ▼
POST /products/{id}/reviews          ← eligibility enforced server-side
      │  requires a DELIVERED order containing this product
      │  one review per product per order
      ▼
status = PENDING  →  auto-screen (profanity · spam · links · duplicate text)
      │
      ├─ clean      → moderation queue (Manager)
      └─ flagged    → held with the flag reason attached
      ▼
Manager approves / rejects (reason logged) / replies publicly
      ▼
status = APPROVED
      │
      ├─ recompute product_rating_summary (materialized — the PDP never runs an aggregate)
      ├─ recompute fit signal: "71% say true to size"
      └─ invalidate product-rating API/query cache keys; clients refetch the JSON-LD rating value
```

**Rules:** only verified purchasers may review · negative reviews are never deleted, only rejected for policy violations, with the reason logged · the fit signal is a **direct lever on the return rate** (F11) and is reported alongside `SIZE_SMALL` / `SIZE_LARGE` return reasons · merchant replies are attributed to the brand, never to an individual · photo reviews are surfaced first because they convert best.

---

## F17 · Notification Dispatch Flow

```
Domain event (order.confirmed · shipment.updated · price.dropped · cart.abandoned …)
        │
        ▼
 notification_events_outbox   ← written INSIDE the business transaction
        │                        (so a notification can never claim something that didn't happen)
        ▼
 Dispatcher worker
        │
        ├─ 1. resolve recipients + locale + timezone
        ├─ 2. CONSENT CHECK        transactional → always send
        │                          marketing     → consent required, no exceptions
        ├─ 3. QUIET HOURS          22:00–08:00 IST — marketing deferred, transactional sent
        ├─ 4. FREQUENCY CAP        max 3 marketing messages / user / week, all channels combined
        ├─ 5. CHANNEL SELECTION    per event × per user preference (F13 table)
        ├─ 6. TEMPLATE RENDER      versioned template + variables + locale
        ├─ 7. SEND                 provider adapter (SMTP · SMS · WhatsApp · Web Push)
        ├─ 8. LOG                  provider message ID, status, cost
        └─ 9. RETRY                exponential backoff ×3 → dead-letter queue → ops alert
```

**Rules:** transactional and marketing never share a switch · the outbox is written inside the business transaction so notifications and reality cannot diverge · every marketing message carries a working one-tap unsubscribe, honoured within 60 seconds · templates are versioned, never mutated in place · bounce and complaint webhooks feed back and auto-suppress bad addresses to protect sender reputation.

---

## F18 · Customer Support Flow

```
Customer needs help
        │
        ├─ FAQ search ────────────────► resolved (deflection tracked)
        ├─ Chatbot ───────────────────► resolves from LIVE data:
        │                                "Where is my order" → real tracking
        │                                "Refund status"     → real refund state
        │                                "Which size"        → fit signal from F15
        │                                unresolved → hand off with full transcript
        └─ Contact form / live chat ──► TICKET
                                          │
                    ┌─────────────────────┴─────────────────────┐
                    │  ticket carries FULL ORDER CONTEXT        │
                    │  items · payment · shipment · timeline    │
                    │  → the agent never asks them to repeat    │
                    └─────────────────────┬─────────────────────┘
                                          ▼
OPEN → ASSIGNED → IN_PROGRESS → WAITING_ON_CUSTOMER → RESOLVED → CLOSED
                                    (SLA timer pauses here)        │
                                                                   └─► REOPENED (≤7 days)
```

**SLA by category**

| Category | First response | Resolution |
|---|---|---|
| Payment failed / money debited | 1 h | 24 h |
| Wrong or damaged item | 2 h | 24 h |
| Order not delivered (WISMO) | 4 h | 48 h |
| Return / refund status | 4 h | 48 h |
| Size & fit guidance | 8 h | 24 h |
| General enquiry | 12 h | 72 h |

**Rules:** SLA timers pause in `WAITING_ON_CUSTOMER` · breaches auto-escalate to the Manager queue and surface on the admin dashboard (F19) · **Support can request a refund but cannot approve one** — approval belongs to Manager/Admin (Module 20) · a ticket cannot close while a linked return or refund is in flight · auto-created tickets (stuck shipment F8.3, failed refund F12, payment mismatch F5.5) arrive pre-populated with the exact failure context · CSAT is captured on resolution and reported per agent and per category.

---

## F19 · Admin Daily Operations Flow

The console is designed around **queues that get cleared**, not dashboards that get admired.

```
09:00  DASHBOARD
       ├─ Sales · Orders · Revenue · Customers · Products · Inventory tiles
       └─ vs. yesterday / last week — every tile drills into a filtered list

09:15  ACTION QUEUES (clear top to bottom)
       ├─ Orders awaiting confirmation      → accept / hold / cancel
       ├─ Ready to pack                     → hand to warehouse (F7)
       ├─ Awaiting dispatch                 → chase the courier pickup
       ├─ NDR pending                       → reattempt / reschedule / RTO (F8.4)
       ├─ Returns awaiting QC               → warehouse (F11.4)
       ├─ Refunds pending approval          → approve (F12)
       ├─ Reviews awaiting moderation       → approve / reject / reply (F15)
       ├─ Tickets breaching SLA             → reassign / escalate (F18)
       └─ Low-stock & out-of-stock          → reorder / mark restock date (F21)

11:00  CATALOG        publish drops, price changes, new arrivals (F20)
14:00  MARKETING      schedule campaigns, review coupon performance (F4)
17:00  REPORTS        sales · conversion funnel · size curve · return reasons
       └─ weekly: zero-result searches · wishlist-to-purchase ratio · courier SLA
```

**Rules:** every destructive action is confirmed and written to `activity_logs` with before/after JSON · revenue is shown **net of cancellations and refunds** by default, with gross as an explicit toggle so the two can never be confused · financial tiles are hidden — not merely disabled — for roles without `reports.financial.view` · a staff member can never grant themselves a permission they don't already hold · dashboard aggregates read from materialized summaries refreshed every 5 minutes, never from live table scans.

---

## F20 · Product Publish Flow

```
DRAFT
  │  1. Details      name · description · fabric · care · category · brand · tags
  │  2. Variants     size × colour × material matrix → SKU auto-generated per variant
  │                  ICE-HOD-BLK-M · ICE-HOD-BLK-L · ICE-HOD-WHT-S …
  │  3. Media        gallery per colourway · ≥2000px for zoom · alt text REQUIRED · video
  │  4. Pricing      MRP · selling price · discount price + schedule · tax class (HSN)
  │  5. Inventory    opening stock per variant per warehouse · low-stock thresholds (F21)
  │  6. Shipping     weight + dimensions (REQUIRED — freight depends on it)
  │  7. SEO          slug · meta title · meta description · OG image
  │  8. Size chart   REQUIRED for apparel — the single biggest lever on returns
  ▼
PUBLISH CHECKLIST (hard gate — publish is blocked until all pass)
  ✓ ≥1 variant   ✓ ≥1 image with alt text   ✓ price set   ✓ category assigned
  ✓ weight & dimensions   ✓ size chart linked   ✓ slug unique
  ▼
PUBLISHED
  ├─ search reindex (F2.3)
  ├─ catalog API caches invalidated: PDP data · category results · home rails
  ├─ sitemap regenerated · product feed updated (Google/Meta)
  ├─ recommendation matrix flagged for the next rebuild (Module 12)
  └─ restock subscribers notified if this is a returning variant (F13)
  ▼
ARCHIVED (never deleted once ordered)
  └─ removed from storefront + feeds · 410 or 301 to the category · history preserved
```

**Rules:** price changes are versioned into `product_price_history` (append-only) and feed margin reporting · a product with orders can never be hard-deleted, only archived · every variant is unique on `(product, size, colour, material)` · discount price must be below selling price, and the "% OFF" badge is computed, never typed · bulk CSV import runs the same validation as the UI, and reports errors per row instead of failing the whole file.

---

## F21 · Inventory Movement Flow

Every quantity change in the system is one of these movements. There are no direct `UPDATE`s to stock — ever.

```
                        on_hand          reserved         available = on_hand − reserved
                           │                 │
 PURCHASE_IN      ────►   +N                 │       goods received from vendor (GRN)
 SALE_RESERVE     ────►    ·                +N       checkout started (F5.2), 15-min TTL
 SALE_CONFIRM     ────►   −N                −N       payment confirmed (F5.3)
 RESERVE_EXPIRE   ────►    ·                −N       checkout abandoned / payment failed
 RETURN_IN        ────►   +N                 ·       return passed QC (F11.4)
 RETURN_SCRAP     ────►    ·                 ·       return failed QC — written off
 RTO_IN           ────►   +N                 ·       undelivered shipment received (F8.4)
 TRANSFER_OUT/IN  ────►   ∓N                 ·       inter-warehouse movement
 ADJUST_UP/DOWN   ────►   ±N                 ·       cycle count — REASON NOTE REQUIRED
 DAMAGE           ────►   −N                 ·       damaged in warehouse
```

### The anti-oversell sequence

```
Two customers buy the last "Black / M" in the same millisecond

  Customer A                          Customer B
      │                                   │
      ├─ BEGIN TRANSACTION                ├─ BEGIN TRANSACTION
      ├─ SELECT … FOR UPDATE  ◄── LOCK ───┤ (blocks here, waiting)
      ├─ available = 1 ✓                  │
      ├─ reserved += 1                    │
      ├─ COMMIT ──────────────── UNLOCK ─►├─ SELECT … FOR UPDATE
      │                                   ├─ available = 0 ✗
      ▼                                   ├─ ROLLBACK
  proceeds to payment                     ▼
                                    ICE-INV-409 — "Black / M just sold out.
                                    L is available, or notify me when M is back" (F13)
```

**Rules:** `available` may never go negative — an attempted over-decrement fails the checkout loudly, never silently · every change writes an `inventory_movements` row with actor and reason · low-stock alerts fire **once per threshold crossing**, not on every subsequent sale · cycle counts reconcile physical vs system and post an `ADJUST_*` with a mandatory note · stock is per `(variant, warehouse)`, and the storefront shows the sum across fulfillable warehouses.

---

## F22 · CMS Publish Flow

```
DRAFT  →  block editor (drag to reorder, duplicate, schedule per block)
   │      hero banner · new-drop rail · Men/Women destination tiles ·
   │      collection rail · brand story · promo strip · announcement bar ·
   │      About · Contact · policy content
   ▼
PREVIEW  →  signed preview URL, never crawlable, expires in 24 h
   ▼
SCHEDULE →  activates and expires by cron (nobody stays up for a midnight drop)
   ▼
PUBLISH
   ├─ CMS API cache keys invalidated for affected routes
   ├─ sitemap regenerated
   ├─ deleted page? → a 301 redirect target is MANDATORY, not optional
   └─ product and collection links validated → any pointing at unpublished
      content or unavailable variants are hidden, not rendered dead
```

**Rules:** banners require desktop creative + mobile creative + alt text before publish · draft content never leaks to crawlers · every publish is versioned and revertible · scheduled promos and countdown strips activate automatically in the store's timezone.

---

## F23 · Edge Cases & Recovery Matrix

The flows above describe what should happen. This is what happens when it doesn't.

| # | Edge case | System behaviour |
|---|---|---|
| 1 | Two buyers, one last unit | Row lock serialises; loser gets `ICE-INV-409` + alternatives + notify-me (F21) |
| 2 | Money debited, no webhook | Reconciliation poller confirms within minutes; customer never chases (F5.5) |
| 3 | Money debited, gateway says failed | Auto-refund + auto-ticket with the payment reference (F5.5) |
| 4 | Amount mismatch | Confirmation blocked, manual review — never a silently wrong order |
| 5 | Customer closes the tab mid-payment | Webhook confirms independently of the browser |
| 6 | Double-tap "Place Order" | Idempotency key → one order, one charge |
| 7 | Price changed while the item sat in the cart | Flagged at cart read with the new price — never a surprise at payment |
| 8 | Coupon expired between add and checkout | Dropped at re-validation with a plain-language reason; total re-shown before confirm |
| 9 | Stock vanished between reserve and confirm | Full auto-refund, immediate notification, alternatives offered |
| 10 | Reservation expired but payment succeeded | Re-reserve; if impossible, full refund + apology + recovery coupon |
| 11 | Courier webhooks go silent | Poller takes over at 6 h; auto-ticket at 48 h; proactive customer update |
| 12 | Duplicate courier webhook | Idempotent on `(provider, awb, event_code, event_time)` |
| 13 | Customer cancels while the warehouse is packing | State re-checked under lock; if already `PACKED`, routed to Manager approval |
| 14 | Wrong item shipped | Free reverse pickup + replacement shipped immediately; warehouse accuracy metric hit |
| 15 | Return never picked up | 3 attempts, then auto-close with notification and a support path |
| 16 | Return QC fails | Photos captured, customer notified with evidence, item returned or scrapped — stock never inflated |
| 17 | Refund fails at the gateway | Retry ×3 with backoff → auto-ticket with full context |
| 18 | Serial returner | Flagged for manual approval — never auto-blocked without a human decision |
| 19 | Guest attempts Add to Bag, Cart, Checkout, Payment, or Place Order | Strict login gate; no guest commerce row is created; one signed bag intent may resume after verification |
| 20 | Account deletion with an open order | Blocked with an explanation until the order and any return complete |
| 21 | Restock of a hyped variant | Batched, throttled fan-out in subscription order |
| 22 | Traffic spike on a drop | Edge caching + queue-backed writes; checkout degrades to a queue, never to an oversell |
| 23 | Product deleted while in someone's cart | Line flagged `unavailable`, excluded from totals, explained at cart read |
| 24 | Notification provider outage | Retry with backoff → dead-letter → ops alert; transactional messages never silently dropped |
| 25 | Search index behind the catalog | Storefront reads live stock on the PDP, so a stale index can never sell a dead SKU |

---

## Flow ownership matrix

| Flow | Customer | Support | Warehouse | Manager | Admin |
|---|---|---|---|---|---|
| F1 Auth · F2 Discovery · F3 Cart · F4 Coupon · F5 Checkout | ● | ○ | | | |
| F6 Order lifecycle | ○ | ○ | ● | ● | ● |
| F7 Fulfilment | | | ● | ○ | ○ |
| F8 Tracking & NDR | ○ | ● | ○ | ● | |
| F10 Cancellation | ● | ○ | | ● | ● |
| F11 Return & exchange | ● | ○ | ● | ● | |
| F12 Refund | ○ | request | | approve | approve |
| F13 Wishlist · F15 Review | ● | | | ○ moderate | ○ |
| F14 Abandoned cart · F17 Notifications | | | | ○ | ● |
| F18 Support | ● | ● | | ○ | ○ |
| F19 Ops · F20 Publish · F21 Inventory · F22 CMS | | | ○ | ● | ● |

● owns · ○ participates

---
# ⚡ Real-Time, Resilience & Offline Strategy

### Real-time requirements

| Use case | Behaviour |
|---|---|
| Stock changes on a drop | PDP availability refreshes on a short TTL; sold-out sizes disable within seconds |
| New order → console | Ops queue updates without a manual refresh |
| Shipment scan → customer | Timeline and notification fire within seconds of the courier webhook |
| Payment webhook → order | Confirmation is immediate and independent of the customer's browser |
| Dashboard tiles | Refresh on a 5-minute rollup, with a manual "refresh now" |

**Transport strategy (phased):** **v1 — smart polling** (TanStack Query refetch on active operational screens; simple, works everywhere with Core PHP) → **v2 — Server-Sent Events** for the ops queues and the customer tracking page → **v3 — WebSockets** via a dedicated sidecar, with Core PHP still serving REST unchanged.

### Resilience

- **Queue everything that can wait.** Notifications, PDFs, labels, reindexing, and feeds are asynchronous. A slow provider never blocks a checkout.
- **Idempotency everywhere on the money path.** Order creation, payment confirmation, refunds, and label generation are all safe to replay.
- **Store raw webhook payloads before parsing.** Providers change formats without notice; replay must always be possible.
- **Never trust silence.** Missing webhooks are detected by pollers (payments at 5 min, couriers at 6 h), not discovered by customers.
- **Degrade, don't fail.** If search is down, category browsing still works. If recommendations are down, the PDP still sells. If a gateway is down, another is offered.

### PWA & offline

The storefront is an installable PWA. Cached application-shell assets, previously fetched catalog API responses, and imagery mean a shopper on a weak connection can still browse and read. **Checkout is deliberately never offline** — an order that cannot verify stock and payment is not an order. What the PWA does offer is a queued "retry when you're back" state that preserves the cart exactly.

---

# 🔎 CSR Storefront Discoverability & Performance Doctrine

The storefront remains CSR-only. Discoverability, shareable URLs, metadata, and performance are still engineering requirements, but the documented limitations of JavaScript-dependent crawling and social previews are accepted.

### Non-negotiables

| Requirement | Implementation |
|---|---|
| Client-rendered catalog | Every PDP, destination, collection, About, and Contact route renders in the browser from REST API data |
| Structured data | The client inserts `Product` + `Offer` + `AggregateRating` + `BreadcrumbList` JSON-LD on PDPs and `Organization` on About/Contact after route data resolves |
| Canonicals | One canonical per product; filtered/sorted variants canonicalize to the clean destination or collection URL |
| Sitemaps | Auto-generated and split (products · destinations · collections · content), regenerated on publish (F20, F22). Served by the **backend/CDN**, alongside `robots.txt` — never by a Next.js route handler |
| Redirects | A deleted or renamed page **must** declare a 301 target — enforced in the CMS, served by the backend/CDN |
| Meta & OG | Title, description, and OG image remain required before publish; the client updates route metadata after data loads, while non-JavaScript preview agents may see only shell defaults |
| Indexation control | `noindex` on cart, checkout, account, search results, and tracking pages |
| Image delivery | AVIF/WebP with responsive `srcset`, explicit dimensions (zero CLS), lazy below the fold, priority hint on the LCP image |
| Core Web Vitals | LCP ≤ 2.0 s · INP ≤ 200 ms · CLS ≤ 0.1, enforced by Lighthouse CI as a **build gate** |

### Performance budget (enforced in CI)

| Budget | Limit |
|---|---|
| JS shipped to a PDP | ≤ 180 KB gzipped |
| LCP image | ≤ 150 KB, preloaded |
| Fonts | 3 families max, `woff2`, `font-display: swap`, subset, self-hosted |
| Third-party scripts | ≤ 2 on the critical path; everything else deferred or server-side |
| Below-the-fold blocks | Reviews, recommendations, and recently-viewed are lazy — they may never delay LCP |

---

# 🔗 Third-Party Integrations

| Category | Providers | Notes |
|---|---|---|
| **Payments** | Razorpay (primary, India) · Stripe · PayPal | UPI, cards, netbanking, wallets, EMI, BNPL. Idempotent capture, refunds, payment links, tokenized cards |
| **Shipping** | Shiprocket · Delhivery · Bluedart · India Post · self-ship | AWB, labels, manifests, pickup scheduling, serviceability, reverse pickup |
| **Messaging** | WhatsApp Business API · DLT-registered SMS · SMTP/ESP · Web Push (VAPID) | Order updates, OTPs, campaigns, wishlist and restock alerts |
| **Auth** | Google OAuth · Apple Sign-In | OIDC, server-side token verification |
| **Analytics** | GA4 · Meta Pixel · server-side conversion events | Deduplicated by event ID; consent-gated |
| **Product feeds** | Google Merchant Center · Meta Catalog | Auto-regenerated on catalog publish |
| **Media** | Object storage + image CDN | On-the-fly AVIF/WebP derivatives |
| **Support** | Live chat + chatbot provider | Handoff carries the full transcript and order context |
| **Accounting** | Tally (XML) · CSV/Excel export | Clean ledger hand-off to the CA |
| **Automation** | Outbound webhooks + scoped API keys | `order.created`, `order.shipped`, `stock.low`, `return.created` |

Every integration sits behind an interface (`PaymentGateway`, `ShippingProvider`, `MessagingChannel`) so a new provider is a new adapter class — never a change to checkout, fulfilment, or notification code.

---

# 🖨 Hardware & Peripheral Support

| Peripheral | Use | Integration |
|---|---|---|
| Barcode scanners (USB / Bluetooth) | Pick, pack, return QC, cycle count | Keyboard-wedge input into the warehouse console |
| Thermal label printers (4×6) | Shipping labels, manifests | Provider-generated PDF/ZPL → local print bridge |
| A4 laser printers | Invoices, packing slips | Standard PDF |
| Weighing scales (USB/serial) | Actual parcel weight at pack | Local bridge service; falls back to manual entry |
| Android rugged scanners | Warehouse floor operations | Browser-based console, touch targets ≥ 44 px, offline-tolerant task list |
| Label/QR on cartons | Return identification | Generated per return, scanned at QC |

---

# 🎨 UI/UX Vision — the Iced-Out Design Language

The store must read as a **fashion editorial that happens to sell**, not a catalogue with a checkout. The complete specification lives in the [`style guide`](../../design/docs/style-guide.md); the [`design tokens`](../../design/styles/tokens/tokens.css) and [`Tailwind configuration`](../../design/config/tailwind.config.js) are the implementation.

**Five adjectives:** dark · editorial · glassy · gold-accented · oversized.

### Design language

Depth is built from **translucent glass over near-black**, never from shadows. The design authors exactly **one** shadow in the entire system, and it is reserved for the cart drawer. Contrast comes from typography — oversized display type against small uppercase mono metadata — and from a single antique-gold accent used sparingly enough that it still means something.

### Colour tokens

| Token | Value | Role |
|---|---|---|
| `--ice-black-900` | `#121212` | Page background |
| `--ice-black-600` | `#232323` | Opaque raised surfaces — cart drawer, dropdowns, mobile menu |
| `--ice-cream-50` | `#f4f2ed` | Primary text |
| `--ice-white` | `#ffffff` | Hover text / emphasis |
| `--ice-gold-500` | `#cebd63` | **Brand accent** — primary buttons, selected size pill, badges, active timeline steps |
| `--ice-gold-600` | `#ad9d49` | Gold hover only |
| `--ice-clay-500` | `#ce7563` | Error / danger |
| `--ice-grey-400` | `#777777` | Strike-through compare-at price |
| `--text-muted` | `rgba(244,242,237,.60)` | Secondary text |
| `--state-warning` · `--state-info` | `#d9a441` · `#7fa8c9` | ⚠️ **Phase 0 exit blocker** — order and stock states depend on both, but neither exists in `tokens.css`. Add them with verified AA contrast on `#121212` before component work begins |

### The glass surface — the signature recipe

```css
background-color: rgba(255, 255, 255, 0.05);
border: 1px solid rgba(255, 255, 255, 0.15);
backdrop-filter: blur(2rem);            /* 32px */
transition: background-color .2s, border-color .2s, color .2s;

/* hover — three properties move at once, nothing lifts or scales */
:hover {
  background-color: rgba(255, 255, 255, 0.07);
  border-color: rgba(255, 255, 255, 0.50);
  color: #ffffff;
}
```

Applied to: buttons, product cards, size pills, form inputs, accordions, cart lines, order cards, badges, nav items, and every console panel. **This recipe is the brand.**

### Imagery — flat darkener + grain, never a gradient

```css
.media { position: relative; overflow: hidden; transform: translate(0); border-radius: 1rem; }
.media::before { inset: 0; background: #121212; opacity: .2; }   /* flat darkener */
.media::after  { inset: 0; background-image: url("/assets/noise.png"); }  /* film grain */
```

`overflow: hidden` is always paired with `transform: translate(0)` so the radius clips transformed children cleanly. Radius lives on the **wrapper**, never on the `<img>`. There are **zero gradients** in this design.

### Typography

| Role | Family | Weight | Use |
|---|---|---|---|
| Display | **Chillax** | 400 | Headlines, product names, section titles, hero type |
| Body | **Satoshi** | 300 | Descriptions, paragraphs, form labels, editorial copy |
| Mono / meta | **Roboto Mono** | 400 | **Prices**, sizes, SKUs, order numbers, nav items, eyebrows, badges — 14/12 px, uppercase, `1px` tracking |

**Prices are always Roboto Mono, uppercase, `1px` tracking, with the compare-at price muted and struck through.** Setting a price in Satoshi breaks the brand. Display type uses `clamp()` — never `vw` with breakpoint pinning, which makes headings visibly shrink at a breakpoint boundary.

### Spacing, radii, borders, motion

- **Spacing:** 8 px base ladder — `2 · 4 · 8 · 16 · 32 · 48 · 64 · 80 · 96 · 128 · 192` — applied through wrapper divs, with documented responsive overrides. `16px` is the workhorse gap.
- **Radii:** `8px` for controls (buttons, inputs, pills) and `16px` for surfaces (cards, panels, media). That two-step split is the entire system — no third mid-radius. Card radius collapses to `8px` at ≤ 479 px.
- **Borders:** `1px`, always. It is the only width used anywhere.
- **Motion:** `200ms ease` for controls · `500ms cubic-bezier(.165,.84,.44,1)` for surfaces and cards · reveal = opacity 0→1 + `translateY(20px)`→0 over 500 ms. Nothing lifts, scales, or shadow-shifts on hover.
- **Filled buttons keep `border: 1px solid transparent`** so the primary and ghost variants never differ in size.

### Commerce component rules

| Component | Rule |
|---|---|
| **Size pill** | Glass at rest · gold fill when selected · **disabled + struck-through when sold out — never hidden** |
| **Colour swatch** | Actual colour chips with a gold ring when selected, never text labels |
| **Price** | Roboto Mono; compare-at price muted, struck through, always to the right |
| **Product card** | Media wrapper (radius 16, darkener + grain) · name in Chillax · price in mono · heart top-right |
| **Add to bag** | Gold primary, full-width on mobile, sticky on the PDP below the fold |
| **Cart drawer** | Right slide-in, `#232323` opaque surface, `0 5px 30px rgba(0,0,0,.4)` — the one shadow in the system |
| **Order timeline** | Completed steps gold with a checkmark; pending steps muted with an open circle |
| **Empty states** | Never a bare "no results" — always an illustration, a sentence, and a route out |
| **Toast** | Glass surface, bottom-right desktop / bottom-full mobile, 5 s, with undo where applicable |

### Accessibility — fixes the source design lacks

The reference template ships **no focus ring**, **no reduced-motion handling**, and leaks light-mode commerce defaults onto a near-black page. All three are corrected here and are ship-blockers:

```css
:where(a, button, input, select, textarea, [tabindex]):focus-visible {
  outline: 2px solid var(--accent-brand);
  outline-offset: 2px;
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: .01ms !important;
    transition-duration: .01ms !important;
    scroll-behavior: auto !important;
  }
}
```

Plus: WCAG 2.1 AA contrast throughout · full keyboard navigation on checkout and console · ≥ 44 px touch targets · a skip link · correct heading order · `aria-live` on cart and stock updates · sold-out and disabled states that are legible on black rather than the inherited `#e6e6e6`.

### Responsive

`360px` (mobile) → `4K`. Breakpoints at **479 · 767 · 991 · 1440**. Product grids reflow 1 → 2 → 3 → 4 columns; the filter rail becomes a bottom sheet at ≤ 991; card radius tightens at ≤ 479. Grids never hide a product to make a row fit — a hidden product is a deleted sale.

### Dark and light

The design is **dark-first and dark-native**; that is the brand. A light theme exists as a `[data-theme="light"]` token block for anyone who needs it, with the gold darkened to `#8f7f2e` because `#cebd63` on cream is ~1.7:1 and fails contrast badly.

---

# 🗄 Database Standards & Documentation

### Deliverables

ER diagram · relationships · foreign keys · indexes · constraints · table-by-table data dictionary · naming standards · seed data · migration strategy · backup & restore runbook.

Expected tables: **≈120 (121 exact)**

### Naming & design conventions

| Convention | Rule |
|---|---|
| Tables | `snake_case`, plural — `product_variants`, `order_items` |
| Primary key | `id` — `BIGINT UNSIGNED AUTO_INCREMENT` |
| Foreign keys | `<singular>_id` — `product_id`, `customer_id` |
| Timestamps | `created_at`, `updated_at`, `deleted_at` (soft delete) |
| Booleans | `is_active`, `is_published`, `is_returnable` |
| Money | `DECIMAL(12,2)` — rounding rules documented centrally, never floats |
| Quantities | `INT` — stock is never fractional |
| Enums | Lookup tables (avoid MySQL `ENUM`) |
| Status columns | Lookup reference or documented constant, never a magic string |
| Charset / engine | `utf8mb4` · InnoDB |

### Table groups

`users · user_addresses · user_sessions` · `products · product_variants · product_images · categories · sizes · colors · materials` · `inventory · inventory_movements · inventory_reservations · warehouses` · `carts · cart_items` · `orders · order_items · order_status_history · invoices` · `payments · payment_attempts · refunds · settlements · settlement_lines · payment_reconciliation_cases · store_credit_transactions` · `shipments · shipment_events · shipping_zones · shipping_rates` · `return_requests · return_items · return_qc · exchanges` · `coupons · coupon_redemptions` · `reviews · review_images` · `wishlist_items` · `notifications · notification_logs · notification_preferences` · `support_tickets · ticket_messages · faqs` · `cms_pages · cms_page_versions · cms_blocks · banners` · `roles · permissions · audit_logs · activity_logs`

Three deliberate absences: there is **no generic `attributes` (EAV) table** — `sizes`, `colors`, and `materials` are first-class apparel axes, which preserves `(product_id, size_id, color_id, material_id)` uniqueness and fast variant lookup, and a new sellable axis is an explicit migration rather than a data row. There is **no `wishlists` header table** — each customer has one canonical wishlist, so `wishlist_items.user_id` is the owner. And the return aggregate is **`return_requests`**, never `returns`.

### Integrity rules

- **Append-only ledgers:** `inventory_movements`, `store_credit_transactions`, `order_status_history`, `payment_attempts`. Never updated, never deleted.
- **Row locks** (`SELECT … FOR UPDATE`) on inventory decrement and invoice-number allocation.
- **Composite indexes** on every hot path: `(product_id, size_id, color_id)`, `(order_status, created_at)`, `(user_id, created_at)`.
- Financial and stock writes always run inside an explicit transaction; the transaction never spans an external HTTP call.

---

# 🔌 API Standards & Documentation

REST APIs: **383 endpoints, enumerated in [`backend.md`](./backend.md) §11** · Base URL: `/api/v1` (URI versioning)

> The Phase 3 estimate was 180–260. The customer-facing surface landed inside it at 146 endpoints; the remaining 224 are console endpoints backing the 60+ `/admin` pages specified in [`frontend.md`](./frontend.md) §4.2, plus 13 webhook and partner routes. `backend.md` §11 is the authoritative catalogue.

### Standard response envelope

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

**Error example:**

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

### Conventions

- Resources are **plural nouns**: `/api/v1/products`, `/api/v1/orders`
- Filtering `?category=hoodies&size=M&in_stock=true` · Sorting `?sort=-created_at`
- Pagination `?page=1&per_page=24` → `meta: { page, per_page, total, total_pages }`
- Dates in **ISO 8601 UTC**; money as string decimals with currency (`"3499.00"`, `"INR"`)
- **`Idempotency-Key` required** on order creation, payment confirmation, and refunds
- Rate limiting per token with `X-RateLimit-*` headers
- HTTP status usage: `200/201/204` success · `400/422` validation · `401/403` auth · `404` missing · `409` conflict · `429` throttled · `500` server
- Error codes: `ICE-<MODULE>-<HTTP>` — `ICE-INV-409` (stock), `ICE-CPN-422` (coupon), `ICE-PAY-409` (payment mismatch), `ICE-ORD-409` (illegal transition)

### API surfaces

| Surface | Prefix | Auth |
|---|---|---|
| Public catalog & content | `/api/v1/{products,categories,search,cms,...}` | none |
| Customer session | `/api/v1/{me,cart,checkout,...}` | customer JWT (in-memory access token) |
| Console | `/api/v1/console/*` | staff JWT + permission |
| Webhooks | `/api/v1/webhooks/*` | HMAC signature |
| Partner | `/api/v1/partner/*` | scoped API key |

### Per-endpoint documentation includes

URL · method · authentication · permissions · validation rules · request example · response example · database changes · business rules · error catalogue · rate limits.

---

# 🔐 Security Standards

### Application security
- OWASP Top 10 compliance · **prepared statements only**, zero string-built SQL
- Input validation on both sides (Zod on the client, mirrored backend validators)
- Output encoding · strict CORS allow-list · security headers (HSTS, CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy)
- File uploads (review photos, return evidence, product media) are type-checked, size-capped, stripped of EXIF, and served from a separate origin

### Authentication & access
- Argon2id hashing · rotating refresh tokens with reuse detection and family revocation
- **Access tokens live in JavaScript memory only** — never `localStorage`, never `sessionStorage`, never a non-`HttpOnly` cookie. Refresh tokens are `HttpOnly; Secure; SameSite=Lax`, path-scoped to `/api/v1/auth/refresh` (F1.4)
- **CSRF protection is mandatory, not conditional** — a double-submit token on refresh and on every cookie-authenticated mutation, because the refresh endpoint is cookie-authenticated
- Customer and staff sessions use **different cookie names and different JWT audiences**; a customer refresh cookie presented to `/admin` is rejected on audience before any role check runs
- Documented **RBAC/permission matrix** per module and action (Module 20)
- Sensitive actions — refund, price change, role change, data export, PII view — require permission **and** are audit-logged with before/after JSON
- Mandatory 2FA for Admin in production

### Data protection
- TLS 1.2+ everywhere · encrypted backups
- Secrets in environment variables only — never committed, never returned by any API
- **PCI-DSS SAQ-A:** card data never touches our servers — gateway-hosted fields and network tokenization only
- **DPDP Act (India) aware:** consent-based customer data, purpose limitation, deletion on request (F1.6), consent records versioned

### Operations
- Dependency vulnerability scanning in CI · least-privilege DB users · separate credentials per environment
- Webhook endpoints verify HMAC signatures and reject replays outside a time window
- Rate limits per endpoint class (Module 20) with `429` + `Retry-After`

---

# 🌍 Localization, Tax & Compliance

- **i18n-ready** frontend — English first; Hindi and regional languages pluggable, with currency and number formatting per locale
- INR default with multi-currency readiness; prices stored per currency, never converted at display time
- **GST-native billing:** CGST/SGST/IGST split by place of supply, HSN per product, inclusive/exclusive pricing, tax-slab configuration (5% apparel below the threshold, 12% above), sequential invoice series per financial year, GSTR-1 friendly exports, e-invoicing readiness flag
- Credit notes for every cancellation and return — invoices are never deleted or edited
- Legal pages managed in the CMS: Terms, Privacy, Returns & Refunds, Shipping, Cookie policy — each versioned with an effective date
- Consent capture for marketing (email/SMS/WhatsApp) recorded with timestamp, source, and IP

---

# 🧪 Testing Strategy

| Layer | Tooling | Scope | Target |
|---|---|---|---|
| Unit (backend) | PHPUnit | Pricing, coupons, tax, shipping rates, store credit, stock math | ≥ 85% of Services |
| Unit (frontend) | Vitest + React Testing Library | Hooks, utils, shared components | ≥ 70% of shared code |
| API / integration | PHPUnit + Postman/Newman | Endpoint contracts, RBAC, validation, idempotency | All endpoints |
| E2E | Playwright | The critical flows below | 100% |
| Performance | k6 | Drop-day traffic, checkout under load | p95 ≤ 300 ms |
| Frontend budget | Lighthouse CI | LCP · INP · CLS · bundle size | Build gate |
| Security | OWASP ZAP + manual review | Top-10 vectors, authz bypass, IDOR on order IDs | Every release |
| Accessibility | axe + manual keyboard pass | Storefront + checkout + console | WCAG 2.1 AA |
| UAT | Pilot with real orders | A full week of live operations | Owner sign-off |

### E2E flows that must always pass

`F1` register → login · `F13` guest wishlist → login-gated Move to Bag · `F3` guest Add to Bag blocked → login → signed intent resumes once · direct guest Cart/Checkout/Payment/Place Order blocked · `F5` authenticated prepaid checkout · `F5` authenticated COD checkout · `F5.5` payment failure → retry → success · **concurrent purchase of the last unit (F21) — must produce exactly one order** · `F7` pick → pack → label → dispatch · `F8` courier webhook → timeline → notification · `F10` cancel → refund · `F11` return → QC → restock → refund · `F4` coupon apply/reject paths.

Additional practices: seeded demo data for every module · regression suite runs in CI · **every fixed bug gets a test first**.

---

# 🚢 DevOps & Deployment

### Environments

| Environment | Purpose |
|---|---|
| `local` | Developer machines (Docker Compose parity) |
| `dev` | Integration of merged features |
| `staging` | Production mirror — UAT, load tests, release rehearsal |
| `production` | Live store |

### Workflow & releases

- Git: protected `main` · `develop` · `feature/*` · `fix/*`
- **Conventional Commits** → auto-generated CHANGELOG · **Semantic Versioning**
- CI (GitHub Actions): lint → type-check → tests → Lighthouse budget → build → deploy
- Frontend → static deploy (`output: 'export'`) behind a CDN, with no middleware and no edge runtime · Backend → Nginx + PHP-FPM with zero-downtime symlink releases
- `sitemap.xml`, `robots.txt`, and all redirects are served by the **backend/CDN**, never by Next.js route handlers
- DB migrations gated and reversible; never destructive in the same release as the code that depends on the removal
- **Feature flags** for drops, payment providers, and new checkout steps — ship dark, enable deliberately

### Reliability

- Backups: nightly full + binlog point-in-time recovery (**RPO ≤ 5 min, RTO ≤ 1 h**), encrypted and offsite, restore-tested quarterly
- Monitoring: uptime checks on checkout · error tracking (Sentry, FE + BE) · structured JSON logs with `request_id` · slow-query review
- Alerting on the things that cost money: payment success rate, checkout error rate, webhook backlog, queue depth, oversell events
- Status page + incident runbooks · a documented **drop-day playbook** (scale up, cache warm, queue drain, war room)

---

# 🚀 Development Roadmap

| Phase | Focus | Key deliverables |
|---|---|---|
| **1** | Vision & requirements | Project charter, personas, requirement catalog, scope sign-off |
| **2** | Business flows | Every flow in §14 documented to implementation depth, with edge cases |
| **3** | Module documentation | All 20 modules specified — screens, tables, endpoints, rules |
| **4** | Database design | Full ER diagram, data dictionary, migrations, seed plan |
| **5** | API documentation | Endpoint contracts, envelope, error catalogue |
| **6** | Design system | Tokens, Tailwind config, component library built to §19 |
| **7** | Frontend architecture | Next.js CSR shell, storefront and `/admin` route bundles, client auth/RBAC guards |
| **8** | Backend architecture | Core PHP kernel, middleware, first vertical slice (Catalog → Cart → Checkout → Order) |
| **9** | Commerce build-out | Payments, inventory, orders, shipping, tracking, returns |
| **10** | Growth build-out | Wishlist, reviews, recommendations, notifications, **CMS authoring (19b)** |
| **11** | Ops build-out | Admin dashboard, analytics, support, warehouse console |
| **12** | Testing & hardening | Full test matrix, load test, security review, accessibility audit |
| **13** | Launch & operate | Production launch, monitoring, backup drills, drop-day rehearsal, handover |

**CMS read (19a) lands in Phase 7**, with the storefront shell, seeded from fixtures — not in Phase 10. The homepage is CMS-driven, so a browsable storefront cannot wait for the authoring tools.

### Phase cross-map

The three planning documents count phases differently because they measure different things. They are not in conflict; this table is the mapping.

| Blueprint phase (13) | `frontend.md` phase (11) | `database.md` step (10) |
|---|---|---|
| 1 · Vision & requirements | — | — |
| 2 · Business flows | — | — |
| 3 · Module documentation | — | 1 · Conventions & baseline |
| 4 · Database design | — | 2 · Identity, catalog, inventory |
| 5 · API documentation | — | 3 · Cart, checkout, orders |
| 6 · Design system | 0 · Tooling, tokens, primitives | — |
| 7 · Frontend architecture | 1 · Auth, users, storefront shell, CMS read (19a) | 4 · Payments & money path |
| 8 · Backend architecture | 2–3 · Catalog, PDP, cart, checkout | 5 · Shipping & fulfilment |
| 9 · Commerce build-out | 4–6 · Orders, payments, fulfilment, returns | 6–7 · Returns, refunds, coupons |
| 10 · Growth build-out | 7–8 · Wishlist, reviews, recommendations | 8 · CMS, reviews, notifications |
| 11 · Ops build-out | 9 · CMS authoring (19b), coupons, analytics, RBAC | 9 · Admin, audit, analytics |
| 12 · Testing & hardening | 10 · Hardening, accessibility, performance | 10 · Hardening, backup, PITR drill |
| 13 · Launch & operate | 10 · Launch gates | 10 · Launch gates |

---

# 📊 Success Metrics

| Metric | Target |
|---|---|
| Conversion rate (site-wide) | ≥ 2.5% |
| Cart → order completion | ≥ 65% |
| Checkout completion time (returning customer) | ≤ 60 seconds |
| Cart abandonment | ≤ 65%, with ≥ 8% recovered via F14 |
| Oversell incidents | **0** |
| Order accuracy (right item, right size) | ≥ 99.5% |
| On-time dispatch (same/next business day) | ≥ 95% |
| Return rate | ≤ 20%, trending down as fit signal improves |
| RTO rate | ≤ 5% |
| Refund turnaround (QC pass → gateway refund) | ≤ 24 h |
| Payment success rate | ≥ 92% |
| Support first-response SLA adherence | ≥ 95% |
| Repeat purchase rate (12 months) | ≥ 35% |
| System uptime | ≥ 99.9% (checkout ≥ 99.95%) |
| LCP on PDP (4G mobile) | ≤ 2.0 s |

### Organic traffic — a monitored risk, not a committed metric

Organic traffic share was previously listed as a target of ≥ 30% of sessions by month 12. It has been **downgraded to a monitored risk with a named owner**, because it is the one metric that depends on the CSR-only decision being wrong.

The tension is real and worth stating plainly. Google renders JavaScript, but on a deferred second pass that runs slower for large catalogs, so rankings will lag a server-rendered competitor. Social preview agents — WhatsApp, Instagram, X, Slack — mostly do not execute JavaScript at all, which means a shared product link shows the generic shell title and OG image. For a D2C streetwear brand distributing through social sharing and drop links, that is a direct revenue cost, not an SEO abstraction.

CSR-only stands: it is a documented architectural decision in all three planning documents. What changes is how the consequence is tracked.

| | |
|---|---|
| Status | Monitored risk with a named owner, reviewed at the Phase 6/7 boundary |
| In-architecture escape hatch | An edge prerender service for known bot user-agents — the **only** one, and explicitly **out of scope for v1** |
| Gate | Phase 12 measures actual crawl coverage and social-preview coverage against the 30% figure **before launch**, so the decision is revisited with data rather than after a bad quarter |

If OG previews on shared drop links matter to the brand, revisit this before Phase 7, while it is still cheap.

---

# 📈 Expected Documentation Size

- 110–160 Markdown files
- 130,000–200,000+ words
- 450+ pages (equivalent)
- ≈120 database tables (121 exact)
- 383 REST APIs (146 customer-facing · 224 console · 13 webhook/partner) — enumerated in [`backend.md`](./backend.md) §11
- 20 modules (19 delivered as 19a + 19b) · 22 documented end-to-end flows
- Complete UI, frontend, and backend documentation
- Integration playbooks & security documentation

---

# 📖 Glossary

| Term | Meaning |
|---|---|
| **SKU** | Stock Keeping Unit — the unique code for one variant (`ICE-HOD-BLK-M`) |
| **Variant** | A specific size × colour × material combination of a product — the unit stock is tracked against |
| **PDP** | Product Detail Page |
| **ATP / Available** | `on_hand − reserved` — what a shopper can actually buy right now |
| **Reservation** | A temporary hold on stock during checkout; expires if payment doesn't complete |
| **AWB** | Air Waybill — the courier's tracking number for a shipment |
| **EDD** | Estimated Delivery Date |
| **NDR** | Non-Delivery Report — a failed delivery attempt requiring customer action |
| **RTO** | Return to Origin — an undelivered shipment coming back to the warehouse |
| **RMA** | Return Merchandise Authorization — an approved return |
| **QC** | Quality Check on a returned item, before restocking |
| **COD** | Cash on Delivery |
| **AOV / LTV** | Average Order Value / Lifetime Value |
| **CVR** | Conversion Rate |
| **RFM** | Recency, Frequency, Monetary — customer segmentation model |
| **WISMO** | "Where Is My Order" — the most common support contact reason |
| **Sell-through** | Units sold ÷ units received, over a period |
| **Size curve** | The ratio of sizes sold — the input to next season's buy |
| **Drop** | A timed, limited product launch |
| **CSR** | Client-Side Rendering — the browser fetches JSON and builds every application view |
| **PWA** | Progressive Web App — installable, offline-tolerant web app |
| **Idempotency key** | A client-supplied key making a repeated request safe to replay |
| **Glass surface** | The signature Iced-Out recipe: 5% white fill + 1px 15% white border + 32px blur |

---

# 💡 Final Goal

The objective of this project is to build a **world-class clothing e-commerce platform** that goes beyond a storefront by combining modern architecture, enterprise-grade engineering, real inventory truth at size-and-colour granularity, premium editorial design, and comprehensive documentation.

Every flow in §14 is written to be built exactly as specified — because the difference between a store that works and a store that leaks money is never the homepage. It is what happens when two people buy the last M at the same moment, when the payment webhook arrives late, when the courier goes silent, and when the parcel comes back.

The documentation serves as the definitive blueprint for designers, frontend developers, backend developers, QA engineers, DevOps engineers, and future contributors — ensuring consistency, scalability, and maintainability throughout the entire product lifecycle.

> **One platform. Every flow. Zero leakage.**
