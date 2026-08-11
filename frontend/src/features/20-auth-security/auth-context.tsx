"use client";

import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";

import { useHydrated } from "@/lib/use-hydrated";

export type StaffRole = "ADMIN" | "MANAGER" | "WAREHOUSE" | "SUPPORT";

export type StaffSession = {
  name: string;
  role: StaffRole;
  permissions: string[];
};

const rolePermissions: Record<StaffRole, string[]> = {
  ADMIN: ["*"],
  MANAGER: [
    "dashboard.view",
    "orders.view",
    "orders.manage",
    "customers.view_masked",
    "fulfilment.view",
    "shipping.view",
    "shipping.manage",
    "catalog.view",
    "catalog.edit",
    "inventory.view",
    "payments.view",
    "refunds.request",
    "refunds.approve",
    "returns.view",
    "returns.approve",
    "reviews.view",
    "reviews.moderate",
    "support.tickets.view",
    "marketing.view",
    "notifications.view",
    "cms.view",
    "cms.edit",
    "reports.operational.view",
  ],
  WAREHOUSE: [
    "dashboard.view",
    "orders.view",
    "fulfilment.view",
    "fulfilment.pick",
    "fulfilment.pack",
    "fulfilment.dispatch",
    "shipping.view",
    "inventory.view",
    "returns.view",
    "returns.qc",
  ],
  SUPPORT: [
    "dashboard.view",
    "orders.view",
    "customers.view_masked",
    "payments.view",
    "refunds.request",
    "returns.view",
    "support.tickets.view",
    "support.tickets.manage",
  ],
};

/**
 * Where the customer session is remembered between page loads.
 *
 * A flag, not a credential: there is no backend yet, so `isAuthenticated` is
 * the whole session. When there is a real one this becomes a token read from an
 * httpOnly cookie and this key goes away — nothing else in the app has to move.
 */
const SESSION_KEY = "iced-out.customer-session";

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
  signInStaff: (role?: StaffRole) => void;
  signOutStaff: () => void;
  can: (permission: string) => boolean;
  subscribeToSignOut: (listener: () => void) => () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [staffSession, setStaffSession] = useState<StaffSession | null>(null);
  const signOutListeners = useRef(new Set<() => void>());

  /* The stored flag IS the state — there is no component copy of it to keep in
     step. React reads the server snapshot while hydrating the static HTML and
     re-reads the real one immediately after, which is the whole reason
     `sessionReady` exists and why it flips in the same render as the true
     value rather than an effect later.

     The staff session is deliberately NOT persisted. A customer flag is a
     convenience; an operations session surviving in localStorage is a way into
     the admin console left lying on the machine. */
  const isAuthenticated = useSyncExternalStore(
    subscribeSession,
    getSession,
    getServerSession,
  );
  const sessionReady = useHydrated();

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

  const signInStaff = useCallback((role: StaffRole = "ADMIN") => {
    setStaffSession({
      name: role === "ADMIN" ? "Aarav D." : `${role[0]}${role.slice(1).toLowerCase()} preview`,
      role,
      permissions: rolePermissions[role],
    });
  }, []);

  const signOutStaff = useCallback(() => setStaffSession(null), []);

  const can = useCallback(
    (permission: string) =>
      Boolean(
        staffSession &&
          (staffSession.permissions.includes("*") || staffSession.permissions.includes(permission)),
      ),
    [staffSession],
  );

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
      can,
      subscribeToSignOut,
    }),
    [
      can,
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
