# Frontend architecture and planning map

This document records how the current frontend translates the repository planning and design material. It is a boundary document, not a backend implementation plan.

## Current delivery

| Planning concern | Frontend implementation |
| --- | --- |
| Public commerce | Home, catalogue destinations, collection detail, search, wishlist, product detail, policy, and tokenized tracking routes |
| Product truth | Typed products and variants with SKU, price, compare-at price, stock state, size availability, media, and care content |
| Customer gate | Declarative guards for cart, checkout, account, payment, and ordering surfaces |
| Purchase journey | Contact, delivery, shipping, payment, review, and confirmation steps with a sticky summary |
| Customer account | Overview, profile, addresses, orders, order detail, returns, wishlist, reviews, notifications, support, and security |
| Staff boundary | Separate staff sign-in, seeded preview roles, permission-shaped navigation, forbidden state, and route guards |
| Operations | Dashboard, orders/queues, fulfilment, shipments, catalog/publishing/imports, inventory/counting/transfers, returns/QC, customers, reviews, support/FAQ/chat, marketing, notifications, CMS, analytics, access, and settings |
| Payments | Overview, transactions, transaction detail, refunds, mismatch review, reconciliation, settlements, and settlement detail |
| CMS read path | Typed page-block contract, fixture repository, query hook, and explicit block registry |
| CMS authoring | Home block composition, page library, navigation contract, redirects, versions, validation, and preview-only publish controls |
| SEO/privacy | Public metadata plus `noindex` for search, wishlist, tracking, customer sessions, staff auth, and every operations route |
| API preparation | Separate public, customer, and admin Axios clients with request context and normalized errors |

## Design translation

The implementation uses the repository token package as its source of truth. The visual system keeps the documented near-black canvas, warm off-white text, muted gold accent, thin translucent borders, restrained glass surfaces, editorial display type, monospaced controls, and square-to-soft geometry. Storefront pages use campaign-scale composition; operations pages use dense queue, editor, scanner, ledger, audit, and context-panel patterns. Focus visibility, reduced-motion behavior, and responsive layouts are included as first-class states.

The bundled Syne, Manrope, and Roboto Mono files are local, privacy-safe substitutes for the documented display, body, and utility roles. Licensed Chillax or Satoshi files can later replace the first two without changing component structure.

## Backend handoff boundary

The frontend currently exposes fixture repositories behind the same read-oriented shape expected from an API. When backend work is authorized, replace repositories and session previews while keeping consumers stable:

1. Connect `src/api/clients.ts` to real public, customer, and admin origins.
2. Replace product and CMS fixtures with query functions that return the existing typed models.
3. Replace preview sign-in with cookie-backed refresh sessions and in-memory access tokens.
4. Resolve staff permissions from the API on every new session; never trust a client-supplied role.
5. Re-fetch prices, promotion results, stock, shipping quotes, tax, payment status, and order state from authoritative endpoints.
6. Convert checkout actions into idempotent API mutations and use the returned order snapshot on confirmation.

Until that work is explicitly started, every amount, inventory figure, order, customer, payment, refund, and settlement shown in the app is illustrative frontend data only.

## Route ownership

Route groups communicate audience without changing URLs:

- `(storefront)` owns public discovery and evaluation.
- `(customer-auth)` owns sign-in, registration, and password recovery.
- `(customer-session)` owns customer-protected commerce and account work.
- `(staff-auth)` owns staff-only entry and denial states.
- `(admin)` owns permission-shaped operations pages.

`src/config/route-rules.ts` is the single frontend access map. Route files compose shells and feature components; domain behavior belongs under `src/features/`.
