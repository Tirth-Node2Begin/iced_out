"use client";

import { useMemo, useSyncExternalStore } from "react";

import { adminClient } from "@/api/clients";
import { createRemoteRecord, type RemoteRecord } from "@/lib/remote-store";
import type {
  Material,
  MaterialSummary,
  Movement,
  Purchase,
  PurchaseLine,
  Recipe,
  Run,
  RunDetail,
  RunSummary,
  Supplier,
} from "@/features/24-materials/types";

/**
 * The raw-material read layer.
 *
 * Same shape as the CRM's `crm-api`: keyed record stores so two different
 * filters are two different cached answers, and nothing is optimistic — a
 * write returns the server's new state and the caller decides what to reload.
 *
 * Nothing optimistic matters more here than anywhere else in the console. A
 * material count that the browser guessed and the server refused is a number an
 * operator will cut fabric against.
 */

const BASE = "/admin/inventory";

function toQuery(params: Record<string, string | undefined>): string {
  const search = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    const trimmed = (value ?? "").trim();
    if (trimmed !== "" && trimmed !== "all") search.set(key, trimmed);
  });

  const qs = search.toString();
  return qs === "" ? "" : `?${qs}`;
}

/** A bounded cache of record stores, keyed by the full request path. */
function keyed<T>(fetcher: (path: string) => Promise<T>, limit = 12) {
  const held = new Map<string, RemoteRecord<T>>();

  return (path: string): RemoteRecord<T> => {
    const found = held.get(path);

    if (found) {
      held.delete(path);
      held.set(path, found);
      return found;
    }

    const record = createRemoteRecord<T>(() => fetcher(path));
    held.set(path, record);

    while (held.size > limit) {
      const oldest = held.keys().next();
      if (oldest.done) break;
      held.delete(oldest.value);
    }

    return record;
  };
}

async function read<T>(path: string): Promise<T> {
  const response = await adminClient.get<{ data: T }>(path);
  return response.data.data;
}

type MaterialList = { materials: Material[]; summary: MaterialSummary };
type MaterialDetail = {
  material: Material;
  movements: Movement[];
  usedIn: Array<{ itemId: string; item: string; perUnit: string; effective: string }>;
};
type PurchaseDetail = { purchase: Purchase; lines: PurchaseLine[] };
type RunList = { runs: Run[]; summary: RunSummary };

const materialLists = keyed<MaterialList>(read);
const materialDetails = keyed<MaterialDetail>(read, 16);
const supplierLists = keyed<{ suppliers: Supplier[] }>(read);
const purchaseLists = keyed<{ purchases: Purchase[] }>(read);
const purchaseDetails = keyed<PurchaseDetail>(read, 16);
const runLists = keyed<RunList>(read);
const runDetails = keyed<RunDetail>(read, 16);
const recipes = keyed<Recipe>(read, 16);

/* ------------------------------------------------------------------- hooks */

function useRecord<T>(record: RemoteRecord<T>) {
  const state = useSyncExternalStore(record.subscribe, record.getSnapshot, record.getServerSnapshot);

  return {
    data: state.data,
    loading: state.loading,
    error: state.error,
    loaded: state.loaded,
    reload: record.reload,
  };
}

export type MaterialFilters = {
  kind?: string;
  supplier?: string;
  status?: string;
  risk?: string;
  q?: string;
};

export function useMaterials(filters: MaterialFilters = {}) {
  const path = `${BASE}/materials${toQuery(filters)}`;
  const state = useRecord(useMemo(() => materialLists(path), [path]));

  return {
    ...state,
    materials: state.data?.materials ?? [],
    summary: state.data?.summary ?? { total: 0, atRisk: 0, outOfStock: 0, stockValue: "₹0" },
  };
}

export function useMaterial(id: string) {
  const path = `${BASE}/materials/${encodeURIComponent(id)}`;
  const state = useRecord(useMemo(() => materialDetails(path), [path]));
  return { ...state, detail: state.data ?? null };
}

export function useSuppliers(filters: { status?: string; q?: string } = {}) {
  const path = `${BASE}/suppliers${toQuery(filters)}`;
  const state = useRecord(useMemo(() => supplierLists(path), [path]));
  return { ...state, suppliers: state.data?.suppliers ?? [] };
}

export function usePurchases(filters: { status?: string; supplier?: string; q?: string } = {}) {
  const path = `${BASE}/purchases${toQuery(filters)}`;
  const state = useRecord(useMemo(() => purchaseLists(path), [path]));
  return { ...state, purchases: state.data?.purchases ?? [] };
}

export function usePurchase(id: string) {
  const path = `${BASE}/purchases/${encodeURIComponent(id)}`;
  const state = useRecord(useMemo(() => purchaseDetails(path), [path]));
  return { ...state, detail: state.data ?? null };
}

export function useRuns(filters: { status?: string; item?: string; q?: string } = {}) {
  const path = `${BASE}/runs${toQuery(filters)}`;
  const state = useRecord(useMemo(() => runLists(path), [path]));

  return {
    ...state,
    runs: state.data?.runs ?? [],
    summary: state.data?.summary ?? { total: 0, planned: 0, started: 0, unitsMade: 0 },
  };
}

export function useRun(id: string) {
  const path = `${BASE}/runs/${encodeURIComponent(id)}`;
  const state = useRecord(useMemo(() => runDetails(path), [path]));
  return { ...state, detail: state.data ?? null };
}

export function useRecipe(itemId: string) {
  const path = `${BASE}/recipes/${encodeURIComponent(itemId)}`;
  const state = useRecord(useMemo(() => recipes(path), [path]));
  return { ...state, recipe: state.data ?? null };
}

/* ------------------------------------------------------------------ writes */

export const materials = {
  create: (body: Record<string, unknown>) =>
    adminClient.post<{ data: { material: Material } }>(`${BASE}/materials`, body),

  update: (id: string, body: Record<string, unknown>) =>
    adminClient.patch(`${BASE}/materials/${encodeURIComponent(id)}`, body),

  remove: (id: string) => adminClient.delete(`${BASE}/materials/${encodeURIComponent(id)}`),

  /** A stocktake correction. The reason is required by the API, not decorative. */
  adjust: (id: string, onHand: number, reason: string) =>
    adminClient.post(`${BASE}/materials/${encodeURIComponent(id)}/adjust`, { onHand, reason }),

  writeOff: (id: string, qty: number, type: "WASTAGE" | "RETURN_OUT", reason: string) =>
    adminClient.post(`${BASE}/materials/${encodeURIComponent(id)}/write-off`, { qty, type, reason }),

  createSupplier: (body: Record<string, unknown>) =>
    adminClient.post<{ data: { supplier: Supplier } }>(`${BASE}/suppliers`, body),

  updateSupplier: (id: string, body: Record<string, unknown>) =>
    adminClient.patch(`${BASE}/suppliers/${encodeURIComponent(id)}`, body),

  removeSupplier: (id: string) => adminClient.delete(`${BASE}/suppliers/${encodeURIComponent(id)}`),

  createPurchase: (body: Record<string, unknown>) =>
    adminClient.post<{ data: { purchase: Purchase } }>(`${BASE}/purchases`, body),

  /** The whole line set at once — a purchase order is edited as a document. */
  setPurchaseLines: (id: string, lines: Array<{ material: string; qty: number; unitCost: number }>) =>
    adminClient.put(`${BASE}/purchases/${encodeURIComponent(id)}/lines`, { lines }),

  transitionPurchase: (id: string, to: "order" | "cancel") =>
    adminClient.post(`${BASE}/purchases/${encodeURIComponent(id)}/transition`, { to }),

  receive: (id: string, lines: Array<{ material: string; qty: number }>) =>
    adminClient.post(`${BASE}/purchases/${encodeURIComponent(id)}/receive`, { lines }),

  removePurchase: (id: string) => adminClient.delete(`${BASE}/purchases/${encodeURIComponent(id)}`),

  setRecipe: (
    itemId: string,
    lines: Array<{ material: string; perUnit: number; wastagePct: number; note?: string }>,
  ) => adminClient.put(`${BASE}/recipes/${encodeURIComponent(itemId)}`, { lines }),

  createRun: (body: Record<string, unknown>) =>
    adminClient.post<{ data: RunDetail }>(`${BASE}/runs`, body),

  transitionRun: (id: string, to: "start" | "complete" | "cancel", produced?: number) =>
    adminClient.post(`${BASE}/runs/${encodeURIComponent(id)}/transition`, { to, produced }),

  removeRun: (id: string) => adminClient.delete(`${BASE}/runs/${encodeURIComponent(id)}`),
};
