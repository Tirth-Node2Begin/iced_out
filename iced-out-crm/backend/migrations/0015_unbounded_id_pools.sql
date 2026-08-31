-- Id pools lose their ceilings.
--
-- `store_settings.id_pools` capped four sequences at thirty: thirty orders,
-- thirty tracking tokens, thirty payments, thirty customers. The thirty-first of
-- anything threw "id pool exhausted — rebuild the frontend with more slots", and
-- the message named the real reason: the frontend was a static export that
-- pre-rendered one page per id, so every id a shopper could ever be given had to
-- exist at build time and there had to be few of them. The prefixes said it too —
-- `ord-local-01` was not a placeholder, it was the first order's actual id.
--
-- The frontend is client-rendered now and reads a record's id from the query, so
-- nothing has to be enumerated in advance. Dropping `to` turns each pool into a
-- gap-filling sequence with no ceiling (see `IdAllocator::allocate`, where a `to`
-- of 0 means unbounded).
--
-- This is a migration rather than a seed change because the seed only fills in
-- keys that are MISSING — by design, so it never overwrites something an
-- operator has tuned. `id_pools` on an existing install already exists, holding
-- the caps, so only a migration can correct it.
--
-- Written as a targeted UPDATE rather than a blanket overwrite: an operator who
-- has changed a prefix or a starting serial keeps that. Only the ceiling goes,
-- and only from the four pools that had one.
--
-- The `local` prefixes are corrected at the same time, for orders and tracking
-- only. Ids already issued are untouched — an order addressed as
-- `ord-local-07` stays `ord-local-07`, because it is a URL somebody may hold and
-- a reference support may be asked about. New ones take the new prefix, and
-- `allocate` gap-fills per prefix so the two never collide.

UPDATE store_settings
   SET value_json = JSON_SET(
         JSON_REMOVE(
           value_json,
           '$.order.to',
           '$.tracking.to',
           '$.payment.to',
           '$.customer.to'
         ),
         '$.order.prefix', 'ord-',
         '$.order.width', 4,
         '$.order.from', 1001,
         '$.tracking.prefix', 'trk-',
         '$.tracking.width', 6,
         '$.tracking.from', 100001
       ),
       version = version + 1
 WHERE `key` = 'id_pools';
