"use client";

import {
  Check,
  KeyRound,
  Laptop,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  TriangleAlert,
} from "lucide-react";
import { useState, type FormEvent } from "react";

import { AccountSection } from "@/components/account/account-section";
import { useOrders } from "@/features/07-orders/orders-context";

/**
 * Security.
 *
 * Four controls, and every one of them does something: the password form
 * validates and — as a real identity API would — drops the other sessions on
 * success, the second factor can be turned on and off through a code step, a
 * session can be revoked from its own row, and a deletion request has to be
 * typed out and is held while an order is still open.
 *
 * Nothing here is a placeholder waiting for a backend. The state lives in the
 * session rather than a database, and the copy says so once, at the bottom,
 * instead of apologising under every panel.
 */
type Session = {
  id: string;
  device: string;
  detail: string;
  lastActive: string;
  current?: boolean;
  icon: typeof Laptop;
};

const INITIAL_SESSIONS: Session[] = [
  {
    id: "s-current",
    device: "Chrome on Windows",
    detail: "Bengaluru, India",
    lastActive: "Active now",
    current: true,
    icon: Laptop,
  },
  {
    id: "s-mobile",
    device: "Mobile browser",
    detail: "Bengaluru, India",
    lastActive: "02 Aug 2026",
    icon: Smartphone,
  },
  {
    id: "s-laptop",
    device: "Safari on macOS",
    detail: "New Delhi, India",
    lastActive: "26 Jul 2026",
    icon: Laptop,
  },
];

/** Four cheap signals, so the meter answers "why" and not just "how much". */
function scorePassword(value: string) {
  return [
    value.length >= 10,
    /[a-z]/.test(value) && /[A-Z]/.test(value),
    /\d/.test(value),
    /[^\w\s]/.test(value),
  ].filter(Boolean).length;
}

const STRENGTH = ["Too short", "Weak", "Fair", "Strong", "Very strong"];

export default function SecurityPage() {
  const [sessions, setSessions] = useState(INITIAL_SESSIONS);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordChanged, setPasswordChanged] = useState(false);

  const [twoFactor, setTwoFactor] = useState(false);
  const [enrolling, setEnrolling] = useState(false);
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState<string | null>(null);

  const { orders } = useOrders();

  const [deleting, setDeleting] = useState(false);
  const [deleteWord, setDeleteWord] = useState("");
  const [deleteRequested, setDeleteRequested] = useState(false);

  /* This shopper's own order still in flight, if any — the one deleting the
     account would strand. It read `orderFixtures`, so the warning named a demo
     order to everybody, including someone with nothing outstanding. */
  const openOrder = orders.find((order) => order.status !== "Delivered");
  const score = scorePassword(next);
  const otherSessions = sessions.filter((session) => !session.current);

  function signOutOthers() {
    setSessions((list) => list.filter((session) => session.current));
  }

  function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordChanged(false);

    if (!current) return setPasswordError("Enter your current password first.");
    if (score < 3) return setPasswordError("Use at least 10 characters with a number and a symbol.");
    if (next === current) return setPasswordError("The new password matches the current one.");
    if (next !== confirm) return setPasswordError("The two new passwords do not match.");

    setPasswordError(null);
    setCurrent("");
    setNext("");
    setConfirm("");
    setPasswordChanged(true);
    /* A credential change invalidates everything issued against the old one. */
    signOutOthers();
  }

  function verifyCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!/^\d{6}$/.test(code)) return setCodeError("Enter the six digits from your authenticator.");
    setCodeError(null);
    setCode("");
    setEnrolling(false);
    setTwoFactor(true);
  }

  return (
    <AccountSection
      copy="Change the credential, add a second factor, and see every device this account is signed in on. Revoking is immediate."
      eyebrow="Account / Session control"
      title="Password, sign-in and devices."
      actions={
        <span className={`io-badge ${twoFactor ? "io-badge--ok" : "io-badge--live"}`}>
          {twoFactor ? "Two-factor on" : "Two-factor off"}
        </span>
      }
    >
      <section className="io-panel">
        <header className="io-panel__head">
          <div>
            <h3 className="io-panel__title">
              <KeyRound aria-hidden size={16} strokeWidth={1.6} />
              Password
            </h3>
            <p className="io-panel__note">
              Changing it signs out every other device straight away. Last changed 42 days
              ago.
            </p>
          </div>
        </header>

        <form className="io-form" onSubmit={changePassword}>
          <label className="io-field">
            <span>Current password</span>
            <input
              autoComplete="current-password"
              onChange={(event) => setCurrent(event.target.value)}
              placeholder="Enter your current password"
              type="password"
              value={current}
            />
          </label>

          <div className="io-form__row">
            <label className="io-field">
              <span>New password</span>
              <input
                autoComplete="new-password"
                onChange={(event) => setNext(event.target.value)}
                placeholder="At least 10 characters"
                type="password"
                value={next}
              />
            </label>
            <label className="io-field">
              <span>Confirm new password</span>
              <input
                autoComplete="new-password"
                onChange={(event) => setConfirm(event.target.value)}
                placeholder="Repeat the new password"
                type="password"
                value={confirm}
              />
            </label>
          </div>

          <div className="io-meter">
            <div className="io-meter__track">
              {[1, 2, 3, 4].map((step) => (
                <i data-on={next.length > 0 && score >= step} key={step} />
              ))}
            </div>
            <p className="io-meter__label">
              {next.length === 0
                ? "Ten characters or more, mixing cases, a number and a symbol."
                : `${STRENGTH[score]} · ${score}/4 checks passed`}
            </p>
          </div>

          {passwordError && (
            <p className="io-note io-note--danger">
              <TriangleAlert aria-hidden size={16} strokeWidth={1.7} />
              {passwordError}
            </p>
          )}

          {passwordChanged && (
            <div className="io-note io-note--ok">
              <Check aria-hidden size={16} strokeWidth={2} />
              <p>
                <strong>Password updated.</strong>
                Every other device was signed out. This one stays signed in.
              </p>
            </div>
          )}

          <div className="io-actions io-actions--end">
            <button className="io-btn io-btn--solid" type="submit">
              Update password
            </button>
          </div>
        </form>
      </section>

      <section className="io-panel">
        <header className="io-panel__head">
          <div>
            <h3 className="io-panel__title">
              <ShieldCheck aria-hidden size={16} strokeWidth={1.6} />
              Two-factor authentication
            </h3>
            <p className="io-panel__note">
              A six-digit code from an authenticator app, asked for on any new device.
            </p>
          </div>
        </header>

        <div className="io-switches">
          <label className="io-switch">
            <span>
              <strong>Authenticator app</strong>
              <small>
                {twoFactor
                  ? "On. New sign-ins ask for a code after the password."
                  : "Off. A password on its own is all a new device needs."}
              </small>
            </span>
            <input
              checked={twoFactor || enrolling}
              onChange={(event) => {
                if (event.target.checked) {
                  setEnrolling(true);
                  return;
                }
                setTwoFactor(false);
                setEnrolling(false);
                setCode("");
                setCodeError(null);
              }}
              type="checkbox"
            />
            <span className="io-switch__track" />
          </label>
        </div>

        {enrolling && (
          <form className="io-form" onSubmit={verifyCode} style={{ marginTop: 12 }}>
            <div className="io-note">
              <Smartphone aria-hidden size={16} strokeWidth={1.7} />
              <p>
                <strong>Pair the app</strong>
                Add the key <code>ICED OUT4 2026 SHOP</code> to your authenticator, then
                enter the code it shows.
              </p>
            </div>

            <div className="io-form__row">
              <label className="io-field">
                <span>
                  Six-digit code <em>from the app</em>
                </span>
                <input
                  autoComplete="one-time-code"
                  inputMode="numeric"
                  maxLength={6}
                  onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
                  placeholder="000000"
                  value={code}
                />
              </label>
            </div>

            {codeError && (
              <p className="io-note io-note--danger">
                <TriangleAlert aria-hidden size={16} strokeWidth={1.7} />
                {codeError}
              </p>
            )}

            <div className="io-actions io-actions--end">
              <button
                className="io-btn io-btn--ghost"
                onClick={() => {
                  setEnrolling(false);
                  setCode("");
                  setCodeError(null);
                }}
                type="button"
              >
                Cancel
              </button>
              <button className="io-btn io-btn--solid" type="submit">
                Turn on
              </button>
            </div>
          </form>
        )}
      </section>

      <section className="io-panel">
        <header className="io-panel__head">
          <div>
            <h3 className="io-panel__title">
              <Laptop aria-hidden size={16} strokeWidth={1.6} />
              Devices
            </h3>
            <p className="io-panel__note">
              {otherSessions.length === 0
                ? "This is the only device signed in."
                : `${otherSessions.length} other device${otherSessions.length === 1 ? "" : "s"} can open this account.`}
            </p>
          </div>
          {otherSessions.length > 0 && (
            <button className="io-btn io-btn--ghost" onClick={signOutOthers} type="button">
              Sign out others
            </button>
          )}
        </header>

        <div className="io-tablewrap">
          <table className="io-table">
            <thead>
              <tr>
                <th scope="col">Device</th>
                <th scope="col">Location</th>
                <th scope="col">Last active</th>
                <th data-align="right" scope="col">
                  <span className="sr-only">Action</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {sessions.map(({ id, device, detail, lastActive, current: isCurrent, icon: Icon }) => (
                <tr key={id}>
                  <th scope="row">
                    <span className="io-table__primary">
                      <Icon aria-hidden size={15} strokeWidth={1.6} />
                      {device}
                    </span>
                  </th>
                  <td>{detail}</td>
                  <td className="io-table__num">{lastActive}</td>
                  <td data-align="right">
                    {isCurrent ? (
                      <span className="io-badge io-badge--ok">This device</span>
                    ) : (
                      <button
                        className="io-btn io-btn--ghost io-btn--sm"
                        onClick={() =>
                          setSessions((list) => list.filter((session) => session.id !== id))
                        }
                        type="button"
                      >
                        Revoke
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="io-panel io-panel--danger">
        <header className="io-panel__head">
          <div>
            <h3 className="io-panel__title">
              <ShieldAlert aria-hidden size={16} strokeWidth={1.6} />
              Delete account
            </h3>
            <p className="io-panel__note">
              Closes the account and erases saved addresses and preferences. Order
              records are kept as long as tax and consumer law require.
            </p>
          </div>
        </header>

        {deleteRequested ? (
          <div className="io-note io-note--warn">
            <TriangleAlert aria-hidden size={16} strokeWidth={1.7} />
            <p>
              <strong>Deletion requested.</strong>
              {openOrder
                ? `The 30-day window starts once ${openOrder.number} reaches a final state. Nothing is erased before then.`
                : "The 30-day window has started. Signing in before it ends cancels the request."}
            </p>
          </div>
        ) : deleting ? (
          <form
            className="io-form"
            onSubmit={(event) => {
              event.preventDefault();
              setDeleteRequested(true);
              setDeleting(false);
            }}
          >
            <label className="io-field">
              <span>
                Type DELETE to confirm <em>this cannot be undone from here</em>
              </span>
              <input
                onChange={(event) => setDeleteWord(event.target.value)}
                placeholder="DELETE"
                value={deleteWord}
              />
            </label>
            <div className="io-actions io-actions--end">
              <button
                className="io-btn io-btn--ghost"
                onClick={() => {
                  setDeleting(false);
                  setDeleteWord("");
                }}
                type="button"
              >
                Keep account
              </button>
              <button
                className="io-btn io-btn--solid"
                disabled={deleteWord.trim().toUpperCase() !== "DELETE"}
                type="submit"
              >
                Request deletion
              </button>
            </div>
          </form>
        ) : (
          <div className="io-panel__foot">
            <p>
              {openOrder
                ? `${openOrder.number} is still open, so the request is queued rather than immediate.`
                : "No open orders — the request starts a 30-day window immediately."}
            </p>
            <button className="io-btn io-btn--ghost" onClick={() => setDeleting(true)} type="button">
              Delete account
            </button>
          </div>
        )}

        {deleteRequested && (
          <div className="io-panel__foot">
            <p>Changed your mind? Cancelling keeps every order, address and saved piece.</p>
            <button
              className="io-btn io-btn--ghost"
              onClick={() => {
                setDeleteRequested(false);
                setDeleteWord("");
              }}
              type="button"
            >
              Cancel request
            </button>
          </div>
        )}
      </section>

      <p className="io-meter__label">
        This is a frontend preview: changes here live in the session, and no credential
        leaves the browser.
      </p>
    </AccountSection>
  );
}
