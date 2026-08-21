"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
  type ReactNode,
} from "react";

import { customerClient, publicClient } from "@/api/clients";
import { useAuth } from "@/features/20-auth-security/auth-context";
import { asReview, type Review } from "@/features/11-reviews/reviews";
import { createRemoteStore } from "@/lib/remote-store";

/**
 * Reviews, from the shopper's side.
 *
 * This was a `localStorage` register seeded with four written-in reviews, and the
 * consequence was sharper than it looks: the moderation desk and the storefront
 * were the same browser. A review "approved" in the console was approved for
 * exactly one person on one machine, and a review a real shopper wrote never
 * reached the shop at all. Both halves are now the `reviews` table.
 *
 * Split by AUDIENCE, which is what the endpoints are:
 *
 *   `published` — `GET /reviews`, public. What the storefront may quote, and the
 *                 only thing it can see. Everything is here until the desk
 *                 hides it.
 *   `mine`      — `GET /me/reviews`, the signed-in shopper's own, in every state,
 *                 so their feedback tab can show a hidden one as taken down.
 *   `submit`    — `POST /me/reviews`. Lands `Published`; the server decides that,
 *                 not this code.
 *
 * The console's moderation desk deliberately does NOT read this context. It reads
 * `/admin/reviews` through `useRegister`, because it needs every review and the
 * verbs to act on them — see `admin-review-moderation`.
 */

/** The live reviews, shared by every storefront surface that quotes one. */
const publishedStore = createRemoteStore<Review>(async () => {
  const response = await publicClient.get<{ data: Record<string, string>[] }>("/reviews");
  return response.data.data.map(asReview);
});

/**
 * The signed-in shopper's own reviews.
 *
 * A store rather than component state filled by an effect: the load then belongs
 * to the store, which starts it on first read and joins concurrent readers, and
 * nothing has to setState inside an effect body — which this repo lints as an
 * error, and correctly, since it is a cascading render.
 *
 * `reset()` on sign-out is what stops two people on one machine seeing each
 * other's feedback — the exact failure the `localStorage` version had.
 */
const mineStore = createRemoteStore<Review>(async () => {
  const response = await customerClient.get<{ data: Record<string, string>[] }>("/me/reviews");
  return response.data.data.map(asReview);
});

type SubmitInput = {
  product: string;
  /** 1–5. Anything else is treated as a five. */
  rating: number;
  headline: string;
  body: string;
  /** "True to size" and the like. Optional. */
  fit?: string;
};

type ReviewsContextValue = {
  /** The only ones the storefront is allowed to show. */
  published: Review[];
  /** What the shopper wrote, for their own feedback tab — any state. */
  mine: Review[];
  /** False until the approved list has been read at least once. */
  ready: boolean;
  loading: boolean;
  error: string | null;
  /** A shopper's own feedback, which always lands waiting on a decision. */
  submit: (input: SubmitInput) => Promise<Review>;
  /** Re-reads both lists — for a screen that has just written one. */
  refresh: () => Promise<void>;
  /** Re-reads the shopper's own list alone — after the server refused a write. */
  refreshMine: () => Promise<void>;
};

const ReviewsContext = createContext<ReviewsContextValue | null>(null);

export function ReviewsProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, sessionReady, customer } = useAuth();

  /**
   * Whose feedback the held list is.
   *
   * `mineStore` is a module-level store, so it outlives every screen and every
   * sign-in on this tab — and until now nothing ever dropped it. `resetMyReviews`
   * was written for exactly this and then never called from anywhere.
   *
   * That is what left a shopper looking at a "Write a review" button for a piece
   * they had already reviewed. The store is read the moment `isAuthenticated`
   * turns true, and a read that lands a beat before the session cookie is live
   * comes back 401 — which `createRemoteStore` records as `loaded: true` with an
   * error, so it is never retried. `mine` stays empty for the life of the tab,
   * the page believes they have written nothing, and the server refuses the
   * submit with the 409 it should never have been allowed to reach.
   *
   * Keying it to the account fixes both halves: signing in drops a list that was
   * loaded (or failed) while signed out, and signing in as somebody else cannot
   * leave the previous person's feedback on screen.
   */
  const account = isAuthenticated && sessionReady ? (customer?.email ?? "signed-in") : null;
  const heldFor = useRef<string | null>(null);

  useEffect(() => {
    if (heldFor.current === account) return;
    heldFor.current = account;
    /* An effect is the right place for this: it is a write to an external store,
       not a setState — which is the distinction the repo's lint rule draws. The
       reset notifies subscribers, and the re-render that follows reads the
       snapshot again, which is what starts the fresh load. */
    mineStore.reset();
  }, [account]);

  const publishedState = useSyncExternalStore(
    publishedStore.subscribe,
    publishedStore.getSnapshot,
    publishedStore.getServerSnapshot,
  );

  const mineState = useSyncExternalStore(
    mineStore.subscribe,
    /* Only asked for once there IS a session. Reading the store's snapshot is what
       starts its request, so a signed-out visitor must not read it — the endpoint
       needs a cookie, and asking without one is a 401 on every page load. */
    isAuthenticated && sessionReady ? mineStore.getSnapshot : mineStore.getServerSnapshot,
    mineStore.getServerSnapshot,
  );

  const refresh = useCallback(async () => {
    await Promise.all([publishedStore.refresh(), mineStore.refresh()]);
  }, []);

  /**
   * Re-reads only the shopper's own list.
   *
   * For the case where the SERVER knows something this browser does not — a
   * refused submit saying they have already reviewed the piece. Whatever state
   * the held list is in, that answer is proof it is wrong, so it is thrown away
   * and asked again rather than argued with.
   */
  const refreshMine = useCallback(async () => {
    await mineStore.refresh();
  }, []);

  const submit = useCallback(
    async (input: SubmitInput) => {
      const rating = Math.round(input.rating);

      const response = await customerClient.post<{ data: Record<string, string> }>("/me/reviews", {
        product: input.product,
        rating: rating >= 1 && rating <= 5 ? rating : 5,
        headline: input.headline,
        body: input.body,
        ...(input.fit ? { fit: input.fit } : {}),
      });

      const review = asReview(response.data.data);

      /* Shown at once on the shopper's own tab, so the confirmation has something
         to point at. The public list is left to re-read from the server rather
         than being written to here — what the storefront quotes should come from
         the endpoint that decides it, not from the browser that just posted. */
      mineStore.put([review, ...mineStore.peek().data]);

      return review;
    },
    [],
  );

  const value = useMemo<ReviewsContextValue>(
    () => ({
      published: publishedState.data,
      mine: mineState.data,
      ready: publishedState.loaded,
      loading: publishedState.loading,
      error: publishedState.error,
      submit,
      refresh,
      refreshMine,
    }),
    [publishedState, mineState.data, refresh, refreshMine, submit],
  );

  return <ReviewsContext.Provider value={value}>{children}</ReviewsContext.Provider>;
}

export function useReviews() {
  const context = useContext(ReviewsContext);
  if (!context) throw new Error("useReviews must be used inside ReviewsProvider");
  return context;
}

/** Drops the held list — after the desk hides, edits or deletes one. */
export function resetPublishedReviews() {
  publishedStore.reset();
}

/** Drops the shopper's own list. Called on sign-out. */
export function resetMyReviews() {
  mineStore.reset();
}
