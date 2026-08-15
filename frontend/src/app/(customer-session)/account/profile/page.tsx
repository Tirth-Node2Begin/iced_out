"use client";

import {
  ArrowRight,
  Bell,
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
import { useState } from "react";
import { toast } from "sonner";

import { AddressDialog } from "@/components/account/address-dialog";
import { AddressRemoveDialog } from "@/components/account/address-remove-dialog";
import { useAddresses, type Address } from "@/features/01-users/addresses-context";

/**
 * Profile.
 *
 * Two cards, in the order the questions get asked: where this account's orders
 * go, and where else it can get to.
 *
 * Who the account belongs to is asked first and answered above the page — the
 * identity card is the frame's banner now, printed across the full width by
 * `AccountShell` rather than stacked in this column beside the rail. See
 * `components/account/profile-identity.tsx`.
 */

/** Every other tab in the rail, as one press each. Profile is the page. */
const QUICK_ACTIONS = [
  { href: "/account/orders", label: "Orders", note: "Track and re-order", icon: Package },
  { href: "/account/addresses", label: "Addresses", note: "Where orders go", icon: MapPin },
  { href: "/account/feedback", label: "Feedback", note: "Rate what arrived", icon: MessageSquareText },
  { href: "/account/notifications", label: "Notifications", note: "Your inbox", icon: Bell },
  { href: "/account/support", label: "Support", note: "Ask a person", icon: LifeBuoy },
  { href: "/account/security", label: "Security", note: "Password and sessions", icon: LockKeyhole },
];

export default function ProfilePage() {
  const { addresses, defaultId, setDefault } = useAddresses();

  /* `null` is closed, `{ address: null }` is the blank form — an open flag plus
     a separate "which one" would let the two disagree about what is on screen. */
  const [addressEditor, setAddressEditor] = useState<{ address: Address | null } | null>(null);
  /* The book asks before it deletes, and it asks in a box over the page rather
     than inside the card: a saved address is typed once and used for years, and
     a stray tap on a 32px button is not consent to lose it. */
  const [removing, setRemoving] = useState<Address | null>(null);

  /* Default first: the card the eye wants is the one the parcel goes to. */
  const ordered = [...addresses].sort((a, b) =>
    a.id === defaultId ? -1 : b.id === defaultId ? 1 : 0,
  );

  function makeDefault(address: Address) {
    setDefault(address.id);
    toast.success(`${address.label} is now your default.`, {
      id: "address-default",
      description: "Checkout will pre-select it.",
    });
  }

  /* The dialog has already removed it by the time this runs — all that is left
     is to say so, and to say what the book does about the default. */
  function announceRemoval(address: Address) {
    const wasDefault = address.id === defaultId;
    const remaining = addresses.length - 1;

    toast.success(`${address.label} removed.`, {
      id: "address-removed",
      description:
        wasDefault && remaining > 0
          ? "The next saved address takes over as default."
          : remaining === 0
            ? "Your book is empty — checkout will ask for an address."
            : undefined,
    });
  }

  /* No section header on this tab. The frame above already says "Your profile",
     and the banner across the top says who that is with the name and the face —
     a headline asking "who this account belongs to" in between was a third
     telling of the same thing. The cards carry the page. */
  return (
    <div className="io-sec__body">
      {/* This card used to be a read-only reminder of where orders land, on the
          reasoning that the book belongs to the Addresses tab. In practice the
          thing people came here to fix — a wrong pincode, an old flat number —
          was two navigations away and could only be retyped from scratch. The
          actions live where the address is shown; the tab is still the place
          that lists the whole book. */}
      <section className="io-panel">
        <header className="io-panel__head">
          <div>
            <h3 className="io-panel__title">
              <MapPin aria-hidden size={16} strokeWidth={1.6} />
              Delivery addresses
            </h3>
            <p className="io-panel__note">
              The default is pre-selected at checkout. Edit, remove, or hand the default
              to another one right here.
            </p>
          </div>
          <div className="io-actions">
            <button
              className="io-btn io-btn--ghost io-btn--sm"
              onClick={() => setAddressEditor({ address: null })}
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

        {ordered.length === 0 ? (
          <button
            className="io-card io-card--dashed"
            onClick={() => setAddressEditor({ address: null })}
            type="button"
          >
            <Plus aria-hidden size={22} strokeWidth={1.5} />
            Add your first address
          </button>
        ) : (
          <div className="io-cards">
            {ordered.map((address) => (
              <article className="io-card" key={address.id}>
                <div className="io-card__head">
                  <h4 className="io-card__title">
                    <MapPin aria-hidden size={14} strokeWidth={1.7} />
                    {address.label}
                  </h4>
                  {address.id === defaultId && (
                    <span className="io-badge io-badge--ok">Default</span>
                  )}
                </div>

                <address>
                  {address.name}
                  <br />
                  {address.lines.map((line) => (
                    <span key={line}>
                      {line}
                      <br />
                    </span>
                  ))}
                  {address.phone}
                </address>

                <div className="io-card__actions">
                  <button
                    className="io-btn io-btn--ghost io-btn--sm"
                    onClick={() => setAddressEditor({ address })}
                    type="button"
                  >
                    <Pencil aria-hidden size={13} strokeWidth={1.7} />
                    Edit
                  </button>
                  {/* No glyph on this one, unlike its neighbours: it is the
                      longest label of the three, and dropping the tick is what
                      keeps all three actions on one line in a narrow card. The
                      addresses tab spells it the same way. */}
                  {address.id !== defaultId && (
                    <button
                      className="io-btn io-btn--ghost io-btn--sm"
                      onClick={() => makeDefault(address)}
                      type="button"
                    >
                      Make default
                    </button>
                  )}
                  <button
                    className="io-btn io-btn--ghost io-btn--sm"
                    onClick={() => setRemoving(address)}
                    type="button"
                  >
                    <Trash2 aria-hidden size={13} strokeWidth={1.7} />
                    Remove
                  </button>
                </div>
              </article>
            ))}

            <button
              className="io-card io-card--dashed"
              onClick={() => setAddressEditor({ address: null })}
              type="button"
            >
              <Plus aria-hidden size={22} strokeWidth={1.5} />
              Add another address
            </button>
          </div>
        )}
      </section>

      <AddressDialog
        address={addressEditor?.address ?? null}
        onOpenChange={(open) => {
          if (!open) setAddressEditor(null);
        }}
        onSaved={(saved, mode) =>
          toast.success(
            mode === "updated" ? `${saved.label} updated.` : `${saved.label} saved.`,
            {
              id: "address-saved",
              description:
                mode === "updated"
                  ? "Checkout will use the corrected details."
                  : "It is in your address book now.",
            },
          )
        }
        open={addressEditor !== null}
      />

      <AddressRemoveDialog
        address={removing}
        onOpenChange={(open) => {
          if (!open) setRemoving(null);
        }}
        onRemoved={announceRemoval}
      />

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
