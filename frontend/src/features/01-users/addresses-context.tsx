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
import { useHydrated } from "@/lib/use-hydrated";

/**
 * The address book.
 *
 * It lived in `useState` on the Addresses screen, which was fine while that
 * screen was the only thing that knew about it. The profile now shows the
 * default one, so which address is default has to be a fact about the account
 * rather than a fact about a mounted component — pick a new default on the
 * Addresses tab and the Profile tab is already showing it.
 */
export type Address = {
  id: string;
  label: string;
  name: string;
  lines: string[];
  phone: string;
};

type AddressBook = {
  addresses: Address[];
  defaultId: string;
};

const SEEDED: AddressBook = {
  addresses: [
    {
      id: "addr-home",
      label: "Home",
      name: "Iced_out Shopper",
      lines: ["12 Preview Street", "Bengaluru, Karnataka 560001"],
      phone: "+91 ••••• 43210",
    },
    {
      id: "addr-work",
      label: "Studio",
      name: "Iced_out Shopper",
      lines: ["4th Floor, Block C", "New Delhi, Delhi 110001"],
      phone: "+91 ••••• 43210",
    },
  ],
  defaultId: "addr-home",
};

const STORAGE_KEY = "iced-out-addresses-v1";

const store = createLocalStore<AddressBook>(STORAGE_KEY, SEEDED);

type AddressesContextValue = {
  addresses: Address[];
  defaultId: string;
  /** The one the checkout pre-selects, or null once the book is empty. */
  defaultAddress: Address | null;
  ready: boolean;
  add: (address: Omit<Address, "id">, options?: { makeDefault?: boolean }) => void;
  /** Replace a saved address in place — the id, and so the default, survives. */
  update: (id: string, address: Omit<Address, "id">, options?: { makeDefault?: boolean }) => void;
  remove: (id: string) => void;
  setDefault: (id: string) => void;
};

const AddressesContext = createContext<AddressesContextValue | null>(null);

export function AddressesProvider({ children }: { children: ReactNode }) {
  const book = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
  const ready = useHydrated();

  const add = useCallback((address: Omit<Address, "id">, options?: { makeDefault?: boolean }) => {
    /* Off the clock rather than off the list length: `addr-${length + 1}`
       re-issues an id that a removal freed, and the new address then inherits
       whatever the old one was pointed at. */
    const id = `addr-${Date.now().toString(36)}`;
    const current = store.getSnapshot();

    /* An empty book takes the new address as its default whatever was asked
       for — otherwise saving into an emptied book leaves an account holding a
       destination that nothing is pointing at. */
    const claimsDefault =
      options?.makeDefault === true ||
      current.addresses.length === 0 ||
      current.defaultId === "";

    store.write({
      addresses: [...current.addresses, { ...address, id }],
      defaultId: claimsDefault ? id : current.defaultId,
    });
  }, []);

  const update = useCallback(
    (id: string, address: Omit<Address, "id">, options?: { makeDefault?: boolean }) => {
      const current = store.getSnapshot();
      /* Edited in place rather than removed-and-re-added: the id is what the
         default points at, and what a checkout draft remembers picking. A new
         id for a corrected pincode would silently move the default elsewhere. */
      const addresses = current.addresses.map((entry) =>
        entry.id === id ? { ...address, id } : entry,
      );

      store.write({
        addresses,
        /* Un-ticking the box on the address that IS the default cannot clear
           it — something has to be the destination — so only the ticking is
           acted on. Moving the default off this one is done by making another
           one default. */
        defaultId: options?.makeDefault ? id : current.defaultId,
      });
    },
    [],
  );

  const remove = useCallback((id: string) => {
    const current = store.getSnapshot();
    const addresses = current.addresses.filter((address) => address.id !== id);
    /* Removing the default has to hand the title to something, or the account
       is left with a book full of addresses and no destination. */
    const defaultId =
      id === current.defaultId ? (addresses[0]?.id ?? "") : current.defaultId;

    store.write({ addresses, defaultId });
  }, []);

  const setDefault = useCallback((id: string) => {
    store.write({ ...store.getSnapshot(), defaultId: id });
  }, []);

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
