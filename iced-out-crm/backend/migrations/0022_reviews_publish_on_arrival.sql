-- Reviews publish on arrival; the desk takes them down rather than letting them up.
--
-- The old states were `Pending`, `Approved` and `Rejected`, and a review landed
-- `Pending` — invisible to everybody including the person who wrote it, until a
-- moderator approved it. That is a queue between a customer and the thing they
-- were asked to do, and it is the wrong default for a shop this size: the
-- ordinary case is a real review from a real buyer, and holding all of them back
-- to catch the rare bad one means the common case is punished for the exception.
--
-- Two states now:
--
--   Published  live on the product page. Where a review starts.
--   Hidden     taken down by the desk. Reversible, and recorded in
--              `review_moderation_history` exactly as approving used to be.
--
-- Hiding is the answer to a review that breaks policy, and deleting is the
-- answer to one that should never have existed. Both are the desk's, and neither
-- is a precondition for a shopper being heard.
--
-- Data moves as follows:
--
--   Approved -> Published   it already was live; nothing changes for a shopper.
--   Pending  -> Published   nobody had decided against these, and under the new
--                           rule they would have gone straight up. Publishing
--                           them is the migration honouring the new default
--                           rather than quietly holding a backlog forever under
--                           a state that no longer exists.
--   Rejected -> Hidden      already invisible, and stays invisible. The one
--                           mapping that had to be exact.

ALTER TABLE reviews DROP CONSTRAINT ck_reviews_status;

UPDATE reviews SET status = 'Hidden' WHERE status = 'Rejected';
UPDATE reviews SET status = 'Published' WHERE status IN ('Approved', 'Pending');

ALTER TABLE reviews
    ALTER COLUMN status SET DEFAULT 'Published';

ALTER TABLE reviews
    ADD CONSTRAINT ck_reviews_status CHECK (status IN ('Published', 'Hidden'));
