"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";

import type { Coupon } from "@/features/10-coupons/coupons";
import {
  VOUCHERS_KEY,
  defaultExpiryISO,
  redeemableCoupons,
  reviveVouchers,
  seededVouchers,
  todayISO,
  voucherBalance,
  voucherCodeFor,
  type Voucher,
} from "@/features/10-coupons/vouchers";
import { createLocalStore } from "@/lib/local-store";

/**
 * The vouchers this browser holds, from both directions.
 *
 * The console issues one when a return is settled; the account tab lists them;
 * the bag spends them. All three read this store, so the credit an operator
 * grants is the credit the shopper sees and the credit checkout takes off —
 * there is no second copy anywhere to drift from it.
 *
 * It sits ABOVE the cart in the provider tree because the bag has to resolve a
 * stored voucher code back into a live balance on the way in, and a child
 * cannot read a store mounted beneath it.
 *
 * The credit itself lives in `localStorage` behind `createLocalStore`, the same
 * helper the payment ledger and the address book use. It used to hydrate
 * through an effect, which meant the first render of every voucher surface
 * painted an empty list and then flipped — a shopper's own credit flashing
 * absent on the way in — and needed a `restored` flag and a mirror ref to stop
 * that empty first render being written back over the stored list. Reading the
 * store during render removes all three, and the correctness argument that used
 * to be spread across four effects is now one the store makes once.
 */

/**
 * A browser that has never held a voucher starts with the one the account's own
 * archive already shows as settled; without it, a new visitor's vouchers tab is
 * empty for a return their orders page calls closed weeks ago.
 *
 * A browser that HAS been here keeps exactly what it had — including an empty
 * list. Deleting every voucher from the register is a thing an operator can
 * mean, so it is honoured rather than reseeded on the next reload.
 */
const store = createLocalStore<Voucher[]>(VOUCHERS_KEY, seededVouchers, (parsed) =>
  Array.isArray(parsed) ? reviveVouchers(parsed) : null,
);

type IssueInput = {
  returnId: string;
  customer: string;
  /** Whole rupees. A voucher for nothing is not issued. */
  amount: number;
  reason: string;
};

type VouchersContextValue = {
  vouchers: Voucher[];
  /** Everything with a balance left, in the shape the bag redeems. */
  redeemable: Coupon[];
  /** What all of them are worth together, in rupees. */
  balance: number;
  /**
   * Issue the credit for one settled return.
   *
   * Idempotent per return: a return that already has a voucher gets the one it
   * already has rather than a second one. The row action that calls this can be
   * undone and redone, and undo/redo must not mint money.
   */
  issue: (input: IssueInput) => Voucher | null;
  /**
   * Mark a voucher redeemed, once an order has actually been placed with it.
   *
   * This is the only thing that claims one — copying the code does not, and
   * neither does putting it on the bag. From here it leaves the redeemable
   * table, so it cannot be applied again from any surface or any tab.
   */
  claim: (code: string, order: string) => void;
  /** The voucher behind a code, if this browser holds one. */
  find: (code: string) => Voucher | undefined;
  /**
   * Write the whole ledger, for the register that edits rows directly.
   *
   * An updater rather than a list, because an undo can fire long after the
   * render that offered it and still has to build on what is current.
   */
  commit: (next: (current: Voucher[]) => Voucher[]) => void;
};

const VouchersContext = createContext<VouchersContextValue | null>(null);

export function VouchersProvider({ children }: { children: ReactNode }) {
  /* The store IS the state. The console and the storefront are two routes in
     one app, and an operator settling a return in one tab should not have to
     reload the other to see the credit land — the store listens for `storage`
     itself, so that comes free rather than as a fourth effect here. */
  const vouchers = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getServerSnapshot,
  );

  /* Every writer reads the store rather than a closure or a mirror ref, so each
     one stays identity-stable AND always sees what is current — including a
     second write in the same tick, which a captured list would miss. */
  const commit = useCallback((next: (current: Voucher[]) => Voucher[]) => {
    store.write(next(store.getSnapshot()));
  }, []);

  const issue = useCallback(
    (input: IssueInput) => {
      const amount = Math.round(input.amount);
      if (amount <= 0) return null;

      const current = store.getSnapshot();

      /* Idempotent per return: settling twice hands back the voucher that
         already exists rather than minting a second one against the same
         credit. */
      const existing = current.find((voucher) => voucher.returnId === input.returnId);
      if (existing) return existing;

      const voucher: Voucher = {
        code: voucherCodeFor(input.returnId, current),
        amount,
        returnId: input.returnId,
        reason: input.reason,
        customer: input.customer,
        issuedOn: todayISO(),
        expiresOn: defaultExpiryISO(),
        claimedOn: "",
        claimedOrder: "",
      };

      commit((rows) => [voucher, ...rows]);
      return voucher;
    },
    [commit],
  );

  const claim = useCallback(
    (code: string, order: string) => {
      const day = todayISO();

      commit((current) =>
        current.map((voucher) =>
          /* Already claimed stays claimed with its original order on it — the
             first order that spent it is the true one. */
          voucher.code === code && voucher.claimedOn === ""
            ? { ...voucher, claimedOn: day, claimedOrder: order }
            : voucher,
        ),
      );
    },
    [commit],
  );

  const value = useMemo<VouchersContextValue>(
    () => ({
      vouchers,
      redeemable: redeemableCoupons(vouchers),
      balance: voucherBalance(vouchers),
      issue,
      claim,
      commit,
      find: (code) => vouchers.find((voucher) => voucher.code === code.trim().toUpperCase()),
    }),
    [claim, commit, issue, vouchers],
  );

  return <VouchersContext.Provider value={value}>{children}</VouchersContext.Provider>;
}

export function useVouchers() {
  const context = useContext(VouchersContext);
  if (!context) throw new Error("useVouchers must be used inside VouchersProvider");
  return context;
}
