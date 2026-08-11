"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";

import { createLocalStore } from "@/lib/local-store";

type WishlistContextValue = {
  productIds: string[];
  isSaved: (productId: string) => boolean;
  toggle: (productId: string) => void;
  /** Puts a removed piece back where it was, for undo. */
  restore: (productId: string, index: number) => void;
};

const WishlistContext = createContext<WishlistContextValue | null>(null);
const STORAGE_KEY = "iced-out-wishlist-v1";

const EMPTY: { productIds: string[] } = { productIds: [] };

/**
 * Where saved pieces live between visits.
 *
 * Read through `useSyncExternalStore`, not an effect. The list used to hydrate
 * inside a `requestAnimationFrame`, which a hidden tab never runs — open the
 * shop in a background tab, or restore a window onto the saved list, and the
 * page rendered "nothing saved yet" over a full wishlist. The account's Saved
 * tab made that obvious: an empty table with three pieces in storage.
 *
 * The key already holds a bare array on every device that has used the shop, so
 * that shape is still accepted on the way in and rewritten on the first change.
 */
const store = createLocalStore(STORAGE_KEY, EMPTY, (parsed) => {
  if (Array.isArray(parsed)) return { productIds: parsed as string[] };
  if (parsed && typeof parsed === "object" && Array.isArray((parsed as typeof EMPTY).productIds)) {
    return { productIds: (parsed as typeof EMPTY).productIds };
  }
  return null;
});

export function WishlistProvider({ children }: { children: ReactNode }) {
  const { productIds } = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getServerSnapshot,
  );

  /* Answered from the subscribed list rather than by reading storage again.
     The build is a static export, so every heart is prerendered unsaved: a
     direct read reports "saved" during the hydration render, which is one pass
     earlier than `useSyncExternalStore` is allowed to say so, and React counts
     the difference against the server HTML as a mismatch. */
  const isSaved = useCallback(
    (productId: string) => productIds.includes(productId),
    [productIds],
  );

  const toggle = useCallback((productId: string) => {
    const current = store.getSnapshot().productIds;
    store.write({
      productIds: current.includes(productId)
        ? current.filter((id) => id !== productId)
        : [...current, productId],
    });
  }, []);

  /* Undo has to put the piece back where it was, not on the end: the list is
     read as a history of what was saved when, and a restore that re-sorts it
     quietly destroys the thing the order was carrying. */
  const restore = useCallback((productId: string, index: number) => {
    const current = store.getSnapshot().productIds;
    if (current.includes(productId)) return;

    const next = [...current];
    next.splice(Math.min(Math.max(index, 0), next.length), 0, productId);
    store.write({ productIds: next });
  }, []);

  const value = useMemo(
    () => ({ productIds, isSaved, toggle, restore }),
    [isSaved, productIds, restore, toggle],
  );

  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
}

export function useWishlist() {
  const context = useContext(WishlistContext);
  if (!context) throw new Error("useWishlist must be used inside WishlistProvider");
  return context;
}
