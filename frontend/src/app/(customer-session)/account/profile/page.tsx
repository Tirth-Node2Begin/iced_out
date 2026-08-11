"use client";

import {
  ArrowRight,
  Bell,
  Camera,
  Check,
  Heart,
  LifeBuoy,
  LockKeyhole,
  MapPin,
  MessageSquareText,
  Package,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useRef, useState, type ChangeEvent, type FormEvent } from "react";

import { AddAddressDialog } from "@/components/account/add-address-dialog";
import { useAddresses } from "@/features/01-users/addresses-context";
import {
  initialsOf,
  readPhotoFile,
  useProfile,
  type CustomerProfile,
} from "@/features/01-users/profile-context";

/**
 * Profile.
 *
 * Three cards, in the order the questions get asked: who this is, where their
 * orders go, and where else they can get to.
 *
 * The identity card is the read state — the details are not repeated as a list
 * underneath it, because a screen that prints the same email twice is a screen
 * that will one day print two different ones. Pressing edit swaps the card for
 * the form, which is also the only place the photo can be changed: a picture
 * swappable by a stray tap on the read screen is one that gets swapped by
 * accident.
 */
const FIELDS = [
  { key: "name", label: "Full name", hint: undefined, type: "text", autoComplete: "name" },
  { key: "email", label: "Email", hint: "used to sign in", type: "email", autoComplete: "email" },
  { key: "mobile", label: "Mobile", hint: "delivery updates", type: "tel", autoComplete: "tel" },
] as const;

/** Every other tab in the rail, as one press each. Profile is the page. */
const QUICK_ACTIONS = [
  { href: "/account/orders", label: "Orders", note: "Track and re-order", icon: Package },
  { href: "/account/wishlist", label: "Saved", note: "Pieces you kept", icon: Heart },
  { href: "/account/addresses", label: "Addresses", note: "Where orders go", icon: MapPin },
  { href: "/account/feedback", label: "Feedback", note: "Rate what arrived", icon: MessageSquareText },
  { href: "/account/notifications", label: "Notifications", note: "Your inbox", icon: Bell },
  { href: "/account/support", label: "Support", note: "Ask a person", icon: LifeBuoy },
  { href: "/account/security", label: "Security", note: "Password and sessions", icon: LockKeyhole },
];

export default function ProfilePage() {
  const { profile, initials, save } = useProfile();
  const { defaultAddress, addresses } = useAddresses();

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<CustomerProfile>(profile);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [addingAddress, setAddingAddress] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const dirty =
    draft.photo !== profile.photo ||
    FIELDS.some((field) => draft[field.key].trim() !== profile[field.key]);

  function startEditing() {
    /* Open from the stored record, not from whatever a previous abandoned edit
       left in the draft. */
    setDraft(profile);
    setPhotoError(null);
    setConfirmed(false);
    setEditing(true);
  }

  function cancel() {
    setDraft(profile);
    setPhotoError(null);
    setEditing(false);
  }

  function set(key: (typeof FIELDS)[number]["key"], value: string) {
    setDraft((current) => ({ ...current, [key]: value }));
    setConfirmed(false);
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
      setConfirmed(false);
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
    setConfirmed(true);
  }

  /* No section header on this tab. The frame above already says "Your profile",
     and the identity card underneath says who that is with the name and the
     face — a headline asking "who this account belongs to" in between was a
     third telling of the same thing. The cards carry the page. */
  return (
    <div className="io-sec__body">
      {editing ? (
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

          <form className="io-form" onSubmit={submit}>
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
      ) : (
        <>
          {confirmed && (
            <div className="io-note io-note--ok">
              <Check aria-hidden size={16} strokeWidth={2} />
              <p>
                <strong>Profile saved.</strong>
                Orders placed from now on carry the updated details.
              </p>
            </div>
          )}

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
        </>
      )}

      {/* Kept as its own card, and read-only here: this is a reminder of where
          orders land, not a second place to manage the book. */}
      <section className="io-panel">
        <header className="io-panel__head">
          <div>
            <h3 className="io-panel__title">
              <MapPin aria-hidden size={16} strokeWidth={1.6} />
              Default address
            </h3>
            <p className="io-panel__note">
              Pre-selected at checkout. Change which one is default in Addresses.
            </p>
          </div>
          <div className="io-actions">
            <button
              className="io-btn io-btn--ghost io-btn--sm"
              onClick={() => setAddingAddress(true)}
              type="button"
            >
              <Plus aria-hidden size={14} strokeWidth={1.8} />
              Add address
            </button>
            <Link className="io-btn io-btn--ghost io-btn--sm" href="/account/addresses">
              {addresses.length > 1 ? `All ${addresses.length}` : "Manage"}
              <ArrowRight aria-hidden size={14} strokeWidth={1.7} />
            </Link>
          </div>
        </header>

        {defaultAddress ? (
          <article className="io-card">
            <div className="io-card__head">
              <h4 className="io-card__title">
                <MapPin aria-hidden size={14} strokeWidth={1.7} />
                {defaultAddress.label}
              </h4>
              <span className="io-badge io-badge--ok">Default</span>
            </div>

            <address>
              {defaultAddress.name}
              <br />
              {defaultAddress.lines.map((line) => (
                <span key={line}>
                  {line}
                  <br />
                </span>
              ))}
              {defaultAddress.phone}
            </address>
          </article>
        ) : (
          <button className="io-card io-card--dashed" onClick={() => setAddingAddress(true)} type="button">
            <Plus aria-hidden size={22} strokeWidth={1.5} />
            Add your first address
          </button>
        )}
      </section>

      <AddAddressDialog onOpenChange={setAddingAddress} open={addingAddress} />

      <section className="io-panel">
        <header className="io-panel__head">
          <div>
            <h3 className="io-panel__title">Quick actions</h3>
            <p className="io-panel__note">Everywhere else this account can go.</p>
          </div>
        </header>

        <div className="io-quick">
          {QUICK_ACTIONS.map(({ href, label, note, icon: Icon }) => (
            <Link className="io-quick__item" href={href} key={href}>
              <span className="io-quick__glyph">
                <Icon aria-hidden size={16} strokeWidth={1.6} />
              </span>
              <span className="io-quick__label">{label}</span>
              <span className="io-quick__note">{note}</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
