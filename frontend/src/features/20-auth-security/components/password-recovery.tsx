"use client";

import { ArrowRight, Check, Lock, Mail, MailCheck, RotateCw } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState, type FormEvent } from "react";

import { publicClient } from "@/api/clients";
import { AppError } from "@/api/error-normalizer";
import { useHydrated } from "@/lib/use-hydrated";

import { OtpInput } from "./otp-input";

/**
 * Forgotten-password recovery: address, code, new password.
 *
 * WHY A CODE AND NOT A LINK. A reset link means the email carries a clickable
 * address to a page that will accept a new password, which is the shape of
 * every credential-phishing message ever sent. A code is typed back into the
 * tab the shopper opened themselves, so no email can put them on the wrong
 * site — and it survives the trip a link does not, because most people read
 * mail on a phone and shop on a laptop.
 *
 * THREE STEPS, NOT ONE FORM. The code is checked on its own (`/password/verify`
 * spends nothing) before a password is asked for. Asking for both at once means
 * a mistyped digit throws away a password somebody has just chosen, and a
 * password manager offering to save one that was never accepted.
 *
 * THIS SCREEN DOES SAY WHEN AN ADDRESS HAS NO ACCOUNT, and the console's
 * recovery screen does not. That is deliberate on both sides: `/auth/register`
 * already answers "an account with that email already exists", so silence here
 * would protect nothing and would cost anyone who mistyped a ten-minute wait
 * for mail that was never coming. The CRM has no public signup, so there the
 * same answer would be the only way to learn which addresses are staff. See
 * AuthController::forgotPassword() on both backends.
 */
type Step = "email" | "code" | "password" | "done";

/** Matches the server's per-account resend cooldown. */
const RESEND_SECONDS = 60;

const MIN_PASSWORD = 6;

/** What the API calls a wrong or expired code (backend ValidationException). */
const OTP_REJECTED = "ICE-AUTH-OTP-422";

export function PasswordRecovery({ startAt = "email" }: { startAt?: Step }) {
  const searchParams = useSearchParams();
  const ready = useHydrated();

  /* `/auth/reset-password?email=…` is the "I already have a code" entrance, so
     it can open on the code step. Without an address there is nothing to check
     a code against, and it falls back to asking for one. */
  const prefilled = searchParams.get("email")?.trim() ?? "";
  const [step, setStep] = useState<Step>(startAt === "code" && prefilled !== "" ? "code" : "email");

  const [email, setEmail] = useState(prefilled);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");

  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  /** Seconds until "Send it again" becomes pressable. */
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown((left) => left - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  function say(failure: unknown) {
    /* The normaliser has already turned this into a sentence written to be
       shown — a wrong code, a lockout, a mail server that would not take it —
       so it is shown rather than reworded into something vaguer. */
    setError(failure instanceof Error ? failure.message : "That did not work. Please try again.");
  }

  /**
   * Step 1 → 2.
   *
   * Advances only on a 202. An address with no account comes back 422 on field
   * `email`, which throws before `setStep` and leaves the shopper on this step
   * with the reason under the field — which is the whole point of asking here
   * rather than sending them to wait at an empty inbox.
   */
  async function sendCode(address: string) {
    setPending(true);
    setError("");

    try {
      await publicClient.post("/auth/password/forgot", { email: address });
      setEmail(address);
      setCode("");
      setCooldown(RESEND_SECONDS);
      setStep("code");
    } catch (failure) {
      say(failure);
    } finally {
      setPending(false);
    }
  }

  /** Step 2 → 3. Checks the code without spending it. */
  const checkCode = useCallback(
    async (typed: string) => {
      setPending(true);
      setError("");

      try {
        await publicClient.post("/auth/password/verify", { email, code: typed });
        setStep("password");
      } catch (failure) {
        say(failure);
        setCode("");
      } finally {
        setPending(false);
      }
    },
    [email],
  );

  /** Step 3 → done. Spends the code and sets the password. */
  async function commit() {
    if (password !== confirmation) {
      setError("Those two passwords are not the same.");
      return;
    }

    setPending(true);
    setError("");

    try {
      await publicClient.post("/auth/password/reset", { email, code, password });
      setStep("done");
    } catch (failure) {
      say(failure);
      /* A spent or expired code cannot be made good by pressing the button
         again, so the flow goes back to where a new one can be asked for.
         Matched on the API's error code rather than on words in the sentence —
         the sentence is copy, and copy gets rewritten. */
      if (failure instanceof AppError && failure.code === OTP_REJECTED) {
        setCode("");
        setStep("code");
      }
    } finally {
      setPending(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    if (step === "email") void sendCode(email.trim());
    else if (step === "code") void checkCode(code);
    else if (step === "password") void commit();
  }

  const title = {
    email: (
      <>
        RESET <em>PASSWORD.</em>
      </>
    ),
    code: (
      <>
        CHECK YOUR <em>INBOX.</em>
      </>
    ),
    password: (
      <>
        NEW <em>PASSWORD.</em>
      </>
    ),
    done: (
      <>
        ALL <em>SET.</em>
      </>
    ),
  }[step];

  const action = {
    email: "Send code",
    code: "Verify code",
    password: "Update password",
    done: "",
  }[step];

  return (
    <>
      <div className="iox-auth__head">
        <h1 className="iox-auth__title">{title}</h1>
      </div>

      {step === "done" ? (
        <>
          <div className="iox-success" role="status">
            <Check size={18} aria-hidden="true" />
            <p>
              Your password has been changed, and everywhere that was signed in with the old one has
              been signed out. Sign in with the new password to continue.
            </p>
          </div>
          <p className="iox-auth__aside">
            <Link href="/auth/login">Return to sign in</Link>
          </p>
        </>
      ) : (
        <form className="iox-auth__form" onSubmit={submit}>
          {step === "email" && (
            <>
              <p className="iox-auth__lede">
                Tell us the address on the account and we will send a six-digit code to it.
              </p>
              <div className="iox-field">
                <div className="iox-field__top">
                  <label htmlFor="recover-email">Email address</label>
                </div>
                <div className="iox-field__control">
                  <Mail size={16} aria-hidden="true" />
                  <input
                    autoComplete="email"
                    autoFocus
                    id="recover-email"
                    name="email"
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="Enter your email"
                    required
                    suppressHydrationWarning
                    type="email"
                    value={email}
                  />
                </div>
              </div>
            </>
          )}

          {step === "code" && (
            <>
              <div className="iox-sent" role="status">
                <MailCheck size={16} aria-hidden="true" />
                <p>
                  A six-digit code is on its way to <b>{email}</b>. It is good for ten minutes.
                </p>
              </div>

              <div className="iox-field">
                <div className="iox-field__top">
                  <label htmlFor="recover-code">Verification code</label>
                  {/* Changing the address is a step back, not a restart — the
                      code already sent stays valid for its ten minutes. */}
                  <button
                    className="iox-field__aid"
                    onClick={() => {
                      setStep("email");
                      setError("");
                    }}
                    suppressHydrationWarning
                    type="button"
                  >
                    Use a different email
                  </button>
                </div>
                <OtpInput
                  disabled={pending}
                  invalid={error !== ""}
                  onChange={(next) => {
                    setCode(next);
                    if (error) setError("");
                  }}
                  /* Six digits in, six digits checked — nobody should have to
                     find a button after typing the last one. */
                  onComplete={(complete) => void checkCode(complete)}
                  value={code}
                />
              </div>

              <button
                className="iox-resend"
                disabled={!ready || pending || cooldown > 0}
                onClick={() => void sendCode(email)}
                suppressHydrationWarning
                type="button"
              >
                <RotateCw size={13} aria-hidden="true" />
                {cooldown > 0 ? `Send it again in ${cooldown}s` : "Send it again"}
              </button>
            </>
          )}

          {step === "password" && (
            <>
              <div className="iox-sent" role="status">
                <Check size={16} aria-hidden="true" />
                <p>Code accepted. Choose the password you will use from now on.</p>
              </div>

              <div className="iox-field">
                <div className="iox-field__top">
                  <label htmlFor="recover-password">New password</label>
                </div>
                <div className="iox-field__control">
                  <Lock size={16} aria-hidden="true" />
                  <input
                    autoComplete="new-password"
                    autoFocus
                    id="recover-password"
                    minLength={MIN_PASSWORD}
                    name="password"
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder={`At least ${MIN_PASSWORD} characters`}
                    required
                    suppressHydrationWarning
                    type="password"
                    value={password}
                  />
                </div>
              </div>

              <div className="iox-field">
                <div className="iox-field__top">
                  <label htmlFor="recover-confirm">Confirm new password</label>
                </div>
                <div className="iox-field__control">
                  <Lock size={16} aria-hidden="true" />
                  <input
                    autoComplete="new-password"
                    id="recover-confirm"
                    minLength={MIN_PASSWORD}
                    name="password_confirmation"
                    onChange={(event) => setConfirmation(event.target.value)}
                    placeholder="Type it once more"
                    required
                    suppressHydrationWarning
                    type="password"
                    value={confirmation}
                  />
                </div>
              </div>
            </>
          )}

          {error ? (
            <p className="iox-auth__error" role="alert">
              {error}
            </p>
          ) : null}

          <p className="iox-auth__aside">
            Remembered it? <Link href="/auth/login">Return to sign in</Link>
          </p>

          {/* Held closed until the handler exists: a form with no action,
              submitted early, GETs this page back with what was typed into it
              hanging off the URL. */}
          <button
            className="iox-btn iox-btn--primary"
            disabled={!ready || pending || (step === "code" && code.length < 6)}
            suppressHydrationWarning
            type="submit"
          >
            <span>{pending ? "One moment…" : action}</span>
            <ArrowRight size={16} aria-hidden="true" />
          </button>
        </form>
      )}
    </>
  );
}
