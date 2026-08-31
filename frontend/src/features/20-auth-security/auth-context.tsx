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

import { customerClient, publicClient } from "@/api/clients";
import type { CustomerProfile } from "@/features/01-users/profile-context";

/**
 * Who is signed in — asked of the API, not of this browser.
 *
 * CUSTOMER ONLY. This provider used to carry both audiences, because this app
 * served the operations console as well as the shop. The console is the CRM
 * now: its own origin, its own staff cookie, and its own copy of this file. The
 * staff half is gone rather than dormant — `/admin/auth/*` is a 404 on this
 * deployment, so keeping it would have been three requests that can only fail.
 *
 * The session used to be a `"1"` in `localStorage`: a flag anyone could set,
 * standing for an account nobody had created. It is now an httpOnly cookie the
 * API issues and this code cannot read. What lives here is only the ANSWER to
 * `GET /auth/session`, refreshed on boot and after every sign-in or sign-out —
 * so the app can never believe a session the server would refuse.
 */
export type Credentials = { email: string; password: string };
export type Registration = Credentials & { name: string };

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
  requestLogin: (returnTo?: string) => void;
  signIn: (credentials: Credentials) => Promise<void>;
  register: (details: Registration) => Promise<void>;
  signOut: () => void;
  /** Re-reads `GET /auth/session` — for a screen that changed the profile. */
  refreshCustomer: () => Promise<void>;
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

  /* Asked once on boot. The cookie is httpOnly, so this request IS the only way
     to find out whether it is there.

     The answer is awaited before anything is written, so no state is set while
     the effect body is still running — and a provider unmounted mid-flight (a
     route change during the round trip) writes nothing at all.

     It used to ask about a STAFF session here too. That surface moved to the
     CRM, which has its own origin, its own cookie and its own copy of this
     provider — so there is nothing on this deployment for a second probe to
     find, and `/admin/auth/session` is a 404 here now. */
  useEffect(() => {
    let live = true;

    async function boot() {
      try {
        const response = await customerClient.get<{ data: { customer: CustomerProfile } }>(
          "/auth/session",
        );
        if (live) setCustomer(response.data.data.customer);
      } catch {
        /* A 401 is the expected answer to "is anyone signed in?", never a
           failure — and any other error means we cannot prove there is a
           session, which for a guard is the same thing. */
        if (live) setCustomer(null);
      } finally {
        if (live) setSessionReady(true);
      }
    }

    void boot();

    return () => {
      live = false;
    };
  }, []);

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

  const subscribeToSignOut = useCallback((listener: () => void) => {
    signOutListeners.current.add(listener);
    return () => signOutListeners.current.delete(listener);
  }, []);

  const value = useMemo(
    () => ({
      isAuthenticated: customer !== null,
      customer,
      sessionReady,
      requestLogin,
      signIn,
      register,
      signOut,
      refreshCustomer,
      subscribeToSignOut,
    }),
    [
      customer,
      refreshCustomer,
      register,
      requestLogin,
      sessionReady,
      signIn,
      signOut,
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
