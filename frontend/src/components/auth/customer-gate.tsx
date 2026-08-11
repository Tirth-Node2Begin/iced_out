"use client";

import { LockKeyhole } from "lucide-react";
import { useEffect, type ReactNode } from "react";

import { PageFrame } from "@/components/layout/page-frame";
import { useAuth } from "@/features/20-auth-security/auth-context";

/**
 * The interstitial a guarded route shows for the frame or two before the
 * redirect to sign-in lands. It is on the same frame as the screen it is
 * standing in for, so the hand-off does not flash a differently-shaped page.
 */
export function CustomerGate({ children }: { children: ReactNode }) {
  const { isAuthenticated, requestLogin } = useAuth();

  useEffect(() => {
    if (!isAuthenticated) requestLogin();
  }, [isAuthenticated, requestLogin]);

  if (!isAuthenticated) {
    return (
      <PageFrame
        eyebrow="Session"
        title={
          <>
            Sign in <em>required</em>
          </>
        }
      >
        <div aria-live="polite" className="io-empty">
          <div className="io-empty__copy">
            <span className="io-empty__glyph">
              <LockKeyhole aria-hidden size={19} strokeWidth={1.5} />
            </span>
            <h2>Taking you to sign in.</h2>
            <p>The bag, checkout, payment and your order history all need a customer session.</p>
          </div>
        </div>
      </PageFrame>
    );
  }

  return children;
}
