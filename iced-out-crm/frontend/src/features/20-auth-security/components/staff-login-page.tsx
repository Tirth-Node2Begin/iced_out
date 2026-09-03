"use client";

import {
  ArrowRight,
  Eye,
  EyeOff,
  FileClock,
  ShieldAlert,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "motion/react";
import { useState, type FormEvent, type KeyboardEvent } from "react";

import "./admin-login.css";

import { safeReturnPath } from "@/config/route-rules";
import { useAuth } from "@/features/20-auth-security/auth-context";
import { AdminStage, T, useRise } from "@/features/20-auth-security/components/admin-stage";
import { useHydrated } from "@/lib/use-hydrated";

/** The headline, one line per mask. */
const TITLE = ["The shop,", "and everyone", "in it."];

/**
 * What is behind the door.
 *
 * Three rows, no figures. Somebody looking at the sign-in page of a tool they
 * do not know wants to be told what it opens — and an invented uptime
 * percentage or a module count nobody counted is exactly the decoration a
 * console should not ship.
 */
const MANIFEST = [
  { key: "01", value: "Leads, contacts, deals and companies" },
  { key: "02", value: "Orders, payments, returns and refunds" },
  { key: "03", value: "Catalogue, stock, transfers and production" },
];

/**
 * The operations console door.
 *
 * The whole viewport, split: `AdminStage` is the brand's own campaign frame on
 * the left with the type set on it — see that file for why there is a
 * photograph there — and this owns the work on the right, which asks two
 * questions.
 *
 * There is exactly one kind of account behind this, so the form asks for two
 * things and offers one way forward. The way BACK, for somebody who cannot
 * answer the second question, is `/forgot-password`.
 */
export function StaffLoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { signInStaff } = useAuth();
  const rise = useRise();

  const [revealed, setRevealed] = useState(false);
  /** Whether caps lock is on — the cheapest support ticket a login can avoid. */
  const [caps, setCaps] = useState(false);

  /**
   * The session this form opens is a client one, so the form cannot work until
   * the script behind it has attached — and until then it is not inert, it is
   * *worse* than inert: a plain `<form>` with no action, pressed early, submits
   * itself as a GET and reloads this same page with `?email=…&password=…` on the
   * end of it. The password lands in the address bar and in history, and the
   * operator is looking at the login screen again with no idea why.
   *
   * The button is held closed until the handler exists. It is the one control
   * here that must not be pressable a moment too soon.
   */
  const ready = useHydrated();

  /** What the server said went wrong, shown under the fields. */
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  /* `getModifierState` is only defined on a real keyboard event, and a field
     filled by a password manager never fires one — so this reports what it
     knows and never guesses. */
  function readCaps(event: KeyboardEvent<HTMLInputElement>) {
    setCaps(event.getModifierState?.("CapsLock") ?? false);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const data = new FormData(event.currentTarget);
    setPending(true);
    setError("");

    try {
      await signInStaff({
        email: String(data.get("email") ?? "").trim(),
        password: String(data.get("password") ?? ""),
      });
      router.replace(safeReturnPath(searchParams.get("returnTo"), "/"));
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : "That did not work. Please try again.",
      );
      setPending(false);
    }
  }

  return (
    <main className="adl">
      {/* ---- the frame ---- */}
      <AdminStage
        kicker="Operations console"
        lede={
          <>
            Leads, contacts, deals and the work waiting on them — beside the orders,
            stock, payments and returns they turn into. One database, one sign-in.
          </>
        }
        manifest={MANIFEST}
        title={TITLE}
      />

      {/* ---- the way in ---- */}
      <section className="adl__panel">
        <form className="adl__form" onSubmit={submit}>
          <motion.p className="adl__badge" {...rise(T.badge)}>
            <ShieldCheck aria-hidden="true" size={11} strokeWidth={2.2} />
            Restricted access
          </motion.p>

          <motion.div {...rise(T.heading)}>
            <h2 className="adl__heading">Sign in</h2>
          </motion.div>

          <motion.p className="adl__sub" {...rise(T.heading + 0.06)}>
            Staff accounts only. Customer sign-in lives on the shop.
          </motion.p>

          {/* Every control below carries `suppressHydrationWarning`. Password
              managers and form fillers stamp their own bookkeeping attributes
              (`fdprocessedid` and friends) onto inputs and buttons while the
              HTML is still parsing — before React hydrates — and React reads
              that as the server having rendered something the client did not.
              The flag is one level deep, so it goes on each control rather
              than the form. Nothing here renders differently on the two
              sides; only an operator's extension does. */}
          <motion.div className="adl__fields" {...rise(T.fields)}>
            {/* The label is inside the well and always visible, so it is a
                label rather than a placeholder that disappears the moment
                someone starts typing into the field it was describing. */}
            <label className="adl__field" htmlFor="admin-email">
              <span>Work email</span>
              <input
                autoComplete="username"
                id="admin-email"
                name="email"
                placeholder="you@iced-out.example"
                required
                suppressHydrationWarning
                type="email"
              />
            </label>

            <label className="adl__field adl__field--reveal" htmlFor="admin-password">
              <span>Password</span>
              <input
                autoComplete="current-password"
                id="admin-password"
                minLength={6}
                name="password"
                onKeyDown={readCaps}
                onKeyUp={readCaps}
                placeholder="Enter your password"
                required
                suppressHydrationWarning
                type={revealed ? "text" : "password"}
              />
              <button
                aria-label={revealed ? "Hide password" : "Show password"}
                aria-pressed={revealed}
                className="adl__reveal"
                onClick={() => setRevealed((on) => !on)}
                suppressHydrationWarning
                tabIndex={-1}
                type="button"
              >
                {revealed ? (
                  <Eye aria-hidden="true" size={15} strokeWidth={1.6} />
                ) : (
                  <EyeOff aria-hidden="true" size={15} strokeWidth={1.6} />
                )}
              </button>
            </label>
          </motion.div>

          {caps ? (
            <p className="adl__hint">
              <TriangleAlert aria-hidden="true" size={13} strokeWidth={1.9} />
              Caps lock is on
            </p>
          ) : null}

          {error ? (
            <p className="adl__error" role="alert">
              <ShieldAlert aria-hidden="true" size={14} strokeWidth={1.9} />
              {error}
            </p>
          ) : null}

          <motion.button
            className="adl__submit"
            disabled={!ready || pending}
            suppressHydrationWarning
            type="submit"
            {...rise(T.submit)}
          >
            {pending ? (
              <>
                <span aria-hidden="true" className="adl__spinner" />
                Checking&hellip;
              </>
            ) : (
              <>
                Enter console
                <ArrowRight aria-hidden="true" size={15} strokeWidth={2} />
              </>
            )}
          </motion.button>

          <motion.div className="adl__foot" {...rise(T.foot)}>
            {/* The one line that changes how someone behaves on the other side
                of the door: whatever they do next has their name on it. */}
            <span className="adl__audit">
              <FileClock aria-hidden="true" size={12} strokeWidth={1.7} />
              Every action is attributed and logged
            </span>

            <Link className="adl__help" href="/forgot-password">
              Trouble signing in?
            </Link>
          </motion.div>
        </form>
      </section>
    </main>
  );
}
