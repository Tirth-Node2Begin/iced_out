"use client";

import { useRouter } from "next/navigation";
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

import { useHydrated } from "@/lib/use-hydrated";

/**
 * The one kind of session this console has.
 *
 * There used to be four roles and a permission list per role, checked at every
 * route and every nav item. It is one role now: whoever holds a staff session
 * is an administrator, and the only question left anywhere is whether a
 * session exists at all. `role` stays on the record because the topbar prints
 * it — it is a label, not a capability.
 */
export type StaffSession = {
  name: string;
  role: "ADMIN";
};

/**
 * Where the customer session is remembered between page loads.
 *
 * A flag, not a credential: there is no backend yet, so `isAuthenticated` is
 * the whole session. When there is a real one this becomes a token read from an
 * httpOnly cookie and this key goes away — nothing else in the app has to move.
 */
const SESSION_KEY = "iced-out.customer-session";

/**
 * Where the staff session is remembered, and for how long.
 *
 * It used to live in React state and nowhere else, on the reasoning that an
 * operations session left in `localStorage` is a way into the console left
 * lying on the machine. That reasoning is sound and the storage choice here
 * keeps it — but state alone meant the session did not survive its own page.
 * Reloading, or opening an admin URL directly, threw the operator back to
 * `/admin/login` with a `returnTo` every single time; in development, where a
 * Fast Refresh full reload happens on half the edits, it was constant.
 *
 * So: `sessionStorage`, not `localStorage`. It survives reloads and direct
 * navigation within the tab that signed in, and dies with that tab — nothing is
 * left behind for the next person to open the browser. On top of that the
 * record carries its own expiry and is treated as absent once it passes, so an
 * abandoned tab is not a way in either.
 */
const STAFF_SESSION_KEY = "iced-out.staff-session";

/** How long a staff session lasts without the operator doing anything. */
export const STAFF_SESSION_TTL_MS = 15 * 60 * 1000;

/** Writes are throttled to this, so extending the window is not a write per keystroke. */
const STAFF_TOUCH_INTERVAL_MS = 30 * 1000;

/* localStorage throws outright in some privacy modes, so an in-memory copy
   backs it: a session that cannot be persisted still lasts the life of the tab
   instead of taking the provider down with it. */
let memorySession = false;

const sessionListeners = new Set<() => void>();

function onSessionStorage(event: StorageEvent) {
  // `key === null` is a whole-store clear, which counts
  if (event.key !== null && event.key !== SESSION_KEY) return;
  sessionListeners.forEach((listener) => listener());
}

/** Signing out in one tab signs out in the rest. */
function subscribeSession(listener: () => void) {
  sessionListeners.add(listener);
  if (sessionListeners.size === 1) window.addEventListener("storage", onSessionStorage);

  return () => {
    sessionListeners.delete(listener);
    if (sessionListeners.size === 0) {
      window.removeEventListener("storage", onSessionStorage);
    }
  };
}

function getSession() {
  try {
    return window.localStorage.getItem(SESSION_KEY) === "1";
  } catch {
    return memorySession;
  }
}

/** What the statically exported HTML was built with, so hydration agrees. */
function getServerSession() {
  return false;
}

function writeSession(active: boolean) {
  memorySession = active;
  try {
    if (active) window.localStorage.setItem(SESSION_KEY, "1");
    else window.localStorage.removeItem(SESSION_KEY);
  } catch {
    /* in-memory only for this tab */
  }
  sessionListeners.forEach((listener) => listener());
}

/* -------------------------------------------------------------------------- */
/* Staff session                                                              */
/* -------------------------------------------------------------------------- */

type StoredStaffSession = StaffSession & { expiresAt: number };

let memoryStaffRaw: string | null = null;
const staffListeners = new Set<() => void>();

/* `useSyncExternalStore` compares snapshots by identity, so parsing on every
   read would hand React a new object each render and spin. The parse is cached
   against the exact string it came from. */
let staffCache: { raw: string | null; value: StaffSession | null } = { raw: null, value: null };

/** The timer that turns a live session into an expired one while the tab sits open. */
let staffExpiryTimer: ReturnType<typeof setTimeout> | undefined;
let staffTouchedAt = 0;

function readStaffRaw() {
  try {
    return window.sessionStorage.getItem(STAFF_SESSION_KEY);
  } catch {
    return memoryStaffRaw;
  }
}

function parseStaffSession(raw: string | null): StaffSession | null {
  if (!raw) return null;

  try {
    const stored = JSON.parse(raw) as Partial<StoredStaffSession>;
    /* Anything malformed, or past its window, is no session at all. It is left
       in storage rather than deleted here: this runs inside a snapshot read,
       which must not have effects that notify listeners back into itself. The
       expiry sweep and the next sign-in both clear it. */
    if (!stored?.name || typeof stored.expiresAt !== "number") return null;
    if (stored.expiresAt <= Date.now()) return null;

    return { name: stored.name, role: "ADMIN" };
  } catch {
    return null;
  }
}

function getStaffSession() {
  const raw = readStaffRaw();
  if (raw !== staffCache.raw) staffCache = { raw, value: parseStaffSession(raw) };
  /* Cached against the string, but the verdict is also time-dependent: a record
     that was live when it was parsed can be stale by this read. */
  else if (staffCache.value && parseStaffSession(raw) === null) staffCache = { raw, value: null };

  return staffCache.value;
}

/** Static HTML is built with nobody signed in, so hydration must agree. */
function getServerStaffSession(): StaffSession | null {
  return null;
}

function subscribeStaffSession(listener: () => void) {
  staffListeners.add(listener);
  return () => {
    staffListeners.delete(listener);
  };
}

function notifyStaff() {
  staffListeners.forEach((listener) => listener());
}

/** Wakes the subscribers at the moment the window closes, not a render later. */
function armStaffExpiry(expiresAt: number) {
  clearTimeout(staffExpiryTimer);
  staffExpiryTimer = setTimeout(() => {
    writeStaffSession(null);
  }, Math.max(0, expiresAt - Date.now()));
}

function writeStaffSession(session: StaffSession | null) {
  const raw = session
    ? JSON.stringify({ ...session, expiresAt: Date.now() + STAFF_SESSION_TTL_MS } satisfies StoredStaffSession)
    : null;

  memoryStaffRaw = raw;
  try {
    if (raw) window.sessionStorage.setItem(STAFF_SESSION_KEY, raw);
    else window.sessionStorage.removeItem(STAFF_SESSION_KEY);
  } catch {
    /* in-memory only for this tab */
  }

  if (session) {
    staffTouchedAt = Date.now();
    armStaffExpiry(Date.now() + STAFF_SESSION_TTL_MS);
  } else {
    clearTimeout(staffExpiryTimer);
    staffTouchedAt = 0;
  }

  notifyStaff();
}

/**
 * Pushes the expiry back out to a full window, because the operator is still here.
 *
 * The limit is fifteen minutes of *inactivity*, not fifteen minutes of work —
 * being signed out mid-refund because the clock ran down is the same
 * interruption this whole change exists to remove. Throttled, and it never
 * revives a session that has already lapsed.
 */
function touchStaffSession() {
  if (Date.now() - staffTouchedAt < STAFF_TOUCH_INTERVAL_MS) return;
  const current = getStaffSession();
  if (!current) return;

  writeStaffSession(current);
}

type AuthContextValue = {
  isAuthenticated: boolean;
  /**
   * False for the frame between first paint and the stored session being read.
   *
   * Anything that redirects a signed-out visitor has to wait for this. The
   * server renders `isAuthenticated: false` because it cannot know better, so
   * a guard that acts on the first render bounces a signed-in shopper to the
   * login page every single time they reload.
   */
  sessionReady: boolean;
  staffSession: StaffSession | null;
  requestLogin: (returnTo?: string) => void;
  signIn: () => void;
  signOut: () => void;
  signInStaff: () => void;
  signOutStaff: () => void;
  subscribeToSignOut: (listener: () => void) => () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const signOutListeners = useRef(new Set<() => void>());

  /* The stored flag IS the state — there is no component copy of it to keep in
     step. React reads the server snapshot while hydrating the static HTML and
     re-reads the real one immediately after, which is the whole reason
     `sessionReady` exists and why it flips in the same render as the true
     value rather than an effect later.

     The staff session is read the same way, out of `sessionStorage` and behind
     its own expiry — see the note on `STAFF_SESSION_KEY` for why it is that
     store and not `localStorage`. */
  const isAuthenticated = useSyncExternalStore(
    subscribeSession,
    getSession,
    getServerSession,
  );
  const staffSession = useSyncExternalStore(
    subscribeStaffSession,
    getStaffSession,
    getServerStaffSession,
  );
  const sessionReady = useHydrated();

  /* A restored session arrives with whatever was left of its window; the timer
     that ends it is armed here, since the sign-in that armed it last belonged
     to a page that has since been thrown away. Interaction pushes it back out. */
  useEffect(() => {
    if (!staffSession) return;

    armStaffExpiry(Date.now() + STAFF_SESSION_TTL_MS);
    touchStaffSession();

    const events = ["pointerdown", "keydown", "visibilitychange"] as const;
    events.forEach((event) => document.addEventListener(event, touchStaffSession, { passive: true }));

    return () => {
      events.forEach((event) => document.removeEventListener(event, touchStaffSession));
    };
  }, [staffSession]);

  // Gated actions send the shopper to the real /auth/login page and bring them
  // back afterwards. Read the location at call time so the provider does not
  // subscribe to every route change.
  const requestLogin = useCallback(
    (returnTo?: string) => {
      const target =
        returnTo ??
        (typeof window === "undefined"
          ? "/"
          : `${window.location.pathname}${window.location.search}`);
      router.push(`/auth/login?returnTo=${encodeURIComponent(target)}`);
    },
    [router],
  );

  const signIn = useCallback(() => writeSession(true), []);

  const signOut = useCallback(() => {
    signOutListeners.current.forEach((listener) => listener());
    writeSession(false);
  }, []);

  /* One role, so nothing to pass: signing in IS becoming the administrator. */
  const signInStaff = useCallback(() => {
    writeStaffSession({ name: "Aarav D.", role: "ADMIN" });
  }, []);

  const signOutStaff = useCallback(() => writeStaffSession(null), []);

  const subscribeToSignOut = useCallback((listener: () => void) => {
    signOutListeners.current.add(listener);
    return () => signOutListeners.current.delete(listener);
  }, []);

  const value = useMemo(
    () => ({
      isAuthenticated,
      sessionReady,
      staffSession,
      requestLogin,
      signIn,
      signOut,
      signInStaff,
      signOutStaff,
      subscribeToSignOut,
    }),
    [
      isAuthenticated,
      requestLogin,
      sessionReady,
      signIn,
      signInStaff,
      signOut,
      signOutStaff,
      staffSession,
      subscribeToSignOut,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
