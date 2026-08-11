"use client";

/**
 * A localStorage-backed record, shaped for `useSyncExternalStore`.
 *
 * The profile and the address book both need the same four things, and getting
 * any of them subtly wrong is a bug that only shows up later:
 *
 * - The snapshot has to be **referentially stable**. Parsing the JSON on every
 *   read returns a new object each time, which React reads as "changed" and
 *   re-renders forever. The parse is cached against the raw string instead.
 * - It must not depend on anything **firing**. An effect trips the repo's lint
 *   rule and a `requestAnimationFrame` never runs in a background tab, so a
 *   record hydrated that way silently stays on placeholder data.
 * - The server snapshot has to be the same object every call, and has to match
 *   what the static export was built with, or hydration disagrees.
 * - `localStorage` throws outright in some privacy modes, so an in-memory copy
 *   backs it: a record that cannot be persisted still lasts the life of the tab.
 */
export type LocalStore<T extends object> = {
  subscribe: (listener: () => void) => () => void;
  getSnapshot: () => T;
  getServerSnapshot: () => T;
  write: (next: T) => void;
};

/**
 * How a parsed value becomes a record. Return `null` to fall back.
 *
 * The default merges the stored object over the fallback, so a record written
 * before a field existed is still usable. Pass your own when the key already
 * holds a different shape in the wild and you would rather migrate it than
 * strand it — see the wishlist, whose key held a bare array first.
 */
export type Revive<T> = (parsed: unknown, fallback: T) => T | null;

function defaultRevive<T extends object>(parsed: unknown, fallback: T): T | null {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  return { ...fallback, ...(parsed as Partial<T>) };
}

export function createLocalStore<T extends object>(
  key: string,
  fallback: T,
  revive: Revive<T> = defaultRevive,
): LocalStore<T> {
  let cachedRaw: string | null = null;
  let cached: T = fallback;
  let memory: T | null = null;

  const listeners = new Set<() => void>();

  function notify() {
    listeners.forEach((listener) => listener());
  }

  function onStorage(event: StorageEvent) {
    // `key === null` is a whole-store clear, which counts.
    if (event.key !== null && event.key !== key) return;
    notify();
  }

  /** Saving in one tab shows up in the rest. */
  function subscribe(listener: () => void) {
    listeners.add(listener);
    if (listeners.size === 1) window.addEventListener("storage", onStorage);

    return () => {
      listeners.delete(listener);
      if (listeners.size === 0) window.removeEventListener("storage", onStorage);
    };
  }

  function getSnapshot(): T {
    let raw: string | null;
    try {
      raw = window.localStorage.getItem(key);
    } catch {
      return memory ?? fallback;
    }

    if (raw === null) return memory ?? fallback;

    if (raw !== cachedRaw) {
      cachedRaw = raw;
      try {
        cached = revive(JSON.parse(raw), fallback) ?? fallback;
      } catch {
        cached = fallback;
      }
    }

    return cached;
  }

  function getServerSnapshot(): T {
    return fallback;
  }

  function write(next: T) {
    const raw = JSON.stringify(next);
    memory = next;
    cachedRaw = raw;
    cached = next;

    try {
      window.localStorage.setItem(key, raw);
    } catch {
      /* Quota, or a privacy mode that refuses the write. The session keeps the
         new record either way — it just does not outlive the tab, so the cached
         raw string is dropped to stop it matching a stale stored one. */
      cachedRaw = null;
    }

    notify();
  }

  return { subscribe, getSnapshot, getServerSnapshot, write };
}
