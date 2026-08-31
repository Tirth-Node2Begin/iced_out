"use client";

/**
 * A server-owned list, shaped for `useSyncExternalStore`.
 *
 * The counterpart to `local-store`, and the distinction matters: a local store
 * holds facts about a BROWSER (which bag is open, which theme), a remote store
 * holds facts about the BUSINESS (what is for sale, what has been ordered). The
 * second kind cannot be seeded, cannot be written to optimistically without
 * being reconciled, and must be the same for every person looking at it.
 *
 * The same four constraints as `local-store` apply, for the same reasons:
 *
 * - The snapshot must be **referentially stable**. A `getSnapshot` that built a
 *   new object per call would re-render forever; one object is held and only
 *   replaced when the data actually changes.
 * - Loading must not depend on a component **mounting twice** or on an effect
 *   firing in a particular order. The first read starts the fetch, and every
 *   read during that flight joins it rather than starting another — so ten cards
 *   rendering at once make one request.
 * - The server snapshot has to be the same object every call and has to match
 *   what the static export was built with — an empty list, because the export
 *   was built with nobody signed in and no database reachable.
 * - A failed fetch is a **state**, not an exception. The screens above this read
 *   `error` and say so; nothing throws during a render.
 */

export type RemoteState<T> = {
  /** What the server last said. The empty list until the first load lands. */
  data: T[];
  /** True from the first read until the first response, success or failure. */
  loading: boolean;
  /** The last failure, as a sentence written to be shown. Null once it works. */
  error: string | null;
  /** False until a response has been seen at all — distinguishes "empty" from "unknown". */
  loaded: boolean;
};

export type RemoteStore<T> = {
  subscribe: (listener: () => void) => () => void;
  /** Starts the first load as a side effect of being read. See the note above. */
  getSnapshot: () => RemoteState<T>;
  getServerSnapshot: () => RemoteState<T>;
  /**
   * What is held right now, WITHOUT starting a load. For a synchronous caller
   * that can tolerate a miss — `getSnapshot` is the one that guarantees a fetch.
   */
  peek: () => RemoteState<T>;
  /** Re-reads the endpoint. Awaited by callers that need the new rows. */
  refresh: () => Promise<T[]>;
  /**
   * The rows, fetched if they are not held yet. For a caller that is not a
   * component — the bag resolving stored product ids on restore.
   */
  load: () => Promise<T[]>;
  /**
   * Replaces the held rows without a round trip, for the moment after a write
   * whose response already contains the new state of the register. Always
   * followed by a `refresh` in practice; this is what stops the table flickering
   * back to the old value in between.
   */
  put: (next: T[]) => void;
  /** Drops everything held, so the next read starts over. Used on sign-out. */
  reset: () => void;
};

const EMPTY: RemoteState<never> = { data: [], loading: false, error: null, loaded: false };

/* ------------------------------------------------------------- one record */

/**
 * The same thing for ONE object rather than a list — a detail endpoint's payload.
 *
 * Kept as its own type because a detail response is not a list of flat maps: an
 * order's endpoint answers with its row, its lines and its timeline together, and
 * a screen wants all three.
 */
export type RecordState<T> = {
  data: T | null;
  loading: boolean;
  error: string | null;
  loaded: boolean;
};

export type RemoteRecord<T> = {
  subscribe: (listener: () => void) => () => void;
  getSnapshot: () => RecordState<T>;
  getServerSnapshot: () => RecordState<T>;
  /** Re-reads it. Awaited by a screen that has just written to it. */
  reload: () => Promise<T | null>;
  /**
   * Drops what is held, so the next read starts over.
   *
   * Used on sign-out. A record fetched for one account must not still be on
   * screen for the next person to sign in on the same machine.
   */
  reset: () => void;
};

const NO_RECORD: RecordState<never> = { data: null, loading: false, error: null, loaded: false };

/**
 * @param fetcher what to call. Rejections become `error` rather than throwing.
 */
export function createRemoteRecord<T>(fetcher: () => Promise<T>): RemoteRecord<T> {
  let state: RecordState<T> = NO_RECORD as RecordState<T>;
  let inFlight: Promise<T | null> | null = null;

  const listeners = new Set<() => void>();

  function set(next: Partial<RecordState<T>>) {
    state = { ...state, ...next };
    listeners.forEach((listener) => listener());
  }

  function run(): Promise<T | null> {
    if (inFlight) return inFlight;

    if (!state.loading) set({ loading: true });

    inFlight = fetcher()
      .then((data) => {
        set({ data, loading: false, error: null, loaded: true });
        return data as T | null;
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : "That could not be read.";
        set({ data: null, loading: false, error: message, loaded: true });
        return null;
      })
      .finally(() => {
        inFlight = null;
      });

    return inFlight;
  }

  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    getSnapshot() {
      /* Reading starts the load — deferred to a microtask so the fetch is not
         begun during the render pass that read it. Same arrangement as the list
         store above, and the reason this is a store at all rather than an effect:
         this repo lints a synchronous `setState` inside an effect body as an
         error, and rightly — it is a cascading render. */
      if (!state.loaded && !state.loading && inFlight === null) {
        set({ loading: true });
        void Promise.resolve().then(run);
      }

      return state;
    },

    getServerSnapshot() {
      return NO_RECORD as RecordState<T>;
    },

    reload() {
      /* `data` is deliberately kept, so a screen does not blank between a verb
         and its answer. */
      inFlight = null;
      return run();
    },

    reset() {
      inFlight = null;
      state = NO_RECORD as RecordState<T>;
      listeners.forEach((listener) => listener());
    },
  };
}

/**
 * A cache of per-key record stores, so `useSyncExternalStore` is handed the SAME
 * store for the same key on every render.
 *
 * Bounded, and that is not an optimisation: a console session that opens two
 * hundred orders would otherwise hold two hundred payloads for the rest of the
 * session. The oldest key is dropped once the cap is passed — a screen that comes
 * back to it simply reads it again.
 */
export function createRecordCache<T>(
  fetcher: (key: string) => Promise<T>,
  limit = 24,
): (key: string) => RemoteRecord<T> {
  const held = new Map<string, RemoteRecord<T>>();

  return (key: string) => {
    const found = held.get(key);

    if (found) {
      /* Re-inserted so it counts as recently used. */
      held.delete(key);
      held.set(key, found);
      return found;
    }

    const record = createRemoteRecord<T>(() => fetcher(key));
    held.set(key, record);

    while (held.size > limit) {
      const oldest = held.keys().next();
      if (oldest.done) break;
      held.delete(oldest.value);
    }

    return record;
  };
}

/**
 * @param fetcher what to call. Rejections are caught and turned into `error`.
 */
export function createRemoteStore<T>(fetcher: () => Promise<T[]>): RemoteStore<T> {
  /* The one object `getSnapshot` returns. Replaced wholesale on every change so
     React sees a new reference exactly when something is actually different. */
  let state: RemoteState<T> = EMPTY as RemoteState<T>;
  let inFlight: Promise<T[]> | null = null;

  const listeners = new Set<() => void>();

  function set(next: Partial<RemoteState<T>>) {
    state = { ...state, ...next };
    listeners.forEach((listener) => listener());
  }

  function run(): Promise<T[]> {
    /* Joined rather than restarted. Without this, a page with a grid, a search
       dock and a rail would fire three identical requests on first paint. */
    if (inFlight) return inFlight;

    if (!state.loading) set({ loading: true });

    inFlight = fetcher()
      .then((rows) => {
        set({ data: rows, loading: false, error: null, loaded: true });
        return rows;
      })
      .catch((error: unknown) => {
        /* The API client's normaliser has already turned this into a message
           written to be read, so it is kept rather than reworded. */
        const message =
          error instanceof Error ? error.message : "That could not be loaded just now.";
        set({ loading: false, error: message, loaded: true });
        /* Resolved, not rejected: `error` in the snapshot is how this is
           reported, and a rejection here would surface as an unhandled one in
           every caller that only wanted to trigger the load. */
        return state.data;
      })
      .finally(() => {
        inFlight = null;
      });

    return inFlight;
  }

  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    getSnapshot() {
      /* Reading is what starts the load. A component does not have to remember
         to call anything, and there is no effect to get wrong — but the fetch
         must not be started DURING the render pass that reads this, or React
         warns about a state update from a render. A microtask defers it to just
         after. */
      if (!state.loaded && !state.loading && inFlight === null) {
        set({ loading: true });
        void Promise.resolve().then(run);
      }

      return state;
    },

    getServerSnapshot() {
      return EMPTY as RemoteState<T>;
    },

    peek() {
      return state;
    },

    refresh() {
      /* Deliberately does NOT clear `data`. A register that emptied itself while
         reloading would flash blank on every save. */
      inFlight = null;
      return run();
    },

    load() {
      if (state.loaded && !state.error) return Promise.resolve(state.data);
      return run();
    },

    put(next) {
      set({ data: next, loaded: true, error: null });
    },

    reset() {
      inFlight = null;
      state = EMPTY as RemoteState<T>;
      listeners.forEach((listener) => listener());
    },
  };
}
