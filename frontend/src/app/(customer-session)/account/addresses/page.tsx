"use client";

import { Home, MapPin, Plus, Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";

import { AccountSection } from "@/components/account/account-section";
import { AddressRemoveDialog } from "@/components/account/address-remove-dialog";
import { fieldsToAddress, formDataToFields } from "@/features/01-users/address-fields";
import { useAddresses, type Address } from "@/features/01-users/addresses-context";

/**
 * Addresses.
 *
 * A saved address is a block of lines, not a row of fields, so each one is a
 * card — but the actions on it are real: the default can move, an address can
 * be removed, and a new one is added by the same form the checkout would use.
 * Serviceability is still decided at checkout; the copy says so once.
 *
 * The book itself lives in the account store, not here — the Profile tab shows
 * whichever one is default, so the choice has to outlive this screen.
 */
export default function AddressesPage() {
  const { addresses, defaultId, add: addAddress, setDefault } = useAddresses();
  const [adding, setAdding] = useState(false);
  /* Removal is asked in a box over the page, the same one the profile card
     opens — this screen used to delete on the first press, which is a years-old
     address gone to a mis-aimed tap with nothing between. */
  const [removing, setRemoving] = useState<Address | null>(null);

  function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    /* Composed by the same helper the profile's dialog uses — the region line
       was written out by hand in both places, which is one format and two
       chances to change it. */
    addAddress(fieldsToAddress(formDataToFields(form)));
    setAdding(false);
  }

  return (
    <AccountSection
      copy="Where orders go, and where the card is billed. Each one is checked against the courier's serviceable pincodes at checkout, not at save."
      eyebrow="Account / Delivery map"
      title="Saved destinations."
      actions={
        !adding && (
          <button className="io-btn io-btn--ghost" onClick={() => setAdding(true)} type="button">
            <Plus aria-hidden size={15} strokeWidth={1.8} />
            Add address
          </button>
        )
      }
    >
      {adding && (
        <section className="io-panel">
          <header className="io-panel__head">
            <div>
              <h3 className="io-panel__title">
                <MapPin aria-hidden size={16} strokeWidth={1.6} />
                New address
              </h3>
              <p className="io-panel__note">
                A landmark in the street line reaches the courier; a flat number alone
                often does not.
              </p>
            </div>
          </header>

          <form className="io-form" onSubmit={add}>
            <div className="io-form__row">
              <label className="io-field">
                <span>Label</span>
                <input name="label" placeholder="Home, Studio, Parents…" required />
              </label>
              <label className="io-field">
                <span>Recipient</span>
                <input defaultValue="Iced_out Shopper" name="name" required />
              </label>
            </div>

            <label className="io-field">
              <span>Street and landmark</span>
              <input name="street" placeholder="12 Preview Street, near the depot" required />
            </label>

            <div className="io-form__row">
              <label className="io-field">
                <span>City</span>
                <input name="city" placeholder="Bengaluru" required />
              </label>
              <label className="io-field">
                <span>State</span>
                <input name="state" placeholder="Karnataka" required />
              </label>
            </div>

            <div className="io-form__row">
              <label className="io-field">
                <span>Pincode</span>
                <input
                  inputMode="numeric"
                  maxLength={6}
                  name="pincode"
                  pattern="\d{6}"
                  placeholder="560001"
                  required
                />
              </label>
              <label className="io-field">
                <span>Phone</span>
                <input
                  defaultValue="+91 98765 43210"
                  name="phone"
                  placeholder="+91 …"
                  required
                  type="tel"
                />
              </label>
            </div>

            <div className="io-actions io-actions--end">
              <button className="io-btn io-btn--ghost" onClick={() => setAdding(false)} type="button">
                Cancel
              </button>
              <button className="io-btn io-btn--solid" type="submit">
                Save address
              </button>
            </div>
          </form>
        </section>
      )}

      <section className="io-panel">
        <header className="io-panel__head">
          <div>
            <h3 className="io-panel__title">
              <Home aria-hidden size={16} strokeWidth={1.6} />
              {addresses.length} saved
            </h3>
            <p className="io-panel__note">
              The default is pre-selected at checkout and can be changed there too.
            </p>
          </div>
        </header>

        {addresses.length === 0 ? (
          <div className="io-empty">
            <strong>No saved addresses</strong>
            Add one now, or enter it at checkout and save it from there.
          </div>
        ) : (
          <div className="io-cards">
            {addresses.map((address) => (
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
                  {address.id !== defaultId && (
                    <button
                      className="io-btn io-btn--ghost io-btn--sm"
                      onClick={() => setDefault(address.id)}
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

            {!adding && (
              <button className="io-card io-card--dashed" onClick={() => setAdding(true)} type="button">
                <Plus aria-hidden size={22} strokeWidth={1.5} />
                Add another address
              </button>
            )}
          </div>
        )}
      </section>

      <AddressRemoveDialog
        address={removing}
        onOpenChange={(open) => {
          if (!open) setRemoving(null);
        }}
      />
    </AccountSection>
  );
}
