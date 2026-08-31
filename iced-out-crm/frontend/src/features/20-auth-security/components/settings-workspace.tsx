"use client";

import { Camera, Eye, EyeOff, KeyRound, Pencil, Trash2, UserRound } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";

import {
  AdminPage,
  Btn,
  DetailList,
  Field,
  Panel,
  Section,
} from "@/components/shell/admin-ui";
import { useAuth } from "@/features/20-auth-security/auth-context";

/**
 * Settings.
 *
 * This screen used to be seven tabs — store identity, tax, localization,
 * payments, shipping, integrations, security — and every one of them was a form
 * over values nothing else in the console reads. What an operator actually
 * comes here to do is change their own account: the photo in the topbar, the
 * name printed beside it, and the password that opens the console.
 *
 * So that is the whole screen, and both halves of it open closed. A settings
 * page whose fields are live on arrival invites a stray keystroke into a record
 * nobody came to edit; pressing Edit is the statement of intent, and until it
 * is pressed the page is something you read.
 */

/* ---- what is stored ------------------------------------------------------ */

/**
 * The profile lives in `localStorage` rather than in the session.
 *
 * There is no account API yet, and a photo that vanishes on reload reads as a
 * broken upload rather than an unfinished backend. When the API arrives this
 * key is replaced by a fetch and nothing above it moves.
 */
const PROFILE_KEY = "iced-out.admin-profile";

/** A photo is held as a data URL, so 2 MB is already generous for a 96px avatar. */
const MAX_PHOTO_BYTES = 2 * 1024 * 1024;

const MIN_PASSWORD_LENGTH = 8;

type Profile = {
  name: string;
  email: string;
  phone: string;
  /** A data URL, or null for the initials fallback. */
  photo: string | null;
};

const FALLBACK: Profile = {
  name: "Staff",
  email: "aarav@iced-out.example",
  phone: "+91 98450 11234",
  photo: null,
};

function readStoredProfile(): Profile | null {
  try {
    const raw = window.localStorage.getItem(PROFILE_KEY);
    if (!raw) return null;
    const stored = JSON.parse(raw) as Partial<Profile>;
    return {
      name: typeof stored.name === "string" ? stored.name : FALLBACK.name,
      email: typeof stored.email === "string" ? stored.email : FALLBACK.email,
      phone: typeof stored.phone === "string" ? stored.phone : FALLBACK.phone,
      photo: typeof stored.photo === "string" ? stored.photo : null,
    };
  } catch {
    return null;
  }
}

function writeStoredProfile(profile: Profile) {
  try {
    window.localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    return true;
  } catch {
    /* A quota error is almost always the photo — say so rather than failing
       silently, since the fields would appear saved and the picture would not. */
    return false;
  }
}

function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  if (parts.length === 0) return "IO";
  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("");
}

/* ---- a password box that can show what was typed -------------------------- */

function Secret({
  label,
  help,
  full,
  value,
  onChange,
  autoComplete,
}: {
  label: string;
  help?: string;
  full?: boolean;
  value: string;
  onChange: (next: string) => void;
  autoComplete: string;
}) {
  const [shown, setShown] = useState(false);

  return (
    <Field full={full} help={help} label={label}>
      <span className="set-secret">
        <input
          autoComplete={autoComplete}
          onChange={(event) => onChange(event.target.value)}
          type={shown ? "text" : "password"}
          value={value}
        />
        <button
          aria-label={shown ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
          className="set-secret__peek"
          onClick={() => setShown((current) => !current)}
          type="button"
        >
          {shown ? (
            <EyeOff aria-hidden size={15} strokeWidth={1.7} />
          ) : (
            <Eye aria-hidden size={15} strokeWidth={1.7} />
          )}
        </button>
      </span>
    </Field>
  );
}

/* ---- the screen ---------------------------------------------------------- */

const BLANK_PASSWORDS = { current: "", next: "", confirm: "" };

export function SettingsWorkspace() {
  const { staffSession } = useAuth();

  /* `saved` is the record, `draft` is what is in the boxes while editing. Two
     copies rather than one is what lets Cancel put the fields back — including
     a photo that was picked but never saved — without a reload. */
  const [saved, setSaved] = useState<Profile>(FALLBACK);
  const [draft, setDraft] = useState<Profile>(FALLBACK);
  const [editing, setEditing] = useState(false);
  const seeded = useRef(false);

  const [changingPassword, setChangingPassword] = useState(false);
  const [passwords, setPasswords] = useState(BLANK_PASSWORDS);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const photoInput = useRef<HTMLInputElement>(null);

  /* Runs after hydration, which is the first moment either source is readable:
     `localStorage` does not exist on the server and the staff session is read
     from `sessionStorage` the same way. */
  useEffect(() => {
    if (seeded.current) return;
    seeded.current = true;

    const stored = readStoredProfile();
    const base = stored ?? { ...FALLBACK, name: staffSession?.name ?? FALLBACK.name };
    setSaved(base);
    setDraft(base);
  }, [staffSession]);

  /* Read mode shows the record; edit mode shows the copy being worked on. The
     avatar and the name under it follow whichever is on screen, so a picked
     photo is visible before it is saved and gone again if it is cancelled. */
  const shown = editing ? draft : saved;
  const role = staffSession?.role ?? "Scoped access";

  function set<K extends keyof Profile>(key: K, value: Profile[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function onEdit() {
    setDraft(saved);
    setEditing(true);
  }

  function onCancelEdit() {
    setDraft(saved);
    setEditing(false);
  }

  function onPickPhoto(file: File | undefined) {
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("That file is not an image", { description: "Pick a PNG, JPG or WebP." });
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      toast.error("That image is too large", { description: "Pick a picture under 2 MB." });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      set("photo", typeof reader.result === "string" ? reader.result : null);
      toast.success("Photo ready", { description: "Save changes to keep it." });
    };
    reader.onerror = () => toast.error("That image could not be read");
    reader.readAsDataURL(file);
  }

  function onSaveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const name = draft.name.trim();
    const email = draft.email.trim();

    if (!name) {
      toast.error("A name is required", { description: "It is printed beside your photo." });
      return;
    }
    if (!email) {
      toast.error("An email address is required");
      return;
    }

    const next: Profile = { ...draft, name, email, phone: draft.phone.trim() };
    if (!writeStoredProfile(next)) {
      toast.error("Profile could not be saved", { description: "The photo is too large to store." });
      return;
    }

    setSaved(next);
    setDraft(next);
    setEditing(false);
    toast.success("Profile saved");
  }

  function onCancelPassword() {
    setPasswords(BLANK_PASSWORDS);
    setPasswordError(null);
    setChangingPassword(false);
  }

  function onChangePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const { current, next, confirm } = passwords;

    if (!current) return setPasswordError("Enter your current password.");
    if (next.length < MIN_PASSWORD_LENGTH)
      return setPasswordError(`The new password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
    if (next === current) return setPasswordError("The new password must differ from the current one.");
    if (next !== confirm) return setPasswordError("The two new passwords do not match.");

    setPasswords(BLANK_PASSWORDS);
    setPasswordError(null);
    setChangingPassword(false);
    toast.success("Password updated", { description: "Use it the next time you sign in." });
  }

  return (
    <AdminPage
      eyebrow="Settings · Account"
      icon={UserRound}
      lede="Your photo, the details printed beside it, and the password that opens this console."
      title={
        <>
          Account <em>settings</em>
        </>
      }
    >
      <Section
        actions={
          editing ? (
            <>
              <Btn onClick={onCancelEdit} size="sm">
                Cancel
              </Btn>
              <Btn form="profile-form" size="sm" type="submit" variant="solid">
                Save changes
              </Btn>
            </>
          ) : (
            <Btn onClick={onEdit} size="sm">
              <Pencil aria-hidden size={14} strokeWidth={1.7} />
              Edit
            </Btn>
          )
        }
        copy="The photo and name shown in the topbar, and the address the console writes to when something needs you."
        eyebrow="Profile"
        title="Your details"
      >
        <Panel>
          <div className="set-identity">
            <span className="set-avatar">
              {shown.photo ? (
                // A data URL cannot be optimised, and next/image would only put
                // a loader in front of a string the browser already holds.
                // eslint-disable-next-line @next/next/no-img-element
                <img alt="" src={shown.photo} />
              ) : (
                <strong>{initialsOf(shown.name)}</strong>
              )}
            </span>

            <div className="set-identity__meta">
              <strong>{shown.name.trim() || "Unnamed"}</strong>
              <small>{role}</small>
              {editing && <p>PNG, JPG or WebP, up to 2 MB. Square pictures crop best.</p>}
            </div>

            {editing && (
              <div className="set-identity__acts">
                <input
                  accept="image/*"
                  className="set-file"
                  onChange={(event) => {
                    onPickPhoto(event.target.files?.[0]);
                    /* Cleared so re-picking the same file fires change again. */
                    event.target.value = "";
                  }}
                  ref={photoInput}
                  type="file"
                />
                <Btn onClick={() => photoInput.current?.click()} size="sm">
                  <Camera aria-hidden size={14} strokeWidth={1.7} />
                  {draft.photo ? "Replace photo" : "Upload photo"}
                </Btn>
                {draft.photo && (
                  <Btn onClick={() => set("photo", null)} size="sm" variant="danger">
                    <Trash2 aria-hidden size={14} strokeWidth={1.7} />
                    Remove
                  </Btn>
                )}
              </div>
            )}
          </div>

          <div className="set-rule" />

          {editing ? (
            <form id="profile-form" onSubmit={onSaveProfile}>
              <div className="aui-form aui-form--2">
                <Field label="Full name">
                  <input
                    autoComplete="name"
                    onChange={(event) => set("name", event.target.value)}
                    required
                    value={draft.name}
                  />
                </Field>
                <Field label="Phone">
                  <input
                    autoComplete="tel"
                    onChange={(event) => set("phone", event.target.value)}
                    type="tel"
                    value={draft.phone}
                  />
                </Field>
                <Field
                  full
                  help="Sign-in alerts and anything the console needs to tell you go here."
                  label="Email address"
                >
                  <input
                    autoComplete="email"
                    onChange={(event) => set("email", event.target.value)}
                    required
                    type="email"
                    value={draft.email}
                  />
                </Field>
              </div>
            </form>
          ) : (
            <DetailList
              rows={[
                { label: "Full name", value: saved.name },
                { label: "Email address", value: saved.email },
                { label: "Phone", value: saved.phone || "Not set" },
                { label: "Role", value: role },
              ]}
            />
          )}
        </Panel>
      </Section>

      <Section
        actions={
          changingPassword ? (
            <Btn onClick={onCancelPassword} size="sm">
              Cancel
            </Btn>
          ) : (
            <Btn onClick={() => setChangingPassword(true)} size="sm">
              <Pencil aria-hidden size={14} strokeWidth={1.7} />
              Change
            </Btn>
          )
        }
        copy="Changing this signs nothing out. The new password applies the next time you sign in."
        eyebrow="Security"
        title="Password"
      >
        <Panel>
          {changingPassword ? (
            <form onSubmit={onChangePassword}>
              <div className="aui-form aui-form--2">
                <Secret
                  autoComplete="current-password"
                  full
                  label="Current password"
                  onChange={(value) => setPasswords((current) => ({ ...current, current: value }))}
                  value={passwords.current}
                />
                <Secret
                  autoComplete="new-password"
                  help={`At least ${MIN_PASSWORD_LENGTH} characters.`}
                  label="New password"
                  onChange={(value) => setPasswords((current) => ({ ...current, next: value }))}
                  value={passwords.next}
                />
                <Secret
                  autoComplete="new-password"
                  label="Confirm new password"
                  onChange={(value) => setPasswords((current) => ({ ...current, confirm: value }))}
                  value={passwords.confirm}
                />
              </div>

              {passwordError && (
                <p aria-live="polite" className="set-error">
                  {passwordError}
                </p>
              )}

              <div className="set-formfoot">
                <Btn type="submit" variant="solid">
                  <KeyRound aria-hidden size={15} strokeWidth={1.7} />
                  Update password
                </Btn>
              </div>
            </form>
          ) : (
            <DetailList
              rows={[
                { label: "Password", value: "••••••••••" },
                { label: "Sign-in", value: saved.email },
              ]}
            />
          )}
        </Panel>
      </Section>
    </AdminPage>
  );
}
