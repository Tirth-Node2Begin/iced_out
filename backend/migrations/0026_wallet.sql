-- The customer wallet — store credit as a BALANCE and a LEDGER, not a coupon.
--
-- What this replaces, and why it had to be replaced:
--
-- Store credit was a `vouchers` row spent through the coupon slot, and that
-- shape lost money three ways.
--
--   1. A voucher was ONE-SHOT. `PlaceOrderService::discountFor()` clamped it to
--      the subtotal and `claimVoucher()` then marked the whole thing claimed —
--      so ₹4,600 of credit spent on a ₹1,200 order destroyed ₹3,400 of a
--      customer's money, silently, with no record that it had happened.
--   2. Credit COMPETED WITH PROMOTIONS. It rode in `coupon_code`, and
--      `coupon_redemptions` is UNIQUE on `order_id` — so a shopper could use a
--      discount code or their own money, never both.
--   3. An exchange into something CHEAPER computed a credit
--      (`ReturnPresenter::balance()` → direction `credit`), told the customer
--      about it in as many words, and then never paid it out, because there was
--      nowhere for a part-payment to go.
--
-- A ledger fixes all three at once, because the thing being modelled is finally
-- the right thing: credit is MONEY THE SHOP OWES, which is a running balance
-- that goes up and down — not a token that is either whole or gone.
--
-- Two tables rather than one balance column, and the split is the point:
--
--   wallet_accounts   the balance, and the row that gets LOCKED. One per
--                     customer. Two checkouts racing to spend the last ₹500
--                     serialise on this row, which is what makes an overdraw
--                     impossible rather than unlikely.
--   wallet_entries    why the balance is what it is. Append-only: nothing in
--                     this table is ever updated or deleted, so "where did my
--                     credit go" always has an answer.
--
-- The balance is therefore stored AND derivable. That is deliberate duplication
-- — `SUM(entries)` is the truth and `accounts.balance` is the lock and the fast
-- read — and `bin/console.php wallet:check` compares them.

CREATE TABLE wallet_accounts (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id BIGINT UNSIGNED NOT NULL,
    balance DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    currency CHAR(3) NOT NULL DEFAULT 'INR',
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    -- One wallet per customer, enforced here rather than by a read-then-write:
    -- two requests arriving together for a customer who has never had credit
    -- would otherwise both find nothing and both insert.
    UNIQUE KEY uq_wallet_accounts_user (user_id),
    -- A wallet cannot go overdrawn. This is the backstop under the balance
    -- check in WalletService: the service refuses first with a sentence a
    -- shopper can read, and this refuses second in case anything ever gets
    -- past it.
    CONSTRAINT ck_wallet_accounts_balance CHECK (balance >= 0),
    CONSTRAINT fk_wallet_accounts_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE={{collation}};

-- Append-only. Every row is one movement of money and carries the balance it
-- left behind, so a statement never has to be re-derived by replaying the whole
-- history — and so a disagreement between a row and the running total is
-- visible rather than silently corrected.
CREATE TABLE wallet_entries (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    account_id BIGINT UNSIGNED NOT NULL,
    direction VARCHAR(8) NOT NULL,
    -- Always POSITIVE. `direction` carries the sign, so no query has to
    -- remember which way a negative number was meant to point.
    amount DECIMAL(12,2) NOT NULL,
    balance_after DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    -- What moved the money: return, exchange, voucher, order, reversal,
    -- adjustment. Checked below rather than left free-text, because these
    -- strings are what the statement groups and labels by.
    kind VARCHAR(24) NOT NULL,
    -- The thing on the other side of the movement: ret-072, IO-2026-1049,
    -- IOV072. Empty only on a hand-made adjustment.
    reference VARCHAR(64) NOT NULL DEFAULT '',
    note VARCHAR(190) NOT NULL DEFAULT '',
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    -- IDEMPOTENCY, and it is the whole reason this feature is safe to retry.
    --
    -- Settling a return twice, replaying a webhook, double-tapping checkout on
    -- a slow connection: each of those arrives as the same (kind, reference)
    -- pair, and the second one hits this index instead of minting money. NULL
    -- for a blank reference because NULLs are distinct in a UNIQUE index —
    -- which is exactly right, since hand-made adjustments have nothing to be
    -- idempotent against and an operator may legitimately make two.
    idem_key VARCHAR(96) GENERATED ALWAYS AS (
        IF(reference = '', NULL, CONCAT(kind, ':', reference))
    ) STORED,
    PRIMARY KEY (id),
    UNIQUE KEY uq_wallet_entries_idem (idem_key),
    KEY ix_wallet_entries_account (account_id, id),
    CONSTRAINT ck_wallet_entries_direction CHECK (direction IN ('credit','debit')),
    CONSTRAINT ck_wallet_entries_amount CHECK (amount > 0),
    CONSTRAINT ck_wallet_entries_kind CHECK (kind IN ('return','exchange','voucher','order','reversal','adjustment')),
    CONSTRAINT fk_wallet_entries_account FOREIGN KEY (account_id) REFERENCES wallet_accounts (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE={{collation}};

-- What the wallet paid towards this order.
--
-- A column of its own rather than more `discount`, because it is NOT a
-- discount: the shop did not sell the piece for less, it was paid partly with
-- money it already owed. Conflating them would overstate every discount figure
-- the console reports, and understate revenue by the same amount.
--
-- `total` stays what the order is worth. `wallet_applied` comes off it to give
-- what the gateway was asked for, and the `payments` rows record both halves.
ALTER TABLE orders
    ADD COLUMN wallet_applied DECIMAL(12,2) NOT NULL DEFAULT 0.00 AFTER discount;

-- Which wallet entry a voucher was redeemed into.
--
-- A voucher is no longer spent at checkout — it is POURED INTO the wallet and
-- spent from there, so that its value survives an order smaller than itself.
-- The existing `claimed_on` still marks it spent (nothing that reads it has to
-- change); this says where it went, so "IOV072 is claimed" and "₹4,600 arrived
-- in the wallet on 12 Aug" are provably the same event rather than two records
-- that happen to agree.
ALTER TABLE vouchers
    ADD COLUMN wallet_entry_id BIGINT UNSIGNED NULL AFTER claimed_order,
    ADD CONSTRAINT fk_vouchers_wallet_entry FOREIGN KEY (wallet_entry_id)
        REFERENCES wallet_entries (id) ON DELETE SET NULL;
