"use client";

import {
  ArrowDownLeft,
  ArrowUpRight,
  Loader2,
  RefreshCw,
  RotateCcw,
  ShoppingBag,
  Sparkles,
  Ticket,
  Wallet,
} from "lucide-react";
import { useState, type CSSProperties, type FormEvent } from "react";

import "@/styles/wallet.css";

import { AccountSection } from "@/components/account/account-section";
import { formatPrice } from "@/features/02-products/utils/format-price";
import {
  byMonth,
  formatStamp,
  type PendingVoucher,
  type WalletKind,
} from "@/features/21-wallet/wallet";
import { useWallet } from "@/features/21-wallet/wallet-context";

/**
 * The wallet tab.
 *
 * Three things, in the order somebody opens this screen wanting them: what is
 * in it, how to put more in, and where it all went.
 *
 * The statement is the part that earns the page. Store credit used to be a list
 * of voucher codes with a status beside each — which answered "do I have a
 * voucher" and could not answer "what happened to my ₹4,600", because under the
 * old one-shot vouchers the honest answer was often "most of it was destroyed
 * by a ₹1,200 order". A ledger answers both, and the balance-after column is
 * what makes it readable as a history rather than as a pile of amounts.
 *
 * Nothing here spends anything. Credit leaves a wallet in exactly one place —
 * inside the place-order transaction, where it is weighed against an order
 * being created in the same breath — so this screen has no Spend button and
 * checkout needs no code pasted into it.
 */

/** A glyph per reason money moved. Backed by the sign and the colour beside it. */
const GLYPHS: Record<WalletKind, typeof Wallet> = {
  return: ArrowDownLeft,
  exchange: RotateCcw,
  voucher: Ticket,
  order: ShoppingBag,
  reversal: RotateCcw,
  adjustment: Sparkles,
};

/**
 * How many rows play their entrance.
 *
 * Past this the stagger stops rather than stretching: a fortieth row arriving
 * one and a half seconds after the first is not an entrance, it is a wait.
 */
const STAGGER_LIMIT = 12;

export function AccountWallet() {
  const { wallet, ready, error, refresh, redeem } = useWallet();

  const [code, setCode] = useState("");
  const [adding, setAdding] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  /** The code currently being poured in from the pending list, if any. */
  const [pouring, setPouring] = useState<string | null>(null);

  const months = byMonth(wallet.entries);

  async function add(value: string) {
    setProblem(null);
    const failure = await redeem(value);

    if (failure) {
      setProblem(failure);
      return false;
    }

    setCode("");
    return true;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (adding) return;

    setAdding(true);
    await add(code);
    setAdding(false);
  }

  async function pour(voucher: PendingVoucher) {
    if (pouring) return;

    setPouring(voucher.code);
    await add(voucher.code);
    setPouring(null);
  }

  return (
    <AccountSection
      actions={
        <button
          className="io-btn io-btn--ghost io-btn--sm"
          disabled={!ready}
          onClick={() => void refresh()}
          type="button"
        >
          <RefreshCw aria-hidden size={14} strokeWidth={1.7} />
          Refresh
        </button>
      }
      copy="Money the shop owes you — from returns, from exchanges into something cheaper, and from any voucher you add. It comes off your next order automatically, to the rupee, and whatever is left stays here."
      eyebrow="Account / Wallet"
      title="Your wallet."
    >
      {/* ------------------------------------------------------- the balance */}
      <section className="io-panel wa-hero">
        <div>
          <p className="wa-hero__label">
            <Wallet aria-hidden size={13} strokeWidth={1.7} />
            Balance
          </p>

          {/* `aria-live`: this figure changes under the reader when a voucher
              is added, and the change IS the confirmation — there is no toast
              saying so, because the number moving says it better. */}
          <p aria-live="polite" className="wa-hero__amount">
            {formatPrice(wallet.balance)}
            <em>{wallet.currency}</em>
          </p>

          <p className="wa-hero__copy">
            {wallet.balance > 0
              ? "This comes off your next order before anything reaches your card. If the order costs more, you pay only the difference."
              : "Nothing in it yet. Credit lands here when a return is settled, or when you add a voucher below."}
          </p>
        </div>

        <dl className="wa-hero__totals">
          <div className="wa-total wa-total--in">
            <dt>Credited</dt>
            <dd>{formatPrice(wallet.totals.earned)}</dd>
          </div>
          <div className="wa-total">
            <dt>Spent</dt>
            <dd>{formatPrice(wallet.totals.spent)}</dd>
          </div>
        </dl>
      </section>

      {/* A read that failed is said out loud rather than shown as ₹0. A balance
          the server did not just confirm is exactly the thing not to guess at. */}
      {error && (
        <div className="io-note io-note--warn">
          <Wallet aria-hidden size={16} strokeWidth={1.7} />
          <p>
            <strong>Your wallet could not be read</strong>
            {error} Nothing has been lost — press Refresh to try again.
          </p>
        </div>
      )}

      {/* ---------------------------------------------------------- adding */}
      <section className="io-panel">
        <header className="io-panel__head">
          <div>
            <h3 className="io-panel__title">
              <Ticket aria-hidden size={16} strokeWidth={1.6} />
              Add a voucher
            </h3>
            <p className="io-panel__note">
              A voucher goes into the balance, not onto one order — so its full
              value survives however small the order you spend it on.
            </p>
          </div>
        </header>

        <form className="wa-add" noValidate onSubmit={submit}>
          <label className="io-field" htmlFor="wallet-code">
            <span>
              Voucher code <em>e.g. IOV072</em>
            </span>
            <input
              autoComplete="off"
              id="wallet-code"
              name="code"
              onChange={(event) => {
                setCode(event.target.value);
                if (problem) setProblem(null);
              }}
              placeholder="IOV000"
              spellCheck={false}
              value={code}
            />
          </label>

          <button
            className="io-btn io-btn--solid"
            disabled={adding || code.trim() === ""}
            type="submit"
          >
            {adding ? (
              <Loader2 aria-hidden className="wa-spin" size={15} strokeWidth={1.8} />
            ) : (
              <ArrowDownLeft aria-hidden size={15} strokeWidth={1.8} />
            )}
            {adding ? "Adding" : "Add to wallet"}
          </button>

          {problem && (
            <p className="wa-add__error" role="alert">
              {problem}
            </p>
          )}
        </form>

        {/* Vouchers the account already holds. Offering them as a press rather
            than as a code to copy: the shop knows these exist, and making
            somebody transcribe one is a form for our benefit. */}
        {wallet.pending.length > 0 && (
          <div className="wa-pending">
            {wallet.pending.map((voucher) => (
              <div className="wa-pending__row" key={voucher.code}>
                <span className="wa-pending__code">{voucher.code}</span>
                <span className="wa-pending__what">
                  {voucher.reason || "Store credit"}
                </span>
                <span className="wa-pending__amount">{formatPrice(voucher.amount)}</span>
                <button
                  className="io-btn io-btn--ghost io-btn--sm"
                  disabled={pouring !== null}
                  onClick={() => void pour(voucher)}
                  type="button"
                >
                  {pouring === voucher.code ? (
                    <Loader2 aria-hidden className="wa-spin" size={14} strokeWidth={1.8} />
                  ) : null}
                  {pouring === voucher.code ? "Adding" : "Add"}
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ------------------------------------------------------- statement */}
      <section className="io-panel io-panel--flush">
        <header className="io-panel__head wa-statement__head">
          <div>
            <h3 className="io-panel__title">
              <ArrowUpRight aria-hidden size={16} strokeWidth={1.6} />
              Statement
            </h3>
            <p className="io-panel__note">
              Every movement, newest first, with what the balance stood at after it.
            </p>
          </div>
        </header>

        {!ready ? (
          <div className="io-empty">
            <strong>Reading your wallet</strong>
            One moment.
          </div>
        ) : wallet.entries.length === 0 ? (
          <div className="io-empty">
            <strong>Nothing has moved yet</strong>
            When a return is settled, or you add a voucher, it shows up here with the date
            and what the balance became.
          </div>
        ) : (
          months.map((month) => (
            <div key={month.key}>
              <p className="wa-month">{month.label}</p>

              {month.entries.map((entry, index) => {
                const Glyph = GLYPHS[entry.kind] ?? Wallet;

                return (
                  <div
                    className="wa-entry"
                    data-direction={entry.direction}
                    key={entry.id}
                    style={{ "--i": Math.min(index, STAGGER_LIMIT) } as CSSProperties}
                  >
                    <span aria-hidden className="wa-entry__glyph">
                      <Glyph size={15} strokeWidth={1.7} />
                    </span>

                    <span>
                      <span className="wa-entry__title">{entry.title}</span>
                      <span className="wa-entry__note">
                        {entry.note} · {formatStamp(entry.at)}
                      </span>
                    </span>

                    <span className="wa-entry__money">
                      <span className="wa-entry__amount">
                        {/* The sign comes from the server so the two never
                            disagree about which way the money went. */}
                        {entry.sign}
                        {formatPrice(entry.amount)}
                      </span>
                      <span className="wa-entry__after">
                        {formatPrice(entry.balanceAfter)} left
                      </span>
                    </span>
                  </div>
                );
              })}
            </div>
          ))
        )}
      </section>

      <div className="io-note">
        <Wallet aria-hidden size={16} strokeWidth={1.7} />
        <p>
          <strong>How it is spent</strong>
          Your balance comes off automatically at checkout — you will see it on the summary
          before you pay. It is spent to the rupee, so a small order leaves the rest here,
          and it works alongside a discount code rather than instead of one. Credit is spent
          in the shop; it is not paid back to a card.
        </p>
      </div>
    </AccountSection>
  );
}
