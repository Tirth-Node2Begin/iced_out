"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { customerClient } from "@/api/clients";
import { useAuth } from "@/features/20-auth-security/auth-context";

/**
 * The address book, held by the account rather than by the browser.
 *
 * It used to be a `localStorage` record seeded with two sample addresses, so
 * every visitor — including one who had just registered — opened onto the same
 * Home and Studio cards. The book belongs to a user now: `GET /me/addresses`
 * returns theirs, a new account's is empty, and which one is default is a fact
 * the server keeps rather than a field two tabs can disagree about.
 */
export type Address = {
  id: string;
  label: string;
  name: string;
  /** [street, "City, State 560001"] — what the card prints, built by the API. */
  lines: string[];
  phone: string;
};

type AddressBook = {
  addresses: Address[];
  defaultId: string;
};

const EMPTY: AddressBook = { addresses: [], defaultId: "" };

/**
 * The form speaks in printed lines; the API speaks in fields.
 *
 * The region line has one shape everywhere in this app — `City, State 560001` —
 * so it is split back into the three columns the address is actually stored in.
 * Anything that does not match is sent as the city, which keeps a hand-typed
 * address saveable instead of rejecting it over punctuation.
 */
function toFields(address: Omit<Address, "id">) {
  const [street = "", region = ""] = address.lines;
  const match = /^(.*?),\s*(.*?)\s+(\d{6})$/.exec(region.trim());

  return {
    label: address.label,
    name: address.name,
    street,
    city: match?.[1]?.trim() ?? region.trim(),
    state: match?.[2]?.trim() ?? "",
    pincode: match?.[3] ?? "",
    phone: address.phone,
  };
}

type AddressesContextValue = {
  addresses: Address[];
  defaultId: string;
  /** The one the checkout pre-selects, or null once the book is empty. */
  defaultAddress: Address | null;
  ready: boolean;
  add: (address: Omit<Address, "id">, options?: { makeDefault?: boolean }) => Promise<void>;
  /** Replace a saved address in place — the id, and so the default, survives. */
  update: (
    id: string,
    address: Omit<Address, "id">,
    options?: { makeDefault?: boolean },
  ) => Promise<void>;
  remove: (id: string) => Promise<void>;
  setDefault: (id: string) => Promise<void>;
};

const AddressesContext = createContext<AddressesContextValue | null>(null);

export function AddressesProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, sessionReady } = useAuth();
  const [book, setBook] = useState<AddressBook>(EMPTY);
  const [ready, setReady] = useState(false);

  /** Re-reads the book. Awaited by every mutation, so the list is never guessed at. */
  const reload = useCallback(async () => {
    if (!isAuthenticated) {
      setBook(EMPTY);

      return;
    }

    try {
      const response = await customerClient.get<{ data: AddressBook }>("/me/addresses");
      setBook(response.data.data);
    } catch {
      setBook(EMPTY);
    }
  }, [isAuthenticated]);

  /* Nothing is written while the effect body runs: the request is awaited
     first, and a provider unmounted mid-flight writes nothing at all. */
  useEffect(() => {
    if (!sessionReady) return;

    let live = true;

    async function load() {
      if (!isAuthenticated) {
        if (live) {
          setBook(EMPTY);
          setReady(true);
        }

        return;
      }

      try {
        const response = await customerClient.get<{ data: AddressBook }>("/me/addresses");
        if (live) setBook(response.data.data);
      } catch {
        if (live) setBook(EMPTY);
      } finally {
        if (live) setReady(true);
      }
    }

    void load();

    return () => {
      live = false;
    };
  }, [isAuthenticated, sessionReady]);

  const add = useCallback(
    async (address: Omit<Address, "id">, options?: { makeDefault?: boolean }) => {
      /* The server decides the id and whether an empty book takes this as its
         default — the two rules that used to live in this file and could drift
         from what checkout actually reads. */
      await customerClient.post("/me/addresses", {
        ...toFields(address),
        makeDefault: options?.makeDefault ?? false,
      });
      await reload();
    },
    [reload],
  );

  const update = useCallback(
    async (id: string, address: Omit<Address, "id">, options?: { makeDefault?: boolean }) => {
      /* Patched in place rather than removed-and-re-added: the id is what the
         default points at, and what a checkout draft remembers picking. */
      await customerClient.patch(`/me/addresses/${id}`, {
        ...toFields(address),
        makeDefault: options?.makeDefault ?? false,
      });
      await reload();
    },
    [reload],
  );

  const remove = useCallback(
    async (id: string) => {
      await customerClient.delete(`/me/addresses/${id}`);
      await reload();
    },
    [reload],
  );

  const setDefault = useCallback(
    async (id: string) => {
      await customerClient.post(`/me/addresses/${id}/default`);
      await reload();
    },
    [reload],
  );

  const value = useMemo(() => {
    const defaultAddress =
      book.addresses.find((address) => address.id === book.defaultId) ??
      book.addresses[0] ??
      null;

    return {
      addresses: book.addresses,
      defaultId: book.defaultId,
      defaultAddress,
      ready,
      add,
      update,
      remove,
      setDefault,
    };
  }, [add, book, ready, remove, setDefault, update]);

  return <AddressesContext.Provider value={value}>{children}</AddressesContext.Provider>;
}

export function useAddresses() {
  const context = useContext(AddressesContext);
  if (!context) throw new Error("useAddresses must be used inside AddressesProvider");
  return context;
}
