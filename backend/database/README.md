# Database

MySQL 8.x in production. MariaDB 10.4+ (the engine XAMPP ships as "MySQL") works
for local development — the migrations pick their collation per server, so the
same files run on both.

**`migrations/` is the source of truth.** The `.sql` files in this folder are its
exported output, regenerated with `php bin/console.php db:export`. Never edit
them by hand — a change made here is lost the next time anyone exports.

## Files

| File | Contents |
|---|---|
| `iced_out.sql` | schema + reference data — **import this one** |
| `iced_out_schema.sql` | structure only: 68 tables, 3 views |
| `iced_out_reference_data.sql` | migration state, RBAC matrix, store settings |

Reference data is portable: no secrets, no per-install values.

## Import through phpMyAdmin

1. Start Apache + MySQL in the XAMPP control panel.
2. Open <http://localhost/phpmyadmin>.
3. **Import** tab → choose `backend/database/iced_out.sql` → **Go**.
   The file creates the `iced_out` database itself, so no database needs to be
   selected first.
4. Create the demo accounts (see below).

Or from the command line:

```bash
"C:\xampp\mysql\bin\mysql.exe" -u root < backend/database/iced_out.sql
```

## Or build it from the migrations instead

```bash
cd backend
php bin/console.php db:create
php bin/console.php migrate
php bin/console.php seed
```

Both routes end at the same schema. `migrate` after an import correctly reports
"nothing to migrate" — the dump carries the `schema_migrations` rows.

## Demo accounts are not in the SQL

Password hashes are peppered with this install's `SESSION_SECRET`, so an
exported hash would not verify anywhere else. Accounts come from the seeder:

```bash
php bin/console.php seed
```

| Audience | Email | Password |
|---|---|---|
| Customer | `shopper@example.com` | `secret1` |
| Staff (ADMIN) | `admin@gmail.com` | `admin123` |

Dev fixtures only — production gets real credentials and empty registers.

## What is in here

68 base tables and 3 views, grouped as in `backend_setup.md` §6.

| Group | Tables | Notable |
|---|---|---|
| Identity & access | `users`, `user_addresses`, `user_sessions`, `auth_tokens`, `login_attempts`, `roles`, `permissions`, `role_permissions`, `user_roles`, `staff_activity_logs` | session tokens stored as SHA-256, never in the clear |
| Catalog | `products`, `product_variants`, `categories`, `collections`, `collection_products`, `product_price_history`, `media_assets`, `product_rating_summaries`, `search_queries` | `products.public_id` **is** the slug; `product_variants.public_id` **is** the SKU |
| Inventory | `warehouses`, `stock_items`, `variant_inventory`, `inventory_movements`, `inventory_reservations`, `inventory_transfers`, `inventory_transfer_items` | `available` is a generated column, never written |
| Cart & discounts | `carts`, `cart_items`, `checkout_drafts`, `coupons`, `vouchers`, `coupon_redemptions` | one ACTIVE cart per customer, enforced by a generated unique key |
| Orders & payments | `orders`, `order_items`, `order_status_history`, `order_cancellation_requests`, `payments`, `payment_attempts`, `refunds`, `payouts`, `idempotency_keys`, `webhook_inbox` | no PAN/CVV column exists anywhere (SAQ-A) |
| Shipping | `shipments`, `shipment_events`, `courier_pickups`, `shipment_labels`, `ndr_cases` | `shipment_events` is a **cache** of the external tracking API, not a record |
| Returns, reviews, support | `return_requests`, `return_status_history`, `reviews`, `review_moderation_history`, `support_queries`, `support_status_history`, `faqs` | one review per ordered product, via a generated unique key |
| CMS & platform | `cms_pages`, `cms_page_versions`, `cms_blocks`, `store_settings`, `notification_preferences`, `inbox_messages`, `contact_messages`, `audit_logs`, `domain_events_outbox`, `job_queue` | `cms_blocks.type` is limited to the 7 renderable types |
| Analytics | `trading_days`, `ops_signals`, `activity_feed` | the dashboard's 200-day window |
| Platform | `schema_migrations` | applied migrations, checksummed |

Views: `v_variant_availability` (per-size stock with the PDP badge derived),
`v_order_timeline` (status history + shipment events in one stream),
`v_dashboard_queues` (the six console queue counts).

## Conventions

- `id BIGINT UNSIGNED AUTO_INCREMENT` is internal; `public_id` carries the
  UI-visible identifier (`ord-local-07`, `pay_ICE2003`, `IO-2026-1049`).
- Timestamps are `DATETIME(6)` in **UTC**. Display is Asia/Kolkata and happens
  only in the presenter layer.
- Money is `DECIMAL(12,2)` plus `currency CHAR(3)`. Floats are never used.
- Status columns are `VARCHAR(32)` with `CHECK` constraints, not MySQL `ENUM`,
  so adding a value is a migration and not a table rebuild.
- Ledger tables (`*_history`, `*_logs`, `inventory_movements`,
  `payment_attempts`, `login_attempts`) are append-only. In production the
  application DB user is granted no `UPDATE`/`DELETE` on them:

  ```sql
  REVOKE UPDATE, DELETE ON iced_out.audit_logs FROM 'iced_out_app'@'%';
  -- repeat for each ledger table
  ```

## Regenerating after a schema change

```bash
# 1. add migrations/00NN_your_change.sql
php bin/console.php migrate
php bin/console.php db:export      # rewrites the three .sql files here
```

Migrations are checksummed: editing one that has already been applied is
reported rather than silently re-run. Always add a new file instead.
