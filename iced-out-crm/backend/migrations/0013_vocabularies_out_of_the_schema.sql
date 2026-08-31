-- A CHECK constraint is code. Whether it belongs on a column depends on what
-- the column holds:
--
--   STATE MACHINE alphabets stay. `orders.status`, `payments.status`,
--   `shipments.status`, `return_requests.state` and the movement types are
--   values the application branches on — a row outside the set is a bug, and
--   the database refusing it is the last line of defence.
--
--   VOCABULARIES go. Why a refund was issued, why a piece came back, what a
--   support query is about, which gateway took the money, whether a garment is
--   a Top or a Bottom — these are lists the store owns and changes. Pinning
--   them in DDL means an operator cannot add "Flood damage" to the refund
--   reasons without a migration, which is exactly the hard-coding this change
--   is removing. They now live in `store_settings` and are enforced by the
--   services that write them.
--
-- DROP CONSTRAINT is supported by MariaDB 10.2+ and MySQL 8.0.19+.

ALTER TABLE refunds DROP CONSTRAINT ck_refunds_reason;

ALTER TABLE return_requests DROP CONSTRAINT ck_return_requests_reason;

ALTER TABLE support_queries DROP CONSTRAINT ck_support_queries_topic;

ALTER TABLE payments DROP CONSTRAINT ck_payments_gateway;

ALTER TABLE stock_items DROP CONSTRAINT ck_stock_items_category;

ALTER TABLE shipments DROP CONSTRAINT ck_shipments_handling;
