"use client";

import { ArrowRight, Command, Eye, EyeOff, FileClock, ShieldCheck } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";

import "./admin-login.css";

import { safeReturnPath } from "@/config/route-rules";
import { useAuth } from "@/features/20-auth-security/auth-context";
import { useHydrated } from "@/lib/use-hydrated";

/**
 * The operations console door.
 *
 * One wide card, split: the house on the left, the work on the right. It is
 * built from the console's own parts — the rail's brand lockup, the page
 * head's badge pill and 112° wash, the topbar's environment chip and presence
 * dot — so an operator recognises where they are before reading a word, and a
 * stranger can tell this is not a shop.
 *
 * There is exactly one kind of account behind it, so the form asks for two
 * things and offers one way forward. The role select went with the permission
 * system it drove; "forgot password", "create an account", "customer login"
 * and "back to store" went because a door with one thing behind it should not
 * have four ways to walk away from it.
 */
export function StaffLoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { signInStaff } = useAuth();
  const [revealed, setRevealed] = useState(false);

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
      <div className="adl__card">
        {/* ---- identity ---- */}
        <div className="adl__aside">
          <div className="adl__brand">
            <span aria-hidden="true" className="adl__brandmark">
              <Command size={18} strokeWidth={2} />
            </span>
            <span>
              <b>ICED_OUT</b>
              <small>CRM</small>
            </span>
          </div>

          <div className="adl__pitch">
            <h1 className="adl__title">
              The shop, <em>and everyone in it.</em>
            </h1>
            <p className="adl__lede">
              Leads, contacts, deals and the work waiting on them — beside the orders,
              stock, payments and returns they turn into. One database, one sign-in.
            </p>
          </div>

          <span className="adl__env">
            <i aria-hidden="true" className="adl__dot" />
            Preview · India / Primary
          </span>
        </div>

        {/* ---- the way in ---- */}
        <form className="adl__main" onSubmit={submit}>
          <p className="adl__badge">
            <ShieldCheck aria-hidden="true" size={11} strokeWidth={2.2} />
            Restricted access
          </p>

          <h2 className="adl__heading">Sign in</h2>

          {/* Every control below carries `suppressHydrationWarning`. Password
              managers and form fillers stamp their own bookkeeping attributes
              (`fdprocessedid` and friends) onto inputs and buttons while the
              HTML is still parsing — before React hydrates — and React reads
              that as the server having rendered something the client did not.
              The flag is one level deep, so it goes on each control rather
              than the form. Nothing here renders differently on the two
              sides; only an operator's extension does. */}
          <div className="adl__fields">
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
                type="button"
              >
                {revealed ? (
                  <Eye aria-hidden="true" size={15} strokeWidth={1.6} />
                ) : (
                  <EyeOff aria-hidden="true" size={15} strokeWidth={1.6} />
                )}
              </button>
            </label>
          </div>

          {error ? (
            <p className="adl__error" role="alert">
              {error}
            </p>
          ) : null}

          <button className="adl__submit" disabled={!ready || pending} suppressHydrationWarning type="submit">
            {pending ? "Checking…" : "Enter console"}
            <ArrowRight aria-hidden="true" size={15} strokeWidth={2} />
          </button>

          {/* The one line that changes how someone behaves on the other side
              of the door: whatever they do next has their name on it. */}
          <p className="adl__audit">
            <FileClock aria-hidden="true" size={12} strokeWidth={1.7} />
            Every action in this console is attributed and logged
          </p>
        </form>
      </div>
    </main>
  );
}
