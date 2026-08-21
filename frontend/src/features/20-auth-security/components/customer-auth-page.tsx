"use client";

import { ArrowLeft, ArrowRight, Eye, EyeOff, Lock, Mail, MailCheck, User } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useRef, useState, type FormEvent, type ReactNode } from "react";
import "./nh-auth.css";

import { safeReturnPath } from "@/config/route-rules";
import { AuthSplitVisual } from "@/components/auth/auth-split-visual";
import { useAuth } from "@/features/20-auth-security/auth-context";
import { useHydrated } from "@/lib/use-hydrated";

export type CustomerAuthMode = "login" | "register" | "forgot" | "reset";

type Copy = { title: ReactNode; aside: ReactNode; action: string };

const content: Record<CustomerAuthMode, Copy> = {
  login: {
    title: <>SIGN <em>IN.</em></>,
    aside: <>New to Iced_out? <Link href="/auth/register">Create an account</Link></>,
    action: "Sign in",
  },
  register: {
    title: <>CREATE AN <em>ACCOUNT.</em></>,
    aside: <>Already have an account? <Link href="/auth/login">Sign in</Link></>,
    action: "Create account",
  },
  forgot: {
    title: <>RESET <em>PASSWORD.</em></>,
    aside: <>Remembered it? <Link href="/auth/login">Return to sign in</Link></>,
    action: "Send reset link",
  },
  reset: {
    title: <>NEW <em>PASSWORD.</em></>,
    aside: <>Finished here? <Link href="/auth/login">Return to sign in</Link></>,
    action: "Update password",
  },
};

function GoogleMark() {
  return (
    <svg width="17" height="17" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

export function CustomerAuthPage({ mode }: { mode: CustomerAuthMode }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { signIn, register } = useAuth();
  const [submitted, setSubmitted] = useState(false);
  const [revealed, setRevealed] = useState(false);
  /** What the server said went wrong, shown under the fields. */
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  /* The session is opened in the browser, so nothing here works before the
     script attaches — and a form with no action, submitted early, is not a
     no-op: it GETs this same page back with what was typed into it, password
     included, hanging off the URL. Closed until the handler exists. */
  const ready = useHydrated();
  const page = content[mode];
  const isCredentialMode = mode === "login" || mode === "register";
  const hasPassword = mode === "login" || mode === "register" || mode === "reset";

  /** What was typed, read off the form at the moment it is submitted. */
  function credentials() {
    const data = new FormData(formRef.current ?? undefined);
    return {
      name: String(data.get("name") ?? "").trim(),
      email: String(data.get("email") ?? "").trim(),
      password: String(data.get("password") ?? ""),
    };
  }

  /**
   * Opens the session against the API.
   *
   * The account is created and the session issued by the server — signing in
   * here is what puts a shopper in `/admin/customers`, because both screens now
   * read the same register rather than two copies of it.
   */
  async function enterSession() {
    const typed = credentials();
    setPending(true);
    setError("");

    try {
      if (mode === "register") {
        await register({ name: typed.name, email: typed.email, password: typed.password });
      } else {
        await signIn({ email: typed.email, password: typed.password });
      }

      router.replace(safeReturnPath(searchParams.get("returnTo"), "/account/profile"));
    } catch (failure) {
      /* The normaliser has already turned this into a sentence written to be
         shown — a wrong password, a taken email, a lockout — so it is shown
         rather than reworded into something vaguer. */
      setError(
        failure instanceof Error ? failure.message : "That did not work. Please try again.",
      );
      setPending(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isCredentialMode) {
      void enterSession();
      return;
    }
    setSubmitted(true);
  }

  /* The same line serves both branches: under the fields while the form is up,
     under the confirmation panel once a recovery link has been sent. */
  const aside = <p className="iox-auth__aside">{page.aside}</p>;

  return (
    <main className={`iox-auth${mode === "register" ? " is-dense" : ""}`}>
      <section className="iox-auth__panel">
        <header className="iox-auth__topbar">
          <Link className="iox-auth__brand" href="/" aria-label="Iced out home">ICED<span>_</span>OUT</Link>
        </header>

        <div className="iox-auth__body">
          <div className="iox-auth__head">
            <Link className="iox-auth__back" href="/">
              <ArrowLeft size={13} aria-hidden="true" />
              <span>Back to store</span>
            </Link>
            <h1 className="iox-auth__title">{page.title}</h1>
          </div>

          {submitted ? (
            <>
              <div className="iox-success" role="status">
                <MailCheck size={18} aria-hidden="true" />
                <p>Check your inbox. If the account is eligible, recovery instructions are on their way.</p>
              </div>
              {aside}
            </>
          ) : (
            /* Every control below carries `suppressHydrationWarning`. Password
               managers and form fillers stamp their own bookkeeping attributes
               (`fdprocessedid` and friends) onto inputs and buttons while the
               HTML is still parsing — before React hydrates — and React reads
               that as the server having rendered something the client did not.
               The flag is one level deep, so it goes on each control rather
               than the form. Nothing here renders differently on the two
               sides; only a visitor's extension does. */
            <form className="iox-auth__form" onSubmit={submit} ref={formRef}>
              {mode === "register" && (
                <div className="iox-field">
                  <div className="iox-field__top">
                    <label htmlFor="auth-name">Full name</label>
                  </div>
                  <div className="iox-field__control">
                    <User size={16} aria-hidden="true" />
                    <input id="auth-name" name="name" placeholder="Enter your full name" autoComplete="name" required suppressHydrationWarning />
                  </div>
                </div>
              )}

              <div className="iox-field">
                <div className="iox-field__top">
                  <label htmlFor="auth-email">Email address</label>
                </div>
                <div className="iox-field__control">
                  <Mail size={16} aria-hidden="true" />
                  <input id="auth-email" name="email" type="email" placeholder="Enter your email" autoComplete="email" required suppressHydrationWarning />
                </div>
              </div>

              {hasPassword && (
                <div className="iox-field iox-field--reveal">
                  {/* The recovery link rides the label baseline rather than a
                      row of its own — one less band in a fixed-height column. */}
                  <div className="iox-field__top">
                    <label htmlFor="auth-password">{mode === "reset" ? "New password" : "Password"}</label>
                    {mode === "login" && (
                      <Link className="iox-field__aid" href="/auth/forgot-password">Forgot password?</Link>
                    )}
                  </div>
                  <div className="iox-field__control">
                    <Lock size={16} aria-hidden="true" />
                    <input
                      id="auth-password"
                      name="password"
                      type={revealed ? "text" : "password"}
                      placeholder={mode === "login" ? "Enter your password" : "Choose a password"}
                      autoComplete={mode === "login" ? "current-password" : "new-password"}
                      minLength={6}
                      required
                      suppressHydrationWarning
                    />
                    <button
                      className="iox-field__reveal"
                      type="button"
                      onClick={() => setRevealed((on) => !on)}
                      aria-label={revealed ? "Hide password" : "Show password"}
                      aria-pressed={revealed}
                      suppressHydrationWarning
                    >
                      {revealed ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
                    </button>
                  </div>
                </div>
              )}

              {error ? (
                <p className="iox-auth__error" role="alert">
                  {error}
                </p>
              ) : null}

              {aside}

              {/* Held closed until the handler exists — see the note on `ready`. */}
              <button
                className="iox-btn iox-btn--primary"
                disabled={!ready || pending}
                type="submit"
                suppressHydrationWarning
              >
                <span>{pending ? "One moment…" : page.action}</span>
                <ArrowRight size={16} aria-hidden="true" />
              </button>

              {isCredentialMode && (
                <>
                  <div className="iox-rule"><span>or</span></div>
                  {/* No provider behind it yet, so it says so rather than
                      quietly signing somebody in as a fixture account. */}
                  <button
                    className="iox-btn iox-btn--ghost"
                    disabled
                    title="Google sign-in is not connected yet."
                    type="button"
                    suppressHydrationWarning
                  >
                    <GoogleMark />
                    <span>Continue with Google</span>
                  </button>
                </>
              )}

              {mode === "register" && (
                <p className="iox-legal">
                  By continuing you agree to our <Link href="/pages/terms">Terms</Link> and <Link href="/pages/privacy">Privacy Policy</Link>.
                </p>
              )}
            </form>
          )}
        </div>

        <footer className="iox-auth__foot">
          <span><i aria-hidden="true" />Frontend preview</span>
          <span>No credential leaves this browser</span>
        </footer>
      </section>

      <AuthSplitVisual trust={mode === "register"} />
    </main>
  );
}
