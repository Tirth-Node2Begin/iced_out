-- An order records who to deliver to (contact_name/email/mobile are frozen on
-- the row); linking it to an ACCOUNT is a separate fact, and not every order in
-- the register has one — imported and register-only orders do not.
--
-- Making the link optional is what lets each customer's history be exactly the
-- orders that customer placed, instead of inflating a register row's count with
-- orders that merely needed an owner to satisfy a NOT NULL column.
--
-- The console addresses orders by number and displays contact_name, so nothing
-- on screen depends on the account link being present.

ALTER TABLE orders
    DROP FOREIGN KEY fk_orders_user;

ALTER TABLE orders
    MODIFY COLUMN user_id BIGINT UNSIGNED NULL;

ALTER TABLE orders
    ADD CONSTRAINT fk_orders_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL;
