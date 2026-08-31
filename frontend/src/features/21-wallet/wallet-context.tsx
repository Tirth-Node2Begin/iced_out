"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";

import { customerClient } from "@/api/clients";
import { createIdempotencyKey } from "@/api/request-context";
import { useAuth } from "@/features/20-auth-security/auth-context";
import { EMPTY_WALLET, normaliseCode, type Wallet } from "@/features/21-wallet/wallet";

/**
 * The account's wallet, read from the API and shared by everything that spends
 * or shows it.
 *
 * ONE COPY, and that is the whole reason this is a context rather than a fetch
 * in whichever page needs it. Three surfaces read the balance — the account
 * tab, the rail's count, the checkout summary — and a shopper who has just
 * spent ₹500 must not be able to find a screen still offering it.
 *
 * Nothing here does arithmetic on the balance. `refresh()` re-reads it, and
 * `redeem()` asks the server to move money and then re-reads; the balance is
 * only ever painted from a full response. That is deliberate: the number that
 * decides anything is the one the place-order transaction checks under a row
 * lock, and a browser keeping its own running total would eventually disagree
 * with it — always in the direction of offering credit that is already gone.
 *
 * NOT PERSISTED. The bag and the address book are cached in `localStorage`
 * because a stale bag is an inconvenience; a stale balance is a shopper being
 * told they can pay for something they cannot. This starts empty on every load
 * and fills from the API.
 *
 * It lives in a module-scoped store read through `useSyncExternalStore` rather
 * than in `useState`, for the same reason the other account stores do: the
 * loading is a synchronisation with something outside React, and writing it as
 * `setState` inside an effect is the cascading-render pattern React now warns
 * about.
 */

type WalletState = {
  wallet: Wallet;
  /** False until the first answer — success or failure — has landed. */
  ready: boolean;
  /** The last read failure, as a sentence written to be shown. */
  error: string | null;
};

/* One object, referentially stable, so `getSnapshot` can hand back the same
   reference until something actually changes. A snapshot that built a fresh
   object per call re-renders forever. */
const EMPTY_STATE: WalletState = { wallet: EMPTY_WALLET, ready: false, error: null };

/** The same thing once we KNOW there is nobody signed in — settled, not loading. */
const SIGNED_OUT: WalletState = { wallet: EMPTY_WALLET, ready: true, error: null };

let state: WalletState = EMPTY_STATE;
const listeners = new Set<() => void>();

function publish(next: WalletState) {
  state = next;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const getSnapshot = () => state;
/* The static export is built with nobody signed in, so the server snapshot is
   the empty wallet — and it has to be the SAME object every call. */
const getServerSnapshot = () => EMPTY_STATE;

/** Guards the answer to a request that a later one has already overtaken. */
let generation = 0;

async function read(signedIn: boolean) {
  const mine = ++generation;

  if (!signedIn) {
    // Sign-out clears it here rather than leaving the last account's balance in
    // a module that outlives the session.
    publish(SIGNED_OUT);
    return;
  }

  try {
    const response = await customerClient.get<{ data: Wallet }>("/me/wallet");
    if (generation !== mine) return;

    publish({ wallet: { ...EMPTY_WALLET, ...response.data.data }, ready: true, error: null });
  } catch (failure) {
    if (generation !== mine) return;

    /* An empty wallet on a failed read, never a stale one. Store credit is
       money: showing a balance the server did not just confirm is how someone
       is told they can pay for something they cannot. */
    publish({
      wallet: EMPTY_WALLET,
      ready: true,
      error:
        failure instanceof Error ? failure.message : "Your wallet could not be read just now.",
    });
  }
}

type WalletContextValue = WalletState & {
  /** Re-read it. Awaited by a screen that has just changed it. */
  refresh: () => Promise<void>;
  /**
   * Pour a voucher code into the balance.
   *
   * Resolves to a sentence on refusal and to null on success rather than
   * throwing: every caller is a form that has to print the reason beside the
   * field, and none of them can do anything useful with an exception.
   */
  redeem: (code: string) => Promise<string | null>;
};

const WalletContext = createContext<WalletContextValue | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, sessionReady } = useAuth();
  const current = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useEffect(() => {
    if (!sessionReady) return;
    void read(isAuthenticated);
  }, [isAuthenticated, sessionReady]);

  const refresh = useCallback(async () => {
    await read(isAuthenticated);
  }, [isAuthenticated]);

  const redeem = useCallback(async (input: string) => {
    const code = normaliseCode(input);
    if (!code) return "Enter a code.";

    try {
      /* The route is declared idempotent, so the header is REQUIRED — without
         it the API refuses with ICE-IDMP-422 before the controller is reached.
         It also does what it says on a retry: a request that times out and is
         sent again replays the first answer instead of trying to add the code
         a second time. */
      await customerClient.post(
        "/me/wallet/redeem",
        { code },
        { headers: { "Idempotency-Key": createIdempotencyKey(`wallet-redeem-${code}`) } },
      );
    } catch (failure) {
      return failure instanceof Error
        ? failure.message
        : `${code} could not be added to your wallet.`;
    }

    /* Re-read rather than adding the amount locally. The response carries the
       new balance, but a wallet only ever painted from a full read cannot drift
       from the server by one path being forgotten. */
    await read(true);

    return null;
  }, []);

  const value = useMemo<WalletContextValue>(
    () => ({ ...current, refresh, redeem }),
    [current, redeem, refresh],
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (!context) throw new Error("useWallet must be used inside WalletProvider");
  return context;
}
