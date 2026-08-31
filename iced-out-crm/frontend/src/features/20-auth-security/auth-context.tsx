"use client";

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

import { adminClient, publicClient } from "@/api/clients";

/**
 * Who is signed in — asked of the API, not of this browser.
 *
 * STAFF ONLY. The storefront's copy of this file carries both audiences because
 * that deployment serves both; this one has no `/auth/*` and no `/me` behind it
 * at all, so a customer branch here would be dead code that fires a request the
 * CRM's backend answers with a 404 on every boot.
 *
 * The session is an httpOnly cookie the API issues and this code cannot read.
 * What lives here is only the ANSWER to `GET /admin/auth/session`, refreshed on
 * boot and after every sign-in or sign-out — so the app can never believe a
 * session the server would refuse.
 */
export type StaffSession = {
  name: string;
  role: string;
  permissions: string[];
  expiresAt: string | null;
};

export type Credentials = { email: string; password: string };

/** The UI throttles activity pings to this, matching the server's own guard. */
const STAFF_TOUCH_INTERVAL_MS = 30 * 1000;

type AuthContextValue = {
  staffSession: StaffSession | null;
  /**
   * False until `GET /admin/auth/session` has answered.
   *
   * Anything that redirects a signed-out operator has to wait for this: the
   * static HTML is built with nobody signed in, so a guard that acts on the
   * first render bounces a signed-in operator on every reload.
   */
  staffReady: boolean;
  /** True once there is a session. The rail and every guard read this. */
  isAuthenticated: boolean;
  can: (permission: string) => boolean;
  signInStaff: (credentials: Credentials) => Promise<void>;
  signOutStaff: () => void;
  refreshStaff: () => Promise<void>;
  subscribeToSignOut: (listener: () => void) => () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [staffSession, setStaffSession] = useState<StaffSession | null>(null);
  const [staffReady, setStaffReady] = useState(false);
  const signOutListeners = useRef(new Set<() => void>());

  const refreshStaff = useCallback(async () => {
    try {
      const response = await adminClient.get<{ data: StaffSession }>("/admin/auth/session");
      setStaffSession(response.data.data);
    } catch {
      /* A 401 is the expected answer to "is anyone signed in?", never a
         failure — and any other error means we cannot prove there is a session,
         which for a guard is the same thing. */
      setStaffSession(null);
    } finally {
      setStaffReady(true);
    }
  }, []);

  useEffect(() => {
    let live = true;

    void (async () => {
      try {
        const response = await adminClient.get<{ data: StaffSession }>("/admin/auth/session");
        if (live) setStaffSession(response.data.data);
      } catch {
        if (live) setStaffSession(null);
      } finally {
        if (live) setStaffReady(true);
      }
    })();

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

  const signInStaff = useCallback(async (credentials: Credentials) => {
    const response = await publicClient.post<{ data: StaffSession }>(
      "/admin/auth/login",
      credentials,
      /* Credentials on a public client: the point of this call is the cookie
         that comes back with it. */
      { withCredentials: true },
    );
    setStaffSession(response.data.data);
    setStaffReady(true);
  }, []);

  const signOutStaff = useCallback(() => {
    /* Listeners first, so every store drops what it holds BEFORE the session
       goes — a register still on screen after sign-out is one operator's data
       showing to whoever signs in next on the same machine. */
    signOutListeners.current.forEach((listener) => listener());
    /* Cleared here rather than after the response: signing out must look
       immediate even on a slow connection, and the cookie is being revoked
       server-side either way. */
    setStaffSession(null);
    adminClient.post("/admin/auth/logout").catch(() => undefined);
  }, []);

  const subscribeToSignOut = useCallback((listener: () => void) => {
    const listeners = signOutListeners.current;
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  /**
   * The wildcard is real: ADMIN holds `*` rather than an enumerated list, and
   * the server's own Principal treats it the same way.
   */
  const can = useCallback(
    (permission: string) => {
      const held = staffSession?.permissions ?? [];
      return held.includes("*") || held.includes(permission);
    },
    [staffSession],
  );

  const value = useMemo(
    () => ({
      staffSession,
      staffReady,
      isAuthenticated: staffSession !== null,
      can,
      signInStaff,
      signOutStaff,
      refreshStaff,
      subscribeToSignOut,
    }),
    [can, refreshStaff, signInStaff, signOutStaff, staffReady, staffSession, subscribeToSignOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
