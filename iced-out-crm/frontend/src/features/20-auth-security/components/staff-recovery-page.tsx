"use client";

import {
  ArrowRight,
  Check,
  MailCheck,
  RotateCw,
  ShieldAlert,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { motion } from "motion/react";
import { useCallback, useEffect, useState, type FormEvent, type KeyboardEvent } from "react";

import "./admin-login.css";

import { publicClient } from "@/api/clients";
import { AppError } from "@/api/error-normalizer";
import { AdminStage, T, useRise } from "@/features/20-auth-security/components/admin-stage";
import { OtpInput } from "@/features/20-auth-security/components/otp-input";
import { useHydrated } from "@/lib/use-hydrated";

/** The console minimum (§8.17 #88). The shop's is six; this door opens more. */
const MIN_PASSWORD = 12;

/** Matches the server's per-account resend cooldown. */
const RESEND_SECONDS = 60;

/** What the API calls a wrong or expired code (backend ValidationException). */
const OTP_REJECTED = "ICE-AUTH-OTP-422";

const TITLE = ["Locked out", "is a Tuesday.", "Not a crisis."];

/**
 * What recovery actually is, stated on the frame.
 *
 * The three steps, because the one question somebody in this state has is "how
 * long is this going to take" — and three named steps answers it before they
 * start.
 */
const MANIFEST = [
  { key: "01", value: "Confirm the work email on the account" },
  { key: "02", value: "Enter the six-digit code it receives" },
  { key: "03", value: "Choose a new password and sign in" },
];

type Step = "email" | "code" | "password" | "done";

/**
 * Console account recovery.
 *
 * THIS SCREEN USED TO BE A FIXTURE. It rendered a form, set a `complete` flag
 * on submit, and told the operator in as many words that nothing had been sent.
 * It now runs against `/admin/auth/password/*`, and the promise its copy always
 * made — that the answer is the same whether or not the address is a staff
 * account — is a property of the endpoint rather than a sentence on a mock.
 *
 * WHY A CODE AND NOT A LINK. A reset link means the email carries a clickable
 * address to a page that will accept a new console password, which is the shape
 * of every credential-phishing message ever sent — and the console is the half
 * of this business where that lands hardest. A code is typed back into the tab
 * the operator opened themselves, so no email can put them on the wrong site.
 *
 * WHAT IT WILL NOT TELL YOU. Whether the address belongs to a member of staff.
 * The first step advances identically either way, because the API answers 202
 * either way: a login screen that confirmed which addresses are staff would be
 * handing out the first half of every credential an attacker needs.
 *
 * `mode` is which door was used. `/forgot-password` starts at the address;
 * `/reset-password` is the "I already have a code" entrance and starts at the
 * code, given an address to check it against.
 */
export function StaffRecoveryPage({ mode }: { mode: "forgot" | "reset" }) {
  const searchParams = useSearchParams();
  const rise = useRise();
  const ready = useHydrated();

  /* `/reset-password?email=…` is the "I already have a code" entrance, so it can
     open on the code step. Without an address there is nothing to check a code
     against, and it falls back to asking for one. */
  const prefilled = mode === "reset" ? (searchParams.get("email")?.trim() ?? "") : "";

  const [step, setStep] = useState<Step>(prefilled === "" ? "email" : "code");
  const [email, setEmail] = useState(prefilled);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");

  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [caps, setCaps] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown((left) => left - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  /* `getModifierState` is only defined on a real keyboard event, and a field
     filled by a password manager never fires one — so this reports what it
     knows and never guesses. */
  function readCaps(event: KeyboardEvent<HTMLInputElement>) {
    setCaps(event.getModifierState?.("CapsLock") ?? false);
  }

  function say(failure: unknown) {
    setError(failure instanceof Error ? failure.message : "That did not work. Please try again.");
  }

  async function sendCode(address: string) {
    setPending(true);
    setError("");

    try {
      await publicClient.post("/admin/auth/password/forgot", { email: address });
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

  const checkCode = useCallback(
    async (typed: string) => {
      setPending(true);
      setError("");

      try {
        await publicClient.post("/admin/auth/password/verify", { email, code: typed });
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

  async function commit() {
    if (password !== confirmation) {
      setError("Those two passwords are not the same.");
      return;
    }

    setPending(true);
    setError("");

    try {
      await publicClient.post("/admin/auth/password/reset", { email, code, password });
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

  const heading = {
    email: "Recover access",
    code: "Check your inbox",
    password: "Choose a new password",
    done: "Password changed",
  }[step];

  const sub = {
    email: "Staff accounts only. The code goes to the address on the account and nowhere else.",
    code: "Six digits, good for ten minutes, usable once.",
    password: `At least ${MIN_PASSWORD} characters. Longer beats clever.`,
    done: "Everywhere that was signed in with the old password has been signed out.",
  }[step];

  const action = { email: "Send code", code: "Verify code", password: "Set password", done: "" }[
    step
  ];

  return (
    <main className="adl">
      <AdminStage
        kicker="Account recovery"
        lede={
          <>
            Nobody can hand you a console password over chat — not support, not the person who
            set the account up. This is the only way back in, and it goes through the mailbox on
            the account.
          </>
        }
        manifest={MANIFEST}
        title={TITLE}
      />

      <section className="adl__panel">
        <form className="adl__form" onSubmit={submit}>
          <motion.p className="adl__badge" {...rise(T.badge)}>
            <ShieldCheck aria-hidden="true" size={11} strokeWidth={2.2} />
            Restricted access
          </motion.p>

          <motion.div {...rise(T.heading)}>
            <h2 className="adl__heading">{heading}</h2>
          </motion.div>

          <motion.p className="adl__sub" {...rise(T.heading + 0.06)}>
            {sub}
          </motion.p>

          {step === "done" ? (
            <motion.div className="adl__done" {...rise(T.fields)} role="status">
              <Check aria-hidden="true" size={16} strokeWidth={2} />
              <p>
                Sign in with the new password. Whatever you do on the other side of the door has
                your name on it, the same as always.
              </p>
            </motion.div>
          ) : (
            <>
              {/* Every control below carries `suppressHydrationWarning` — see
                  the note on the sign-in form. Password managers stamp their own
                  attributes onto inputs before React hydrates. */}
              <motion.div className="adl__fields" {...rise(T.fields)}>
                {step === "email" && (
                  <label className="adl__field" htmlFor="recover-email">
                    <span>Work email</span>
                    <input
                      autoComplete="username"
                      id="recover-email"
                      name="email"
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="you@iced-out.example"
                      required
                      suppressHydrationWarning
                      type="email"
                      value={email}
                    />
                  </label>
                )}

                {step === "code" && (
                  <>
                    <p className="adl__note">
                      <MailCheck aria-hidden="true" size={13} strokeWidth={1.9} />
                      <span>
                        If <b>{email}</b> is a staff account, a code is on its way to it.
                      </span>
                    </p>

                    <OtpInput
                      disabled={pending}
                      invalid={error !== ""}
                      label="Recovery code"
                      onChange={(next) => {
                        setCode(next);
                        if (error) setError("");
                      }}
                      /* Six digits in, six digits checked — nobody should have
                         to find a button after typing the last one. */
                      onComplete={(complete) => void checkCode(complete)}
                      value={code}
                    />

                    <div className="adl__codeFoot">
                      <button
                        className="adl__link"
                        disabled={!ready || pending || cooldown > 0}
                        onClick={() => void sendCode(email)}
                        suppressHydrationWarning
                        type="button"
                      >
                        <RotateCw aria-hidden="true" size={12} strokeWidth={1.9} />
                        {cooldown > 0 ? `Send it again in ${cooldown}s` : "Send it again"}
                      </button>

                      {/* A step back, not a restart — the code already sent
                          stays valid for its ten minutes. */}
                      <button
                        className="adl__link"
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
                  </>
                )}

                {step === "password" && (
                  <>
                    <label className="adl__field" htmlFor="recover-password">
                      <span>New password</span>
                      <input
                        autoComplete="new-password"
                        id="recover-password"
                        minLength={MIN_PASSWORD}
                        name="password"
                        onChange={(event) => setPassword(event.target.value)}
                        onKeyDown={readCaps}
                        onKeyUp={readCaps}
                        placeholder={`At least ${MIN_PASSWORD} characters`}
                        required
                        suppressHydrationWarning
                        type="password"
                        value={password}
                      />
                    </label>

                    <label className="adl__field" htmlFor="recover-confirm">
                      <span>Confirm new password</span>
                      <input
                        autoComplete="new-password"
                        id="recover-confirm"
                        minLength={MIN_PASSWORD}
                        name="password_confirmation"
                        onChange={(event) => setConfirmation(event.target.value)}
                        onKeyDown={readCaps}
                        onKeyUp={readCaps}
                        placeholder="Type it once more"
                        required
                        suppressHydrationWarning
                        type="password"
                        value={confirmation}
                      />
                    </label>
                  </>
                )}
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

              {/* Held closed until the handler exists: a form with no action,
                  pressed early, GETs this page back with what was typed into it
                  hanging off the URL. */}
              <motion.button
                className="adl__submit"
                disabled={!ready || pending || (step === "code" && code.length < 6)}
                suppressHydrationWarning
                type="submit"
                {...rise(T.submit)}
              >
                {pending ? (
                  <>
                    <span aria-hidden="true" className="adl__spinner" />
                    Working&hellip;
                  </>
                ) : (
                  <>
                    {action}
                    <ArrowRight aria-hidden="true" size={15} strokeWidth={2} />
                  </>
                )}
              </motion.button>
            </>
          )}

          <motion.div className="adl__foot" {...rise(T.foot)}>
            <span className="adl__audit">
              <ShieldCheck aria-hidden="true" size={12} strokeWidth={1.7} />
              Recovery requests are logged
            </span>

            <Link className="adl__help" href="/login">
              Back to sign in
            </Link>
          </motion.div>
        </form>
      </section>
    </main>
  );
}
