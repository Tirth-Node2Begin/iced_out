-- Read models named in spec §6. Views only — no view is ever written through.

-- Per-size availability with the PDP badge already derived (LOW_STOCK_AT = 4).
CREATE VIEW v_variant_availability AS
SELECT
    p.public_id            AS product_slug,
    v.public_id            AS sku,
    v.id                   AS variant_id,
    v.size                 AS size,
    v.color                AS color,
    v.color_hex            AS color_hex,
    v.material             AS material,
    COALESCE(vi.available, 0) AS available,
    CASE
        WHEN COALESCE(vi.available, 0) <= 0 THEN 'SOLD_OUT'
        WHEN COALESCE(vi.available, 0) < COALESCE(vi.low_at, 4) THEN 'LOW_STOCK'
        ELSE 'IN_STOCK'
    END                    AS stock
FROM product_variants v
JOIN products p ON p.id = v.product_id
LEFT JOIN variant_inventory vi ON vi.variant_id = v.id
WHERE v.deleted_at IS NULL AND p.deleted_at IS NULL;

-- One ordered stream per order: status changes and shipment milestones together.
CREATE VIEW v_order_timeline AS
SELECT
    o.id            AS order_id,
    o.number        AS order_number,
    h.created_at    AS at,
    h.to_status     AS label,
    h.note          AS detail,
    h.actor_type    AS actor
FROM orders o
JOIN order_status_history h ON h.order_id = o.id
UNION ALL
SELECT
    o.id            AS order_id,
    o.number        AS order_number,
    e.created_at    AS at,
    e.label         AS label,
    e.detail        AS detail,
    'system'        AS actor
FROM orders o
JOIN shipments s ON s.order_id = o.id
JOIN shipment_events e ON e.shipment_id = s.id;

-- The six dashboard queue counts of endpoint #89, in one row.
CREATE VIEW v_dashboard_queues AS
SELECT
    (SELECT COUNT(*) FROM orders WHERE console_state = 'Placed')                       AS orders_to_confirm,
    (SELECT COUNT(*) FROM payments WHERE status = 'Failed')                            AS payment_exceptions,
    (SELECT COUNT(*) FROM orders o
       WHERE o.console_state = 'Confirmed'
         AND NOT EXISTS (SELECT 1 FROM shipments s
                          WHERE s.order_id = o.id
                            AND s.status NOT IN ('Failed','Cancelled')))               AS ready_to_dispatch,
    (SELECT COUNT(*) FROM return_requests WHERE state = 'New')                         AS returns_to_review,
    (SELECT COUNT(*) FROM v_variant_availability WHERE stock IN ('LOW_STOCK','SOLD_OUT')) AS stock_at_risk,
    (SELECT COUNT(*) FROM support_queries WHERE status = 'Open')                       AS open_tickets;
