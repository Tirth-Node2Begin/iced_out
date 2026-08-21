"use client";

import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { adminClient, customerClient, publicClient } from "@/api/clients";
import type { CustomerProfile } from "@/features/01-users/profile-context";

/**
 * Who is signed in — asked of the API, not of this browser.
 *
 * The session used to be a `"1"` in `localStorage`: a flag anyone could set,
 * standing for an account nobody had created. It is now an httpOnly cookie the
 * API issues and this code cannot read. What lives here is only the ANSWER to
 * `GET /auth/session`, refreshed on boot and after every sign-in or sign-out —
 * so the app can never believe a session the server would refuse.
 */
export type StaffSession = {
  name: string;
  role: string;
  permissions: string[];
  expiresAt: string | null;
};

export type Credentials = { email: string; password: string };
export type Registration = Credentials & { name: string };

/** The UI throttles activity pings to this, matching the server's own guard. */
const STAFF_TOUCH_INTERVAL_MS = 30 * 1000;

type AuthContextValue = {
  isAuthenticated: boolean;
  /** The signed-in shopper, or null. The one copy in the app. */
  customer: CustomerProfile | null;
  /**
   * False until `GET /auth/session` has answered.
   *
   * Anything that redirects a signed-out visitor has to wait for this: the
   * static HTML is built with nobody signed in, so a guard that acts on the
   * first render bounces a signed-in shopper on every reload.
   */
  sessionReady: boolean;
  staffSession: StaffSession | null;
  staffReady: boolean;
  requestLogin: (returnTo?: string) => void;
  signIn: (credentials: Credentials) => Promise<void>;
  register: (details: Registration) => Promise<void>;
  signOut: () => void;
  /** Re-reads `GET /auth/session` — for a screen that changed the profile. */
  refreshCustomer: () => Promise<void>;
  signInStaff: (credentials: Credentials) => Promise<void>;
  signOutStaff: () => void;
  subscribeToSignOut: (listener: () => void) => () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

/** A 401 is the expected answer for "is anyone signed in?", never a failure. */
function isUnauthenticated(error: unknown) {
  return typeof error === "object" && error !== null && "status" in error
    ? (error as { status?: number }).status === 401
    : false;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const signOutListeners = useRef(new Set<() => void>());

  const [customer, setCustomer] = useState<CustomerProfile | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [staffSession, setStaffSession] = useState<StaffSession | null>(null);
  const [staffReady, setStaffReady] = useState(false);

  const refreshCustomer = useCallback(async () => {
    try {
      const response = await customerClient.get<{ data: { customer: CustomerProfile } }>("/auth/session");
      setCustomer(response.data.data.customer);
    } catch (error) {
      if (!isUnauthenticated(error)) {
        /* A network failure is not proof of being signed out, but it is also
           not proof of being signed in — treated as signed out so nothing
           renders account data the server has not confirmed. */
        console.warn("Could not read the customer session.", error);
      }
      setCustomer(null);
    } finally {
      setSessionReady(true);
    }
  }, []);

  /* Asked once on boot. The cookie is httpOnly, so these requests ARE the only
     way to find out whether it is there.

     Both answers are awaited before anything is written, so no state is set
     while the effect body is still running — and a provider unmounted mid-flight
     (a route change during the round trip) writes nothing at all. */
  useEffect(() => {
    let live = true;

    /* The console session is only asked about inside the console. Probing it on
       every storefront page cost a request per load and logged a 401 in the
       browser console for a session no shopper was ever going to have. */
    const inConsole =
      typeof window !== "undefined" && window.location.pathname.startsWith("/admin");

    async function boot() {
      const [customerSession, staffSession] = await Promise.allSettled([
        customerClient.get<{ data: { customer: CustomerProfile } }>("/auth/session"),
        inConsole
          ? adminClient.get<{ data: StaffSession }>("/admin/auth/session")
          : Promise.reject(new Error("not in the console")),
      ]);

      if (!live) return;

      setCustomer(customerSession.status === "fulfilled" ? customerSession.value.data.data.customer : null);
      setStaffSession(staffSession.status === "fulfilled" ? staffSession.value.data.data : null);
      setSessionReady(true);
      setStaffReady(true);
    }

    void boot();

    return () => {
      live = false;
    };
  }, []);

  /* A console session expires on the SERVER after fifteen idle minutes. The
     ping slides that window while the operator is working; it is throttled, and
     it never revives a session the server has already ended. */
  useEffect(() => {
    if (!staffSession) return;

    let touchedAt = Date.now();

    function touch() {
      if (Date.now() - touchedAt < STAFF_TOUCH_INTERVAL_MS) return;
      touchedAt = Date.now();
      adminClient.post("/admin/auth/touch").catch(() => setStaffSession(null));
    }

    const events = ["pointerdown", "keydown", "visibilitychange"] as const;
    events.forEach((event) => document.addEventListener(event, touch, { passive: true }));

    return () => {
      events.forEach((event) => document.removeEventListener(event, touch));
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

  const signIn = useCallback(async (credentials: Credentials) => {
    const response = await publicClient.post<{ data: { customer: CustomerProfile } }>(
      "/auth/login",
      credentials,
      /* Credentials on a public client: the point of this call is the cookie
         that comes back with it. */
      { withCredentials: true },
    );
    setCustomer(response.data.data.customer);
    setSessionReady(true);
  }, []);

  const register = useCallback(async (details: Registration) => {
    const response = await publicClient.post<{ data: { customer: CustomerProfile } }>(
      "/auth/register",
      details,
      { withCredentials: true },
    );
    setCustomer(response.data.data.customer);
    setSessionReady(true);
  }, []);

  const signOut = useCallback(() => {
    signOutListeners.current.forEach((listener) => listener());
    /* Cleared here rather than after the response: signing out must look
       immediate even on a slow connection, and the cookie is being revoked
       server-side either way. */
    setCustomer(null);
    customerClient.post("/auth/logout").catch(() => undefined);
  }, []);

  const signInStaff = useCallback(async (credentials: Credentials) => {
    const response = await publicClient.post<{ data: StaffSession }>(
      "/admin/auth/login",
      credentials,
      { withCredentials: true },
    );
    setStaffSession(response.data.data);
    setStaffReady(true);
  }, []);

  const signOutStaff = useCallback(() => {
    setStaffSession(null);
    adminClient.post("/admin/auth/logout").catch(() => undefined);
  }, []);

  const subscribeToSignOut = useCallback((listener: () => void) => {
    signOutListeners.current.add(listener);
    return () => signOutListeners.current.delete(listener);
  }, []);

  const value = useMemo(
    () => ({
      isAuthenticated: customer !== null,
      customer,
      sessionReady,
      staffSession,
      staffReady,
      requestLogin,
      signIn,
      register,
      signOut,
      refreshCustomer,
      signInStaff,
      signOutStaff,
      subscribeToSignOut,
    }),
    [
      customer,
      refreshCustomer,
      register,
      requestLogin,
      sessionReady,
      signIn,
      signInStaff,
      signOut,
      signOutStaff,
      staffReady,
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
