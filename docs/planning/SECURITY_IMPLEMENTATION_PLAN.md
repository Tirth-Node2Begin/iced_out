# SECURITY AUDIT & IMPLEMENTATION PLANNING TASK

## ROLE

Act as a **principal application security architect and senior penetration-testing-aware software security engineer with 20+ years of experience** securing large-scale production applications.

Assume you have extensive experience securing:

* E-commerce platforms
* Payment systems
* Wallet and stored-value systems
* Razorpay integrations
* PHP applications
* Next.js applications
* Static-export frontend applications
* REST APIs
* CRM and admin panels
* Multi-application architectures
* Shared database systems
* Session-based authentication systems
* Apache and cPanel production deployments
* MySQL databases
* OWASP Top 10 vulnerabilities
* OWASP API Security Top 10 vulnerabilities
* Authentication and authorization systems
* Financial transaction integrity
* Production deployment security
* Incident response and logging

Your job is to perform a **deep security analysis of the existing repository architecture and create a complete implementation plan**.

---

# PRIMARY OBJECTIVE

Create a new repository document:

```text
SECURITY_IMPLEMENTATION_PLAN.md
```

The document must contain a complete, prioritized, production-grade security enhancement plan for the existing **Iced-Out e-commerce platform and CRM**.

The repository contains:

```text
Iced-Out/

├── frontend/                    Storefront
├── backend/                     Storefront PHP API
├── iced-out-crm/
│   ├── frontend/                CRM/Admin frontend
│   └── backend/                 CRM/Admin PHP API
├── docs/
├── tools/
└── live/
```

This is a production-oriented Indian e-commerce platform using:

* Next.js 16 static export
* PHP 8.2 core backend
* MySQL 8 production database
* MariaDB local development
* Razorpay
* Customer authentication
* Staff authentication
* Wallet functionality
* Orders
* Payments
* Refunds
* Inventory
* CRM
* Admin operations
* Media uploads
* Coupons
* Vouchers
* Returns
* Support
* Shipping
* Shared MySQL schema
* Separate storefront and CRM applications

---

# ABSOLUTE NON-NEGOTIABLE CONSTRAINTS

## DO NOT CHANGE EXISTING FUNCTIONALITY

Before proposing anything, understand this clearly:

**The goal is SECURITY ENHANCEMENT ONLY.**

Do NOT change:

* Existing business logic
* Existing checkout flow
* Existing Razorpay flow
* Existing wallet flow
* Existing order creation flow
* Existing API response contracts
* Existing API request contracts
* Existing frontend design
* Existing UI
* Existing frontend routes
* Existing backend route structure
* Existing database architecture unless a security migration is absolutely necessary
* Existing CRM business logic
* Existing inventory calculations
* Existing money calculations
* Existing authentication flow unless required to close a verified security vulnerability
* Existing authorization model unless required to fix an authorization vulnerability
* Existing session behavior unless required for security
* Existing static export architecture
* Existing CSR-only architecture
* Existing deployment model without documenting compatibility

Do NOT:

* Rewrite the backend
* Introduce Laravel
* Introduce a Node.js backend
* Introduce an ORM
* Convert the application to SSR
* Convert Next.js pages to server-rendered pages
* Replace the existing framework architecture
* Replace the payment provider
* Replace the authentication system
* Perform unnecessary refactoring
* Rename modules for style reasons
* Change working business behavior

Security changes must be:

> **minimal, additive, compatible, isolated, and low-risk**

Every recommendation must preserve current behavior unless the existing behavior itself is insecure.

---

# FIRST TASK: ANALYZE BEFORE PLANNING

Before writing `SECURITY_IMPLEMENTATION_PLAN.md`, analyze the repository thoroughly.

Do NOT immediately start proposing generic OWASP recommendations.

Inspect and understand the actual project.

Your analysis must specifically examine the following areas.

---

# 1. ARCHITECTURE ANALYSIS

Understand the four-application architecture.

```text
Storefront Frontend
        ↓
Storefront API
        ↓
        ├───────────────┐
        │ Shared MySQL  │
        └───────────────┘
        ↑
CRM API
        ↑
CRM Frontend
```

Confirm and analyze:

* Separate frontend applications
* Separate backend applications
* Shared database
* Separate customer and staff session cookies
* Separate token spaces
* Shared `SESSION_SECRET`
* Shared media storage
* Shared database migrations
* Independent deployments
* No backend-to-backend communication

Identify the security implications of this architecture.

Especially analyze:

### Shared database risks

Determine whether:

* Storefront backend can access CRM-sensitive tables
* CRM backend has more privileges than necessary
* Both PHP applications use the same database credentials
* A compromise of one backend could expose the entire schema
* Database users should be separated by application responsibility
* Production database privileges follow least privilege

Do not automatically recommend changing credentials or database structure.

First determine whether the existing architecture can safely support privilege separation without changing business behavior.

---

# 2. FRONTEND SECURITY ANALYSIS

Analyze both:

```text
frontend/
```

and:

```text
iced-out-crm/frontend/
```

Inspect:

* API clients
* Axios configuration
* `withCredentials`
* Public environment variables
* `NEXT_PUBLIC_*`
* localStorage usage
* session handling
* URL parameters
* search parameters
* query string IDs
* client-side rendering
* Suspense boundaries
* dynamic content rendering
* HTML injection risks
* CMS rendering
* error rendering
* payment handling
* wallet UI
* order UI
* admin UI
* route protection

Specifically check for:

### XSS

Look for:

```text
dangerouslySetInnerHTML
innerHTML
DOMParser
document.write
HTML injection
unsafe markdown rendering
unsafe CMS block rendering
unescaped API data
```

Determine whether:

* CMS content can execute JavaScript
* Product data can introduce HTML
* Reviews can introduce HTML
* Support messages can introduce HTML
* CRM notes can introduce HTML
* Error messages can introduce HTML
* URL parameters can introduce DOM-based XSS

Do not recommend a generic sanitizer without identifying exactly where sanitization is required.

---

# 3. API SECURITY ANALYSIS

Analyze all APIs.

Storefront API:

```text
backend/
```

CRM API:

```text
iced-out-crm/backend/
```

Analyze the complete middleware pipeline:

```text
RequestId
→ SecurityHeaders
→ Cors
→ HandleErrors
→ Maintenance
→ ResolveRoute
→ BodyLimit
→ RateLimitByIp
→ Authenticate
→ OriginCheck
→ RateLimitByPrincipal
→ Authorize
→ Validate
→ Idempotency
→ Audit
→ Controller
```

For every middleware component, determine:

* What attacks it currently protects against
* What attacks remain possible
* Whether the order is secure
* Whether middleware can be bypassed
* Whether public routes accidentally skip protection
* Whether authenticated routes correctly enforce audience separation
* Whether authorization occurs before sensitive data access
* Whether rate limits can be bypassed
* Whether client-controlled headers are trusted incorrectly

Pay particular attention to:

```text
X-Client-Audience
X-Request-Id
X-Client-Timezone
Accept-Language
Idempotency-Key
Origin
Referer
X-Forwarded-For
X-Real-IP
```

Determine whether any security decision incorrectly trusts client-controlled headers.

---

# 4. AUTHENTICATION SECURITY

Analyze customer authentication separately from staff authentication.

Customer cookie:

```text
io_csess
```

Staff cookie:

```text
io_ssess
```

Analyze:

* Cookie flags
* HttpOnly
* Secure
* SameSite
* Domain
* Path
* Session rotation
* Session fixation
* Session invalidation
* Password changes
* Password resets
* Login attempts
* Brute-force protection
* Account enumeration
* Password storage
* Password hashing algorithm
* Password reset token security
* Session token entropy
* HMAC verification
* Secret rotation capability
* Logout behavior
* Revoke-other-sessions behavior
* Idle expiration
* Absolute expiration

Specifically verify:

### Cross-audience isolation

A customer session must never authenticate as staff.

A staff session must never authenticate as a customer.

Test:

```text
customer cookie → CRM API
staff cookie → storefront customer API
customer token → staff endpoint
staff token → customer endpoint
```

The current repository notes that this guarantee exists but the end-to-end test is missing.

Create a security implementation recommendation for restoring this test.

Do not change the existing token model unless an actual vulnerability requires it.

---

# 5. CSRF SECURITY ANALYSIS

The existing application intentionally uses:

```text
SameSite=Lax
+
Origin/Referer validation
```

There is currently no CSRF token.

Do NOT blindly add CSRF tokens.

First determine whether the existing protection is sufficient for:

* Customer mutations
* Wallet redemption
* Order creation
* Payment verification
* Password changes
* Address changes
* Refund actions
* CRM state changes
* Staff operations
* Uploads
* Logout

Analyze edge cases including:

* Missing Origin
* Missing Referer
* Same-origin requests
* Cross-origin requests
* Form POST requests
* Browser navigation behavior
* Subdomain deployments
* CRM subdomain
* Proxy deployments
* HTTPS termination

If the existing model is insufficient, recommend the smallest compatible enhancement.

---

# 6. AUTHORIZATION / IDOR / BOLA ANALYSIS

Perform a detailed authorization analysis.

The application has:

* Customers
* Staff
* Roles
* Permissions
* Orders
* Payments
* Wallets
* Refunds
* Addresses
* Reviews
* Support tickets
* CRM records
* Inventory
* Media
* Shipments

Test conceptually and inspect code for:

### IDOR / BOLA vulnerabilities

Examples:

```text
/me/orders/{id}
```

Can one user access another user's order?

```text
/me/sessions/{id}
```

Can one user revoke another user's session?

```text
/media/{id}
```

Can restricted media be accessed publicly?

```text
/admin/orders/{id}
```

Does staff permission enforcement happen before data access?

```text
CRM contact/company/deal IDs
```

Can a staff member access data outside intended authorization?

Verify:

* Repository queries are scoped correctly
* User IDs come from the authenticated principal
* Client-provided IDs are not trusted for ownership
* Authorization checks occur server-side
* Permission checks cannot be bypassed with frontend manipulation
* Wildcard admin permissions are handled safely

Do not rely on frontend route protection as security.

---

# 7. PAYMENT SECURITY — REAL RAZORPAY PRODUCTION MODE

This is a high-priority area.

The website will use a real Razorpay live payment gateway.

Analyze the existing flow:

```text
1. Server creates Razorpay order
2. Razorpay Checkout opens
3. Client receives payment response
4. Server verifies Razorpay signature
5. Server creates order
```

Verify the following.

## Amount integrity

The browser must never control:

* Final amount
* Product price
* Discount amount
* Shipping fee
* Tax
* Wallet deduction
* Coupon value
* Refund amount

All financial calculations must remain server-authoritative.

Confirm whether the existing implementation already does this.

If there are weaknesses, recommend minimal security hardening.

---

## Payment verification

Ensure that:

```text
razorpay_signature
```

is verified only server-side using the correct server secret.

Ensure:

* Timing-safe comparison where applicable
* Payment IDs cannot be reused
* Razorpay order IDs are bound to internal checkout/order context
* Payment attempts are tracked
* Duplicate verification cannot create duplicate financial records
* Failed payments cannot be marked successful
* Browser success callbacks are never treated as payment proof

---

## CRITICAL: REMOVE LIVE DEGRADED PAYMENT MODE

The repository currently describes a degraded mode where, when the API is unavailable, the frontend can still open the gateway and receive a browser callback marked:

```text
verified: false
```

This behavior is acceptable only for development/testing.

For live Razorpay production payments:

> **There must be no path that can create, confirm, fulfil, mark paid, or financially process a production payment based only on a browser claim.**

Analyze the smallest compatible security enhancement.

Recommended principle:

```text
LIVE PAYMENT
API unavailable
        ↓
PAYMENT FLOW FAILS SAFELY
        ↓
NO ORDER CONFIRMATION
NO PAID STATUS
NO WALLET CREDIT
NO FULFILMENT
```

Do not change the normal successful checkout flow.

Do not redesign checkout.

Only prevent unsafe degraded behavior when production credentials are used.

---

# 8. RAZORPAY WEBHOOK SECURITY

Analyze whether Razorpay webhooks are currently implemented.

If they are missing or incomplete, create a plan for production-grade webhook security.

Requirements:

* Dedicated webhook endpoint
* HTTPS only
* Razorpay webhook secret
* Signature verification
* Raw request body verification
* Constant-time signature comparison
* Event deduplication
* Replay protection
* Idempotent processing
* Persistent webhook event storage
* Webhook audit trail
* Safe retry behavior
* Event ordering handling
* Unknown event handling
* Failed processing recovery
* No trust in client callback alone

Use the existing:

```text
webhook_inbox
domain_events_outbox
idempotency_keys
```

architecture if appropriate.

Do not create a second parallel event architecture unless necessary.

Webhook processing must preserve existing order and payment business logic.

The goal is to add authoritative reconciliation and security, not rewrite payment architecture.

---

# 9. WALLET SECURITY — CRITICAL FINANCIAL AREA

The website has:

```text
wallet_accounts
wallet_entries
```

and:

```text
GET /me/wallet
POST /me/wallet/redeem
```

The wallet must be treated as a financial ledger.

Analyze:

* Wallet balance calculation
* Wallet redemption
* Concurrent requests
* Double spending
* Race conditions
* Negative balance prevention
* Idempotency
* Replay attacks
* Transaction isolation
* Database locking
* Order cancellation interaction
* Refund interaction
* Payment interaction
* Admin adjustment capability
* Audit logs

Security requirements:

### The wallet balance must never be trusted from the client.

### The wallet balance must never be updated by arbitrary client input.

### Wallet redemption must be atomic.

A secure conceptual flow should be:

```text
BEGIN TRANSACTION

Lock wallet account

Recalculate/verify available balance

Validate redemption amount

Reject insufficient balance

Create immutable wallet ledger entry

Apply redemption

Commit

Create/reuse idempotency record
```

However:

Do not force a redesign if the repository already has equivalent protection.

First inspect existing code.

Then document:

* Current protection
* Identified gaps
* Required enhancement
* Exact files/modules likely affected
* Required tests

Also analyze whether wallet money and Razorpay payments can be safely combined.

The same checkout must not accidentally:

* Deduct wallet twice
* Charge Razorpay twice
* Credit wallet twice
* Confirm order twice
* Process a refund twice

---

# 10. FINANCIAL TRANSACTION SECURITY

Analyze all financial entities:

```text
orders
payments
payment_attempts
refunds
payouts
wallet_accounts
wallet_entries
coupon_redemptions
```

Verify:

* Idempotency
* Transaction boundaries
* Atomic operations
* Race conditions
* Double spending
* Double refunds
* Double order creation
* Duplicate payment capture
* Duplicate webhook events
* Refund authorization
* Refund amount validation
* Currency validation
* Money integer/decimal safety

The project uses:

```text
Domain\Money
```

with integer paise.

Preserve this design.

Do not introduce floats.

Analyze database transactions for:

```text
SELECT ... FOR UPDATE
```

or equivalent locking where concurrent financial writes require it.

Do not recommend locks where unnecessary.

---

# 11. INVENTORY RACE CONDITION SECURITY

Because checkout and CRM share the same database, analyze inventory concurrency.

Potential attacks/failures:

* Two customers purchasing the last item simultaneously
* Duplicate inventory reservation
* Reservation expiration races
* Payment succeeds after inventory is unavailable
* Admin changes stock during checkout
* CRM dispatch changes order state concurrently
* Retry requests create duplicate reservations

Analyze:

```text
inventory_reservations
stock_items
variant_inventory
inventory_movements
```

Determine whether database transactions and locking are sufficient.

Preserve the existing inventory business model.

Only recommend concurrency/security hardening where necessary.

---

# 12. API RATE LIMITING AND ABUSE PROTECTION

Analyze the existing:

```text
RateLimitByIp
RateLimitByPrincipal
```

middleware.

Create a risk-based rate limit plan.

Do NOT use one generic limit for everything.

Separate categories such as:

### Authentication

```text
login
register
forgot password
reset password
```

### Financial operations

```text
checkout
payment verification
wallet redemption
refund operations
```

### Expensive operations

```text
search
catalog filters
exports
analytics
CRM imports
media uploads
```

### Sensitive actions

```text
password change
session revocation
permission changes
staff login
admin settings
```

Consider:

* IP spoofing behind proxies
* X-Forwarded-For trust configuration
* Shared IP addresses
* Distributed attacks
* Account-based limits
* Retry behavior
* Login lockouts
* API abuse

Do not introduce third-party infrastructure unless the existing hosting architecture requires it.

The application must still work with:

```text
Redis optional
file fallback
job_queue fallback
```

---

# 13. SECURITY HEADERS

Analyze the existing:

```text
SecurityHeaders
```

middleware.

Verify production readiness for:

```text
Content-Security-Policy
Strict-Transport-Security
X-Content-Type-Options
Referrer-Policy
Permissions-Policy
X-Frame-Options or CSP frame-ancestors
Cross-Origin-Opener-Policy
Cross-Origin-Resource-Policy
```

Because this application uses:

* Razorpay Checkout
* Next.js static assets
* Images
* APIs
* Possibly external fonts
* Analytics
* Media

Do not recommend a CSP that breaks the storefront.

Create:

1. Development-safe policy
2. Production policy
3. Report-only rollout phase if appropriate

Identify exact external origins that must be allowed only after inspecting the code/configuration.

Do not use wildcard CSP directives unless unavoidable and justified.

---

# 14. CORS AND ORIGIN SECURITY

Analyze:

```text
Cors
OriginCheck
```

middleware.

Because the production architecture uses same-origin API calls:

```text
/api/v1/*
```

CORS should not be broadly open.

Verify:

* No `Access-Control-Allow-Origin: *` with credentials
* No reflection of arbitrary Origin headers
* CRM origin separation
* Storefront origin separation
* Development origins
* Preview deployments
* Production domains

Plan for:

```text
iced-out.node2begin.com
crm.iced-out.node2begin.com
```

without hard-coding insecure wildcard behavior.

---

# 15. FILE UPLOAD SECURITY

The project already:

* Sniffs file headers
* Validates MIME
* Re-encodes images
* Removes EXIF
* Resizes images
* Uses random storage keys
* Keeps media storage outside direct web access
* Serves media through the API
* Uses `nosniff`

Inspect the implementation rather than assuming it is secure.

Analyze remaining risks:

* Image bombs
* Decompression bombs
* Extremely large dimensions
* Memory exhaustion
* GIF handling
* SVG uploads
* Polyglot files
* Filename attacks
* Content-Disposition
* Cache headers
* Authorization for private media
* Media enumeration
* Upload rate abuse

Preserve the existing upload architecture.

Only recommend targeted hardening.

---

# 16. DATABASE SECURITY

Analyze:

* PDO configuration
* Prepared statements
* Emulated prepares
* SQL injection risks
* Dynamic SQL
* ORDER BY injection
* Filter injection
* Import/export features
* CRM search
* Reporting queries

Verify:

```text
PDO::ATTR_EMULATE_PREPARES
PDO::ATTR_ERRMODE
```

and appropriate security behavior.

Inspect all raw SQL construction patterns.

Especially check:

* Search
* Sorting
* Pagination
* Filtering
* CRM import
* Reports
* Export

Determine whether dynamic identifiers are whitelisted rather than parameter-bound incorrectly.

---

# 17. DATABASE ACCOUNT LEAST PRIVILEGE

Because both applications currently share one schema, analyze whether production can use:

```text
storefront_db_user
crm_db_user
migration_db_user
```

or equivalent roles.

Potential principle:

### Storefront API

Only required permissions for:

* Customer data
* Catalog reads
* Orders
* Payments
* Wallet
* Checkout
* Public media
* Customer-owned data

### CRM API

Required operational access.

### Migration user

DDL privileges only.

However:

Do not automatically require this change if cPanel hosting limitations make it impractical.

Document:

* Ideal architecture
* Compatible implementation
* Current hosting limitations
* Risk level

Do not change application behavior.

---

# 18. PRODUCTION SECRET MANAGEMENT

Analyze all secrets:

```text
SESSION_SECRET
DB_PASS
RAZORPAY_KEY_SECRET
RAZORPAY_WEBHOOK_SECRET
SMTP_PASSWORD
ITHINK_SECRET_KEY
REMOVE_BG_API_KEY
VERCEL_OIDC_TOKEN
```

Security requirements:

* Never expose secrets to frontend
* Never log secrets
* Never return secrets through API
* Never commit secrets
* Production `.env` permissions
* Separate development and production secrets
* Secret rotation plan
* Shared secret synchronization strategy

Pay attention to the existing requirement that both backends currently share:

```text
SESSION_SECRET
```

Do not accidentally break session interoperability.

However, analyze whether:

* Customer and staff token signing should use audience-specific derivation
* Separate keys can be derived from the same root secret
* Key rotation can be supported without breaking all sessions unexpectedly

Only recommend changes if security benefit justifies compatibility impact.

---

# 19. LOGGING AND AUDITING

Analyze:

```text
audit_logs
staff_activity_logs
activity_feed
ops_signals
```

Verify that security-sensitive events are logged.

Recommended events to evaluate:

* Login success
* Login failure
* Account lockout
* Password reset request
* Password reset completion
* Password change
* Session revocation
* Wallet redemption
* Wallet adjustment
* Payment verification
* Payment webhook
* Refund request
* Refund approval
* Permission changes
* Role changes
* Admin login
* Sensitive setting changes
* Media upload
* Failed authorization
* Suspicious rate-limit activity

Do not log:

* Passwords
* Tokens
* Session cookies
* Razorpay secrets
* Full card information
* Sensitive credentials

Create a structured logging and redaction plan.

---

# 20. ERROR HANDLING SECURITY

Analyze:

```text
HandleErrors
error-normalizer.ts
Response.php
```

Ensure production errors do not expose:

* Stack traces
* SQL queries
* Database credentials
* Internal paths
* Secret values
* Framework internals
* Token data

Ensure:

```text
request_id
```

is preserved for debugging.

Create a safe distinction between:

```text
development errors
production errors
```

without changing API response contracts unnecessarily.

---

# 21. ADMIN / CRM SECURITY

The CRM is a high-value target.

Analyze:

* Staff authentication
* Idle timeout
* Role permissions
* Wildcard admin permissions
* Sensitive operations
* Exports
* Refund approval
* Payment reconciliation
* Inventory adjustments
* Catalog publishing
* User/customer management
* CRM import
* Media upload
* Store settings
* Audit log access

Identify operations requiring enhanced security.

Consider:

### Step-up authentication

For extremely sensitive actions such as:

* Changing payment settings
* Changing Razorpay configuration
* Refund approval
* Wallet adjustments
* Permission changes
* Role changes
* Deleting critical records

Do not automatically redesign authentication.

Instead evaluate whether:

* Recent login verification
* Password confirmation
* Additional audit requirement
* Optional MFA

can be added without disrupting normal CRM usage.

MFA should be evaluated as a future or high-priority production feature for privileged accounts.

---

# 22. CUSTOMER ACCOUNT SECURITY

Analyze:

```text
/profile
/security
/password
/sessions
/addresses
/wallet
/orders
/returns
```

Verify protection against:

* Account takeover
* Session hijacking
* Session fixation
* Password reset abuse
* Email enumeration
* Unauthorized session management
* Wallet theft
* Order data exposure

Evaluate whether notifications should occur for:

* New login
* Password change
* Password reset
* Session revocation
* Wallet transaction

Document compatibility impact before recommending.

---

# 23. DEPLOYMENT SECURITY — CPANEL / APACHE / LITESPEED

The current production deployment is:

```text
cPanel
Apache/LiteSpeed
.htaccess
shared hosting
no root access
```

The current flat deployment puts backend files near the document root and depends on `.htaccess`.

This is a high-priority production security concern.

Analyze:

### Current flat deployment

```text
live/site/
```

where backend directories and `.env` protection depend on `.htaccess`.

Determine:

* What happens if `.htaccess` is disabled
* Whether Apache configuration can expose `.env`
* Whether PHP source files can be downloaded
* Whether storage directories can be accessed
* Whether backups can be exposed
* Whether `.git` can be exposed
* Whether migration files can be exposed
* Whether logs can be exposed

The repository already has three protection layers.

Verify whether they are sufficient.

---

## Preferred production deployment

Evaluate the existing:

```text
split
```

layout.

```text
public_html/
iced-out-api/
```

The security plan should prioritize:

> Backend application code, `.env`, logs, migrations, storage, seeds, and secrets must be outside the public document root whenever hosting supports it.

Do not require a deployment redesign immediately.

Provide:

### Option A — Immediate hardening

Compatible with current flat deployment.

### Option B — Recommended production deployment

Split public and private directories.

### Option C — Future VPS/Nginx architecture

For larger production scale.

Each option must explain:

* Security benefit
* Implementation effort
* Compatibility
* Hosting requirements
* Migration risk

---

# 24. HTTPS AND TRANSPORT SECURITY

Analyze:

* HTTPS enforcement
* HTTP → HTTPS redirect
* HSTS rollout
* Secure cookies
* TLS certificate renewal
* Mixed content
* Razorpay requirements
* CRM HTTPS

Do not recommend HSTS preload until deployment is stable and all subdomains are HTTPS-ready.

---

# 25. WEBHOOK AND EXTERNAL API SECURITY

Analyze integrations:

```text
Razorpay
iThink Logistics
Remove.bg
SMTP
```

For each integration verify:

* Secret storage
* Timeouts
* TLS verification
* Request validation
* Response validation
* Retry behavior
* Webhook signature verification
* Logging redaction
* Failure behavior

Never disable TLS verification.

Never silently accept invalid external responses.

---

# 26. DEPENDENCY SECURITY

Analyze:

```text
package.json
package-lock.json / pnpm-lock.yaml
composer.json
composer.lock
```

Create a dependency security plan covering:

* npm vulnerabilities
* Composer vulnerabilities
* Lockfile integrity
* Production dependency minimization
* Dependency update process
* Automated vulnerability scanning

Do not blindly upgrade packages.

Identify:

* Security-critical vulnerabilities
* Breaking-change risks
* Upgrade priority

---

# 27. SECURITY TESTING STRATEGY

The repository already contains:

```text
node tools/audit.mjs
PHPUnit
PHPStan
Playwright
Smoke tests
Fixture parity tests
```

Do NOT replace these systems.

Extend the existing testing architecture.

Create a security test matrix.

Include:

### Authentication tests

* Customer/staff separation
* Expired sessions
* Revoked sessions
* Session fixation
* Logout invalidation

### Authorization tests

* IDOR/BOLA
* Missing permissions
* Wildcard permission behavior
* Cross-user resource access

### Payment tests

* Amount tampering
* Fake payment callback
* Duplicate verification
* Replayed payment ID
* Duplicate webhook
* Failed payment
* API unavailable during live payment

### Wallet tests

* Double spend
* Concurrent redemption
* Insufficient balance
* Duplicate idempotency key
* Replay request

### API tests

* Rate limit
* Origin spoofing
* CORS misconfiguration
* Body size abuse
* Invalid JSON

### Upload tests

* Fake MIME
* Polyglot image
* SVG script payload
* Large image
* Image bomb attempt

### Deployment tests

* `.env` inaccessible
* `.git` inaccessible
* logs inaccessible
* storage inaccessible
* migration files inaccessible

All tests must be safe for automated execution.

---

# 28. SECURITY MONITORING

Create a monitoring plan for production.

Include signals such as:

* Repeated login failures
* Rate limit spikes
* Authorization failures
* Payment verification failures
* Webhook signature failures
* Wallet redemption anomalies
* Refund anomalies
* Unexpected admin activity
* Upload abuse
* Server errors

Use the existing:

```text
ops_signals
audit_logs
staff_activity_logs
```

where appropriate.

Avoid introducing unnecessary monitoring infrastructure.

Provide:

* Minimum viable monitoring
* Recommended production monitoring
* Future scalable monitoring

---

# 29. INCIDENT RESPONSE PLAN

Include a lightweight security incident response section.

Scenarios:

### Compromised staff account

### Leaked Razorpay secret

### Database credential leak

### Session secret leak

### Payment webhook abuse

### Wallet fraud

### SQL injection discovery

### Malicious upload

### Unauthorized data access

For each scenario define:

```text
Detect
Contain
Rotate
Investigate
Recover
Document
```

Do not include unnecessary enterprise bureaucracy.

Make it practical for a small-to-medium production e-commerce team.

---

# 30. SECURITY IMPLEMENTATION PRIORITIES

The final `SECURITY_IMPLEMENTATION_PLAN.md` must classify every action.

Use:

## P0 — BLOCKING BEFORE LIVE PAYMENT / PUBLIC SCALE

Examples may include:

* Payment verification vulnerabilities
* Live degraded payment path
* Wallet double-spend vulnerabilities
* Missing Razorpay webhook verification
* Public secret exposure
* Broken authorization
* Production `.env` exposure
* Insecure cookies
* SQL injection

## P1 — REQUIRED PRODUCTION HARDENING

Examples:

* CSP rollout
* Rate limit tuning
* Security tests
* Logging redaction
* Cross-audience session integration test
* Dependency vulnerability remediation

## P2 — STRONG SECURITY IMPROVEMENTS

Examples:

* Step-up authentication
* MFA for admins
* Enhanced monitoring
* Database privilege separation

## P3 — FUTURE SECURITY MATURITY

Examples:

* Dedicated WAF
* Centralized SIEM
* Automated incident detection
* Advanced anomaly detection

Do not assign priorities based on generic best practices.

Prioritize based on actual repository risk.

---

# REQUIRED OUTPUT FILE STRUCTURE

Create:

```text
SECURITY_IMPLEMENTATION_PLAN.md
```

Use the following structure.

---

# Iced-Out Security Implementation Plan

## 1. Executive Summary

Explain:

* Current security maturity
* Strong existing security controls
* Highest risks
* Production readiness status

---

## 2. Scope and Non-Negotiable Constraints

Explicitly state:

```text
Security enhancement only.
No unnecessary changes to business logic, API contracts, frontend design, or architecture.
```

---

## 3. Architecture Security Assessment

Include a diagram of:

```text
Storefront
API
CRM
Shared Database
External Payment Gateway
Wallet
Webhooks
```

---

## 4. Existing Security Controls

Document what already exists.

Examples to verify rather than assume:

* Middleware pipeline
* HMAC sessions
* Separate cookies
* Origin checking
* Rate limiting
* Idempotency
* Audit logging
* Money integer model
* Upload re-encoding
* Random media storage keys
* Server-side payment verification
* Permission system

---

## 5. Security Risk Register

Create a table:

| ID | Area | Risk | Current State | Severity | Likelihood | Priority | Required Action |
| -- | ---- | ---- | ------------- | -------- | ---------- | -------- | --------------- |

Use real findings.

---

## 6. Payment Security Plan

Detailed Razorpay production hardening.

Include:

* Server authority
* Signature verification
* Order binding
* Duplicate prevention
* Webhooks
* Reconciliation
* Live degraded-mode blocking

---

## 7. Wallet Security Plan

Detailed wallet financial integrity plan.

Include:

* Atomic transactions
* Concurrency protection
* Double-spend prevention
* Immutable ledger
* Idempotency
* Audit trail

---

## 8. Authentication and Session Security Plan

Include:

* Customer/staff separation
* Cookie hardening
* Session rotation
* Cross-audience testing
* Password security

---

## 9. Authorization and IDOR Protection Plan

Include:

* Ownership checks
* Permission enforcement
* Sensitive resource protection

---

## 10. API Security Plan

Include:

* Validation
* Rate limiting
* CORS
* Origin validation
* Body limits
* Request IDs
* Error handling

---

## 11. Frontend Security Plan

Include:

* XSS
* localStorage risks
* URL parameters
* CMS rendering
* Admin route security

---

## 12. Database Security Plan

Include:

* SQL injection
* Prepared statements
* Dynamic query safety
* Transactions
* Least privilege

---

## 13. File Upload Security Plan

Include:

* Current protections
* Remaining risks
* Targeted hardening

---

## 14. Deployment Security Plan

Include:

### Immediate cPanel hardening

### Recommended split deployment

### Future VPS architecture

---

## 15. Secrets and Environment Security Plan

Include:

* Secret exposure prevention
* Rotation
* Environment separation
* Logging redaction

---

## 16. Security Headers and Browser Protection

Include:

* CSP rollout
* HSTS
* Permissions Policy
* Frame protection

---

## 17. CRM/Admin Security Plan

Include:

* Privileged operations
* Step-up authentication
* MFA roadmap
* Audit logging

---

## 18. Dependency Security Plan

Include:

* npm
* Composer
* Lockfiles
* Vulnerability scanning

---

## 19. Security Testing Plan

Include an exact test matrix.

For each test define:

```text
Test name
Attack scenario
Expected behavior
Existing/new test location
Priority
```

---

## 20. Production Monitoring Plan

Include:

* Security signals
* Payment anomalies
* Wallet anomalies
* Admin anomalies

---

## 21. Incident Response Plan

Include:

```text
Detect
Contain
Rotate
Investigate
Recover
Document
```

---

## 22. Implementation Roadmap

Create phases.

### Phase 0 — Repository Security Audit

### Phase 1 — P0 Production Blockers

### Phase 2 — Payment and Wallet Hardening

### Phase 3 — API and Authentication Hardening

### Phase 4 — Deployment Hardening

### Phase 5 — Monitoring and Security Tests

### Phase 6 — Advanced Security

For every task provide:

```text
Priority
Risk
Expected files/modules
Implementation type
Compatibility impact
Testing requirement
Rollback strategy
```

---

## 23. Exact Repository Impact Map

Create a table:

| Security Area | Existing Module/File | Change Type | Risk |
| ------------- | -------------------- | ----------- | ---- |

Use actual repository paths discovered during analysis.

Do not invent files.

---

## 24. Security Acceptance Checklist

Create a production go-live checklist.

Examples:

### Authentication

```text
[ ] Secure cookies enabled
[ ] HttpOnly enabled
[ ] Cross-audience tests pass
[ ] Password reset protected
```

### Payment

```text
[ ] Razorpay live keys stored only in backend
[ ] Signature verification tested
[ ] Webhook verification enabled
[ ] Degraded live payment disabled
[ ] Duplicate payment protection tested
```

### Wallet

```text
[ ] Atomic redemption
[ ] Double-spend tests pass
[ ] Negative balance impossible
[ ] Audit trail exists
```

### Deployment

```text
[ ] .env inaccessible publicly
[ ] storage inaccessible publicly
[ ] logs inaccessible publicly
[ ] HTTPS enforced
```

---

# IMPLEMENTATION RULES

When preparing recommendations:

## Rule 1 — Inspect Before Recommending

Never write:

```text
Add X security feature
```

unless you have inspected whether X already exists.

Use one of:

```text
Already secure — no change required
Existing protection — harden
Security gap — implementation required
Cannot verify — requires manual production validation
```

---

## Rule 2 — Preserve API Contracts

Do not change response structures such as:

```json
{
  "data": {},
  "meta": {}
}
```

or:

```json
{
  "error": {},
  "meta": {}
}
```

unless a verified security issue makes it unavoidable.

---

## Rule 3 — Preserve Business Logic

Security must wrap and protect existing logic.

Do not redesign:

* Orders
* Checkout
* Wallet
* Inventory
* CRM
* Payment flow

---

## Rule 4 — Prefer Server-Side Enforcement

Frontend security controls are usability improvements.

Server-side checks are security.

Every critical protection must be enforceable even if an attacker:

* Modifies JavaScript
* Calls the API directly
* Changes request bodies
* Changes headers
* Uses Postman
* Replays requests
* Sends concurrent requests

---

## Rule 5 — Financial Operations Are Zero-Trust

For:

```text
Payments
Wallet
Refunds
Orders
Coupons
Inventory
```

The browser must never be the authority.

The database and backend transactions must enforce integrity.

---

## Rule 6 — No Security Through Obscurity

Do not consider something secure merely because:

* It is hidden in the frontend
* A route is not linked
* An ID is hard to guess
* The CRM is on another port
* The API is not publicly documented

---

## Rule 7 — No Breaking Changes Without Justification

For every recommendation that could change behavior, document:

```text
Why required
What security risk it fixes
Compatibility impact
Migration plan
Rollback plan
```

---

# IMPORTANT SPECIAL REQUIREMENTS

## REAL PRODUCTION PAYMENT

The website will use:

```text
Razorpay Live Mode
```

Therefore:

* No browser-only payment success
* No unverified payment confirmation
* No test-key fallback behavior in production
* No fulfilment before authoritative verification
* Webhooks must be verified
* Payment events must be idempotent
* Amounts must be server-authoritative

---

## WEBSITE WALLET

The website contains a customer wallet.

Treat it as real financial value.

Therefore:

* No client-side balance authority
* No race-condition double spending
* No negative balance
* No duplicate redemption
* No duplicate refund credit
* No mutable transaction history
* Full auditability

---

## SEPARATE STORE + CRM

The application consists of separate public and administrative surfaces.

Therefore:

* Customer authentication must remain isolated
* Staff authentication must remain isolated
* CRM permissions must be server-enforced
* Shared database access must be analyzed carefully
* Cross-application privilege escalation must be tested

---

# FINAL EXECUTION REQUIREMENTS

After completing the repository analysis:

1. Create:

```text
SECURITY_IMPLEMENTATION_PLAN.md
```

2. Do not modify application code.

3. Do not modify backend logic.

4. Do not modify frontend logic.

5. Do not modify database migrations.

6. Do not modify environment files.

7. Do not modify deployment configuration.

8. Do not install dependencies.

9. Do not execute destructive tests.

10. Do not expose secrets found during analysis.

This task is:

> **ANALYSIS + SECURITY IMPLEMENTATION PLANNING ONLY**

The final document must be specific to this repository.

Avoid generic security advice.

Reference:

* Actual modules
* Actual middleware
* Actual architecture
* Actual API routes
* Actual database tables
* Actual payment flow
* Actual wallet flow
* Actual deployment architecture

When the implementation plan is complete, provide a concise summary containing:

```text
Security readiness assessment
Number of P0 findings
Number of P1 findings
Number of P2 findings
Top production blockers
Recommended implementation order
```

Do not claim a vulnerability exists unless repository inspection supports it.

If something cannot be verified from the repository, explicitly mark it:

```text
MANUAL VERIFICATION REQUIRED
```

The security plan must be practical enough that a development team can implement it step-by-step without changing the existing product behavior.
