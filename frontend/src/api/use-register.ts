"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

import { adminClient } from "@/api/clients";
import { createIdempotencyKey } from "@/api/request-context";
import type { RecordRow } from "@/components/admin/record-manager";
import {
  createRecordCache,
  createRemoteRecord,
  createRemoteStore,
  type RecordState,
  type RemoteRecord,
  type RemoteStore,
} from "@/lib/remote-store";

/**
 * A console register, backed by the database.
 *
 * Every screen in `/admin` is a list of records an operator can search, create,
 * edit, delete and act on. All of them held those records in `useState` or in
 * `localStorage`, seeded from a fixture file — so a product created in the
 * console existed in that browser tab and nowhere else. It did not appear in the
 * shop, it did not appear on another operator's screen, and it was gone on a
 * hard reload.
 *
 * This binds one register to one set of endpoints. Reads go through a shared
 * `RemoteStore`, so two screens showing the same register (the products tab and
 * the product editor's dropdown) read one list and one request. Writes go
 * straight to the API and the store is re-read from the response, which means
 * the row on screen after a save is the row the database actually holds —
 * including the parts the server decided: a minted slug, a derived SKU, a
 * status the server refused to change.
 *
 * The stores are cached by endpoint below, not created per mount: a hook that
 * built its own store would lose everything on unmount and re-fetch on every
 * navigation between two tabs of the same register.
 */

/** How a register's write verbs map onto endpoints. */
export type RegisterEndpoints = {
  /** The list endpoint. Also the create endpoint unless `createPath` says otherwise. */
  path: string;
  /** POST target for a create. Defaults to `path`. */
  createPath?: string;
  /**
   * Where one record lives, from the record itself. Needed for edit and delete;
   * a register with neither can leave it out.
   *
   * It takes the row rather than an id because the console's registers are not
   * consistent about what identifies a record — a product is addressed by slug,
   * a variant by SKU, an order by number, a voucher by code — and encoding that
   * per register is what stops a PATCH going to the wrong URL.
   */
  itemPath?: (row: RecordRow) => string;
  /** Turns the form's values into a request body. Defaults to the values as-is. */
  toCreate?: (values: RecordRow) => Record<string, unknown>;
  /**
   * The body of an edit. Defaults to `toCreate`, then to the values.
   * `previous` is the record before the change, for a PATCH that should only
   * carry what actually moved.
   */
  toUpdate?: (values: RecordRow, previous: RecordRow) => Record<string, unknown>;
  /** Reads the rows out of a list response. Defaults to `body.data`. */
  fromList?: (data: unknown) => RecordRow[];
  /** `PATCH` unless a register's update endpoint is a `PUT`. */
  updateMethod?: "PATCH" | "PUT";
  /** Marks create as replay-safe. Set for anything that moves money. */
  idempotent?: boolean;
};

export type Register = {
  /** The rows, newest state the server confirmed. */
  rows: RecordRow[];
  loading: boolean;
  error: string | null;
  /** False until the API has answered — tells an empty register from an unread one. */
  loaded: boolean;
  /** Re-reads the list. */
  refresh: () => Promise<RecordRow[]>;
  onCreate: (values: RecordRow) => Promise<void>;
  onUpdate: (values: RecordRow, previous: RecordRow) => Promise<void>;
  onDelete: (row: RecordRow) => Promise<void>;
  /**
   * A row verb that is its own endpoint — confirming an order, approving a
   * return. POSTs and re-reads, so the row's new state comes from the server
   * rather than from a guess about what the verb did.
   */
  act: (path: string, body?: Record<string, unknown>) => Promise<void>;
};

/** One store per list endpoint, shared by every screen that reads it. */
const stores = new Map<string, RemoteStore<RecordRow>>();

function storeFor(path: string, fromList?: (data: unknown) => RecordRow[]): RemoteStore<RecordRow> {
  const held = stores.get(path);
  if (held) return held;

  const store = createRemoteStore<RecordRow>(async () => {
    const response = await adminClient.get<{ data: unknown }>(path);
    const data = response.data.data;

    if (fromList) return fromList(data);

    /* Every console endpoint answers with a list of flat string maps — that is
       the shape `CatalogPresenter` and its siblings are written to produce. A
       register whose endpoint nests them passes `fromList`. */
    return Array.isArray(data) ? (data as RecordRow[]) : [];
  });

  stores.set(path, store);
  return store;
}

/**
 * Drops every cached register. Called on staff sign-out, so the next operator to
 * sign in on this machine does not start out looking at the last one's data.
 */
export function resetRegisters() {
  stores.forEach((store) => store.reset());
}

/** Re-reads one register from anywhere — for a write made outside its own screen. */
export function refreshRegister(path: string) {
  return stores.get(path)?.refresh() ?? Promise.resolve([]);
}

export function useRegister(endpoints: RegisterEndpoints): Register {
  const {
    path,
    createPath,
    itemPath,
    toCreate,
    toUpdate,
    fromList,
    updateMethod = "PATCH",
    idempotent = false,
  } = endpoints;

  /* Every caller passes a memoised `endpoints` object (see the `useMemo` in each
     context), so the verbs below stay referentially stable across renders without
     needing a ref — which this repo lints against writing during a render, and
     rightly: a ref written in render is a value React cannot see changing. */
  const store = useMemo(() => storeFor(path, fromList), [fromList, path]);
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);

  const refresh = useCallback(() => store.refresh(), [store]);

  const onCreate = useCallback(
    async (values: RecordRow) => {
      const body = toCreate?.(values) ?? values;

      await adminClient.post(
        createPath ?? path,
        body,
        idempotent
          ? { headers: { "Idempotency-Key": createIdempotencyKey(path) } }
          : undefined,
      );

      /* Re-read rather than push the response onto the list. The server may have
         changed more than this one row — a new product moves its category's
         count, a new variant changes its product's stock — and a register that
         only spliced in what came back would show those stale. */
      await store.refresh();
    },
    [createPath, idempotent, path, store, toCreate],
  );

  const onUpdate = useCallback(
    async (values: RecordRow, previous: RecordRow) => {
      if (!itemPath) throw new Error("This register cannot be edited: no itemPath.");

      const body = toUpdate?.(values, previous) ?? toCreate?.(values) ?? values;

      await adminClient.request({ method: updateMethod, url: itemPath(previous), data: body });
      await store.refresh();
    },
    [itemPath, store, toCreate, toUpdate, updateMethod],
  );

  const onDelete = useCallback(
    async (row: RecordRow) => {
      if (!itemPath) throw new Error("This register cannot be deleted from: no itemPath.");

      await adminClient.delete(itemPath(row));
      await store.refresh();
    },
    [itemPath, store],
  );

  const act = useCallback(
    async (actionPath: string, body?: Record<string, unknown>) => {
      await adminClient.post(actionPath, body ?? {});
      await store.refresh();
    },
    [store],
  );

  return useMemo(
    () => ({
      rows: state.data,
      loading: state.loading,
      error: state.error,
      loaded: state.loaded,
      refresh,
      onCreate,
      onUpdate,
      onDelete,
      act,
    }),
    [act, onCreate, onDelete, onUpdate, refresh, state],
  );
}

/**
 * ONE record, for a detail screen.
 *
 * Not a register: a detail endpoint returns a whole object — an order's row, its
 * lines and its timeline together — rather than a list of flat maps, and the
 * screen wants all three. Nothing is cached across mounts, because a detail
 * screen is opened to see the current state of one thing.
 *
 * `reload` is what a verb on the screen calls after it writes.
 */
export type AdminRecord<T> = {
  data: T | null;
  loading: boolean;
  error: string | null;
  /** False until the endpoint has answered — "not found" vs "not read yet". */
  loaded: boolean;
  reload: () => Promise<void>;
};

/**
 * One record store per path, cached — so `useSyncExternalStore` is handed the same
 * store each render, and two screens asking for the same order share one request.
 */
const records = createRecordCache<unknown>(async (path) => {
  const response = await adminClient.get<{ data: unknown }>(path);
  return response.data.data;
});

/** A store that is always empty, for a screen with no id to ask about yet. */
const ABSENT = createRemoteRecord<never>(() => Promise.reject(new Error("no record")));

export function useAdminRecord<T>(path: string | null): AdminRecord<T> {
  /* `useSyncExternalStore` rather than an effect that setStates: this repo lints
     the latter as an error, and the store already owns the load, the dedupe and
     the reload. `path === null` — a detail route whose `?id=` is not there yet —
     reads a store that never resolves, so nothing is requested. */
  const record = (path === null ? ABSENT : records(path)) as RemoteRecord<T>;

  const state = useSyncExternalStore<RecordState<T>>(
    record.subscribe,
    path === null ? emptyRecordSnapshot<T> : record.getSnapshot,
    emptyRecordSnapshot<T>,
  );

  const reload = useCallback(async () => {
    if (path !== null) await record.reload();
  }, [path, record]);

  return useMemo(() => ({ ...state, reload }), [reload, state]);
}

/* One object, so the snapshot stays referentially stable for the null case. */
const EMPTY_RECORD: RecordState<never> = {
  data: null,
  loading: false,
  error: null,
  loaded: true,
};

function emptyRecordSnapshot<T>(): RecordState<T> {
  return EMPTY_RECORD as RecordState<T>;
}

/**
 * A read-only console list — a ledger, a queue, a breakdown.
 *
 * Same store, no write verbs. Kept separate so a screen that only reads cannot
 * accidentally be given an edit button by a later change to its props.
 */
export function useRegisterList(
  path: string,
  fromList?: (data: unknown) => RecordRow[],
): Pick<Register, "rows" | "loading" | "error" | "loaded" | "refresh"> {
  const store = useMemo(() => storeFor(path, fromList), [fromList, path]);
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
  const refresh = useCallback(() => store.refresh(), [store]);

  return useMemo(
    () => ({
      rows: state.data,
      loading: state.loading,
      error: state.error,
      loaded: state.loaded,
      refresh,
    }),
    [refresh, state],
  );
}
