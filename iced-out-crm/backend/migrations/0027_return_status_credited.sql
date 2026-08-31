-- "Credited to wallet" — the word a settled return now uses to the customer.
--
-- `customer_status` is a CHECK-constrained vocabulary (0007), and the three
-- values it allowed were written when a settled return produced a VOUCHER:
-- 'Pickup scheduled', 'Voucher issued', 'Exchange on its way'. It does not any
-- more — it credits the wallet — and "Voucher issued" now describes a document
-- rather than where the money went.
--
-- The old value is KEPT rather than migrated. Two reasons, and the second is
-- the one that matters:
--
--   · every return settled before the wallet existed genuinely did issue a
--     voucher and nothing else, so rewriting those rows would be backdating a
--     feature onto history that did not have it;
--   · `return-detail.tsx` treats both 'Voucher issued' and 'Exchange on its
--     way' as the settled states, so an existing row keeps rendering exactly as
--     it does today with no frontend change required to read it.
--
-- Only new settlements use the new word.

ALTER TABLE return_requests
    DROP CONSTRAINT ck_return_requests_customer_status;

ALTER TABLE return_requests
    ADD CONSTRAINT ck_return_requests_customer_status
        CHECK (customer_status IN (
            'Pickup scheduled',
            'Voucher issued',
            'Credited to wallet',
            'Exchange on its way'
        ));
