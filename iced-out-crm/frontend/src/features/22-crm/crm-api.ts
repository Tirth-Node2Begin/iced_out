"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

import { adminClient } from "@/api/clients";
import { createRemoteRecord, type RemoteRecord } from "@/lib/remote-store";
import type {
  Activity,
  Board,
  Company,
  Contact,
  CrmSummary,
  Lead,
  Note,
  StaffOwner,
  SubjectType,
} from "@/features/22-crm/types";

/**
 * The CRM's read layer.
 *
 * Every list here is FILTERED SERVER-SIDE — the query string is part of the
 * cache key — because these registers are the ones that grow without bound. A
 * contacts screen that fetched everything and filtered in the browser would be
 * fine for the first year and unusable in the third, and the filter chips are
 * exactly the moment you find out.
 *
 * That is why these are keyed record stores rather than the flat
 * `createRemoteStore` the console's fixed registers use: two different filters
 * are two different answers, and they must not evict each other.
 */

const BASE = "/admin/crm";

/** `{status: "OPEN", q: ""}` → `?status=OPEN`. Blank and "all" are dropped. */
function toQuery(params: Record<string, string | undefined>): string {
  const search = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    const trimmed = (value ?? "").trim();
    if (trimmed !== "" && trimmed !== "all") search.set(key, trimmed);
  });

  const qs = search.toString();
  return qs === "" ? "" : `?${qs}`;
}

/**
 * A bounded cache of record stores, keyed by the full request path.
 *
 * `createRecordCache` in lib/remote-store does this for a single fetcher; this
 * is the same idea per endpoint family, and the cap is there for the same
 * reason: an operator who types eight characters into a search box has just
 * created eight cache keys, and none of them is worth holding for the session.
 */
function keyedRecords<T>(fetcher: (path: string) => Promise<T>, limit = 12) {
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

/* ------------------------------------------------------------------ stores */

const summaryRecord = createRemoteRecord<CrmSummary>(() => read<CrmSummary>(`${BASE}/summary`));
const ownersRecord = createRemoteRecord<{ owners: StaffOwner[] }>(() =>
  read<{ owners: StaffOwner[] }>(`${BASE}/owners`),
);
const companyOptionsRecord = createRemoteRecord<{ companies: { id: string; name: string }[] }>(() =>
  read<{ companies: { id: string; name: string }[] }>(`${BASE}/companies/options`),
);

const leadLists = keyedRecords<{ leads: Lead[]; counts: Record<string, number> }>(read);
const contactLists = keyedRecords<{ contacts: Contact[]; counts: Record<string, number> }>(read);
const companyLists = keyedRecords<{ companies: Company[] }>(read);
const activityLists = keyedRecords<{ activities: Activity[]; counts: Record<string, number> }>(read);
const boards = keyedRecords<Board>(read);

const leadDetails = keyedRecords<{ lead: Lead }>(read, 16);
const contactDetails = keyedRecords<ContactDetail>(read, 16);
const companyDetails = keyedRecords<CompanyDetail>(read, 16);
const dealDetails = keyedRecords<DealDetail>(read, 16);

export type ContactDetail = {
  contact: Contact;
  deals: import("@/features/22-crm/types").Deal[];
  activities: Activity[];
  notes: Note[];
  orders: import("@/features/22-crm/types").CrmOrder[];
};

export type CompanyDetail = {
  company: Company;
  contacts: Contact[];
  deals: import("@/features/22-crm/types").Deal[];
  activities: Activity[];
  notes: Note[];
};

export type DealDetail = {
  deal: import("@/features/22-crm/types").Deal;
  stages: import("@/features/22-crm/types").Stage[];
  activities: Activity[];
  notes: Note[];
};

/** Every store the CRM holds, so sign-out can drop all of it at once. */
const RESETTABLE = [summaryRecord, ownersRecord, companyOptionsRecord];

export function resetCrmStores() {
  RESETTABLE.forEach((store) => store.reset());
}

/* ------------------------------------------------------------------- hooks */

/**
 * A store that is already "loaded" with nothing and never fetches.
 *
 * Hooks cannot be called conditionally, so a screen that only sometimes needs a
 * register still has to call its hook. Handing it this store is how it opts out
 * WITHOUT a request: `loaded` is true, so nothing downstream shows a spinner
 * waiting for an answer that is never coming.
 *
 * The alternative — passing a filter value nothing can match — costs a round
 * trip to be told what the caller already knew.
 */
const IDLE: RemoteRecord<never> = {
  subscribe: () => () => {},
  getSnapshot: () => ({ data: null, loading: false, error: null, loaded: true }),
  getServerSnapshot: () => ({ data: null, loading: false, error: null, loaded: true }),
  reload: () => Promise.resolve(null),
  reset: () => {},
};

function idle<T>(): RemoteRecord<T> {
  return IDLE as unknown as RemoteRecord<T>;
}

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

export function useCrmSummary() {
  return useRecord(summaryRecord);
}

export function useOwners() {
  const state = useRecord(ownersRecord);
  return { ...state, owners: state.data?.owners ?? [] };
}

export function useCompanyOptions() {
  const state = useRecord(companyOptionsRecord);
  return { ...state, companies: state.data?.companies ?? [] };
}

export type LeadFilters = { status?: string; source?: string; owner?: string; q?: string };

export function useLeads(filters: LeadFilters, enabled = true) {
  const path = `${BASE}/leads${toQuery(filters)}`;
  const state = useRecord(
    useMemo(() => (enabled ? leadLists(path) : idle<{ leads: Lead[]; counts: Record<string, number> }>()), [enabled, path]),
  );

  return {
    ...state,
    leads: state.data?.leads ?? [],
    counts: state.data?.counts ?? {},
  };
}

export function useLead(id: string) {
  const path = `${BASE}/leads/${encodeURIComponent(id)}`;
  const state = useRecord(useMemo(() => leadDetails(path), [path]));
  return { ...state, lead: state.data?.lead ?? null };
}

export type ContactFilters = { lifecycle?: string; owner?: string; company?: string; q?: string };

export function useContacts(filters: ContactFilters, enabled = true) {
  const path = `${BASE}/contacts${toQuery(filters)}`;
  const state = useRecord(
    useMemo(
      () => (enabled ? contactLists(path) : idle<{ contacts: Contact[]; counts: Record<string, number> }>()),
      [enabled, path],
    ),
  );

  return {
    ...state,
    contacts: state.data?.contacts ?? [],
    counts: state.data?.counts ?? {},
  };
}

export function useContact(id: string) {
  const path = `${BASE}/contacts/${encodeURIComponent(id)}`;
  const state = useRecord(useMemo(() => contactDetails(path), [path]));
  return { ...state, detail: state.data ?? null };
}

export type CompanyFilters = { status?: string; owner?: string; q?: string };

export function useCompanies(filters: CompanyFilters, enabled = true) {
  const path = `${BASE}/companies${toQuery(filters)}`;
  const state = useRecord(
    useMemo(() => (enabled ? companyLists(path) : idle<{ companies: Company[] }>()), [enabled, path]),
  );
  return { ...state, companies: state.data?.companies ?? [] };
}

export function useCompany(id: string) {
  const path = `${BASE}/companies/${encodeURIComponent(id)}`;
  const state = useRecord(useMemo(() => companyDetails(path), [path]));
  return { ...state, detail: state.data ?? null };
}

export type BoardFilters = { pipeline?: string; owner?: string; status?: string; q?: string };

export function useBoard(filters: BoardFilters) {
  const path = `${BASE}/deals${toQuery(filters)}`;
  const state = useRecord(useMemo(() => boards(path), [path]));
  return { ...state, board: state.data ?? null };
}

export function useDeal(id: string) {
  const path = `${BASE}/deals/${encodeURIComponent(id)}`;
  const state = useRecord(useMemo(() => dealDetails(path), [path]));
  return { ...state, detail: state.data ?? null };
}

export type ActivityFilters = {
  scope?: string;
  type?: string;
  owner?: string;
  about?: string;
  aboutId?: string;
  q?: string;
};

export function useActivities(filters: ActivityFilters) {
  const path = `${BASE}/activities${toQuery(filters)}`;
  const state = useRecord(useMemo(() => activityLists(path), [path]));

  return {
    ...state,
    activities: state.data?.activities ?? [],
    counts: (state.data?.counts ?? { overdue: 0, today: 0, open: 0 }) as {
      overdue: number;
      today: number;
      open: number;
    },
  };
}

/**
 * The two numbers the rail badges read.
 *
 * Deliberately sourced from the summary rather than from a call of their own:
 * the dashboard already fetches it, so on the landing screen this is free, and
 * everywhere else it is one request the whole session shares.
 */
export function useCrmCounts() {
  const { data } = useCrmSummary();

  return {
    openLeads: data?.leads.open ?? 0,
    myOverdue: data?.mine.overdue ?? 0,
  };
}

/* ------------------------------------------------------------------ writes */

/**
 * Every mutation goes through here so that one rule holds everywhere: a write
 * returns the server's new state, and the caller decides what to reload.
 *
 * Nothing is optimistic. A CRM's whole value is that the record on screen is the
 * record in the database — a board that shows a deal in a column the server
 * rejected is worse than a board that takes 200ms.
 */
export const crm = {
  async createLead(body: Record<string, unknown>) {
    const response = await adminClient.post<{ data: { lead: Lead } }>(`${BASE}/leads`, body);
    return response.data.data.lead;
  },

  async updateLead(id: string, body: Record<string, unknown>) {
    const response = await adminClient.patch<{ data: { lead: Lead } }>(
      `${BASE}/leads/${encodeURIComponent(id)}`,
      body,
    );
    return response.data.data.lead;
  },

  async convertLead(id: string, body: Record<string, unknown>) {
    const response = await adminClient.post<{ data: { lead: Lead } }>(
      `${BASE}/leads/${encodeURIComponent(id)}/convert`,
      body,
    );
    return response.data.data.lead;
  },

  deleteLead: (id: string) => adminClient.delete(`${BASE}/leads/${encodeURIComponent(id)}`),

  async createContact(body: Record<string, unknown>) {
    const response = await adminClient.post<{ data: { contact: Contact } }>(`${BASE}/contacts`, body);
    return response.data.data.contact;
  },

  async updateContact(id: string, body: Record<string, unknown>) {
    const response = await adminClient.patch<{ data: { contact: Contact } }>(
      `${BASE}/contacts/${encodeURIComponent(id)}`,
      body,
    );
    return response.data.data.contact;
  },

  deleteContact: (id: string) => adminClient.delete(`${BASE}/contacts/${encodeURIComponent(id)}`),

  async importableCustomers() {
    const response = await adminClient.get<{
      data: { customers: { id: string; name: string; email: string; phone: string; ordersCount: number; ordersTotal: string }[] };
    }>(`${BASE}/contacts/importable`);
    return response.data.data.customers;
  },

  async importCustomers(customers: string[], owner?: string) {
    const response = await adminClient.post<{ data: { created: number; skipped: number } }>(
      `${BASE}/contacts/import`,
      { customers, owner },
    );
    return response.data.data;
  },

  async createCompany(body: Record<string, unknown>) {
    const response = await adminClient.post<{ data: { company: Company } }>(`${BASE}/companies`, body);
    return response.data.data.company;
  },

  async updateCompany(id: string, body: Record<string, unknown>) {
    const response = await adminClient.patch<{ data: { company: Company } }>(
      `${BASE}/companies/${encodeURIComponent(id)}`,
      body,
    );
    return response.data.data.company;
  },

  deleteCompany: (id: string) => adminClient.delete(`${BASE}/companies/${encodeURIComponent(id)}`),

  async createDeal(body: Record<string, unknown>) {
    const response = await adminClient.post<{ data: { deal: unknown } }>(`${BASE}/deals`, body);
    return response.data.data.deal;
  },

  async updateDeal(id: string, body: Record<string, unknown>) {
    const response = await adminClient.patch(`${BASE}/deals/${encodeURIComponent(id)}`, body);
    return response.data;
  },

  /**
   * A board drop. `before`/`after` are the cards it landed between, not an
   * index — the server ranks by them, so a stale board cannot reorder someone
   * else's work.
   */
  moveDeal: (id: string, stage: string, before?: string, after?: string) =>
    adminClient.post(`${BASE}/deals/${encodeURIComponent(id)}/move`, { stage, before, after }),

  deleteDeal: (id: string) => adminClient.delete(`${BASE}/deals/${encodeURIComponent(id)}`),

  async createActivity(body: Record<string, unknown>) {
    const response = await adminClient.post<{ data: { activity: Activity } }>(
      `${BASE}/activities`,
      body,
    );
    return response.data.data.activity;
  },

  updateActivity: (id: string, body: Record<string, unknown>) =>
    adminClient.patch(`${BASE}/activities/${encodeURIComponent(id)}`, body),

  completeActivity: (id: string, outcome?: string) =>
    adminClient.post(`${BASE}/activities/${encodeURIComponent(id)}/complete`, { outcome }),

  reopenActivity: (id: string) =>
    adminClient.post(`${BASE}/activities/${encodeURIComponent(id)}/reopen`),

  deleteActivity: (id: string) => adminClient.delete(`${BASE}/activities/${encodeURIComponent(id)}`),

  createNote: (about: SubjectType, aboutId: string, body: string, pinned = false) =>
    adminClient.post<{ data: { note: Note } }>(`${BASE}/notes`, {
      aboutType: about,
      aboutId,
      body,
      pinned,
    }),

  updateNote: (id: string, body: Record<string, unknown>) =>
    adminClient.patch(`${BASE}/notes/${encodeURIComponent(id)}`, body),

  deleteNote: (id: string) => adminClient.delete(`${BASE}/notes/${encodeURIComponent(id)}`),
};

/**
 * Reloads the summary after any write that could change a rail badge.
 *
 * Called explicitly rather than wired into `crm.*` so a screen that writes ten
 * times in a loop — the customer import — refreshes once at the end.
 */
export function useRefreshCounts() {
  return useCallback(() => summaryRecord.reload(), []);
}
