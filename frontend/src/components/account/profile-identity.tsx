"use client";

import { Camera, Check, Pencil, Trash2 } from "lucide-react";
import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { toast } from "sonner";

import {
  initialsOf,
  readPhotoFile,
  useProfile,
  type CustomerProfile,
} from "@/features/01-users/profile-context";

/**
 * Who the session belongs to — the read state of the profile, and the form that
 * edits it.
 *
 * It lives in the frame rather than inside the profile tab because it is the
 * banner of the account, not a card in a column: the shell prints it across the
 * full width above the rail, so the face and the two contact details are the
 * first thing on the screen instead of the first thing beside the menu.
 *
 * The details are not repeated as a list underneath the card — a screen that
 * prints the same email twice is a screen that will one day print two different
 * ones. Pressing edit swaps the card for the form, which is also the only place
 * the photo can be changed: a picture swappable by a stray tap on the read
 * screen is one that gets swapped by accident.
 */
const FIELDS = [
  { key: "name", label: "Full name", hint: undefined, type: "text", autoComplete: "name" },
  { key: "email", label: "Email", hint: "used to sign in", type: "email", autoComplete: "email" },
  { key: "mobile", label: "Mobile", hint: "delivery updates", type: "tel", autoComplete: "tel" },
] as const;

export function ProfileIdentity() {
  const { profile, initials, save } = useProfile();

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<CustomerProfile>(profile);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const dirty =
    draft.photo !== profile.photo ||
    FIELDS.some((field) => draft[field.key].trim() !== profile[field.key]);

  function startEditing() {
    /* Open from the stored record, not from whatever a previous abandoned edit
       left in the draft. */
    setDraft(profile);
    setPhotoError(null);
    setEditing(true);
  }

  function cancel() {
    setDraft(profile);
    setPhotoError(null);
    setEditing(false);
  }

  function set(key: (typeof FIELDS)[number]["key"], value: string) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  async function pickPhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    /* Clear the input either way: picking the same file twice has to fire
       `change` again, and it will not if the value is still sitting there. */
    event.target.value = "";
    if (!file) return;

    try {
      const photo = await readPhotoFile(file);
      setDraft((current) => ({ ...current, photo }));
      setPhotoError(null);
    } catch (error) {
      setPhotoError(error instanceof Error ? error.message : "That image could not be read.");
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    save({
      name: draft.name.trim(),
      email: draft.email.trim(),
      mobile: draft.mobile.trim(),
      photo: draft.photo,
    });
    setEditing(false);
    setPhotoError(null);
    /* An id, so a second save replaces the first toast instead of stacking an
       identical one under it. */
    toast.success("Profile saved.", {
      id: "profile-saved",
      description: "Orders placed from now on carry the updated details.",
    });
  }

  if (editing) {
    return (
      <section className="io-panel">
        <header className="io-panel__head">
          <div>
            <h2 className="io-panel__title">Edit details</h2>
            <p className="io-panel__note">
              Your photo stays on this device. Changing the email or mobile changes how
              the account is recovered.
            </p>
          </div>
        </header>

        {/* Laid out to the panel it sits in: the photo row across the top, the
            three details in a row of their own. A name typed into a 1300px box
            is a line of text with a horizon behind it, and a column of inputs
            down one edge leaves the other half of the banner empty. */}
        <form className="io-form io-form--profile" onSubmit={submit}>
          <div className="io-photo">
            {draft.photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img alt="" className="io-photo__preview" src={draft.photo} />
            ) : (
              <span aria-hidden className="io-photo__preview io-photo__preview--empty">
                {initialsOf(draft.name)}
              </span>
            )}

            <div className="io-photo__body">
              <p className="io-photo__label">Profile photo</p>
              <p className="io-photo__note">
                Square works best. JPG or PNG, up to 5 MB — larger images are resized.
              </p>

              <div className="io-actions">
                <button
                  className="io-btn io-btn--ghost io-btn--sm"
                  onClick={() => fileInput.current?.click()}
                  type="button"
                >
                  <Camera aria-hidden size={14} strokeWidth={1.7} />
                  {draft.photo ? "Replace photo" : "Upload photo"}
                </button>
                {draft.photo && (
                  <button
                    className="io-btn io-btn--ghost io-btn--sm"
                    onClick={() => {
                      setDraft((current) => ({ ...current, photo: null }));
                      setPhotoError(null);
                    }}
                    type="button"
                  >
                    <Trash2 aria-hidden size={14} strokeWidth={1.7} />
                    Remove
                  </button>
                )}
              </div>

              {photoError && <p className="io-photo__error">{photoError}</p>}
            </div>

            <input
              accept="image/*"
              className="sr-only"
              onChange={pickPhoto}
              ref={fileInput}
              type="file"
            />
          </div>

          {FIELDS.map((field) => (
            <label className="io-field" key={field.key}>
              <span>
                {field.label}
                {field.hint && <em>{field.hint}</em>}
              </span>
              <input
                autoComplete={field.autoComplete}
                onChange={(event) => set(field.key, event.target.value)}
                required
                type={field.type}
                value={draft[field.key]}
              />
            </label>
          ))}

          <div className="io-actions io-actions--end">
            <button className="io-btn io-btn--ghost" onClick={cancel} type="button">
              Cancel
            </button>
            <button className="io-btn io-btn--solid" disabled={!dirty} type="submit">
              Save profile
            </button>
          </div>
        </form>
      </section>
    );
  }

  /* The "Profile saved" banner used to live here. It pushed the whole page down
     on save, so the card the eye was already on moved, and it had no way out but
     editing again. The same sentence is a toast now — see `submit`. */
  return (
    <section className="io-panel io-idcard">
      {profile.photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img alt="" className="io-idcard__photo" src={profile.photo} />
      ) : (
        <span aria-hidden className="io-idcard__photo io-idcard__photo--empty">
          {initials}
        </span>
      )}

      <div className="io-idcard__body">
        <h2 className="io-idcard__name">{profile.name}</h2>
        <p className="io-idcard__state">
          <Check aria-hidden size={12} strokeWidth={2.2} />
          Verified customer
        </p>

        <dl className="io-idcard__meta">
          <div>
            <dt>Email</dt>
            <dd>{profile.email}</dd>
          </div>
          <div>
            <dt>Mobile</dt>
            <dd>{profile.mobile}</dd>
          </div>
        </dl>
      </div>

      <button className="io-btn io-btn--ghost" onClick={startEditing} type="button">
        <Pencil aria-hidden size={14} strokeWidth={1.7} />
        Edit profile
      </button>
    </section>
  );
}
