"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useId, type FormEvent } from "react";

import {
  addressToFields,
  EMPTY_ADDRESS_FIELDS,
  fieldsToAddress,
  formDataToFields,
} from "@/features/01-users/address-fields";
import { useAddresses, type Address } from "@/features/01-users/addresses-context";
import { useProfile } from "@/features/01-users/profile-context";

/**
 * Adding or correcting an address without leaving the profile.
 *
 * The Addresses tab has the same form inline, which is right for the tab whose
 * job is the whole book. Here the address is a detail on somebody else's page,
 * so it opens over it and hands the page back on save — going to another tab
 * and back to change one destination is the trip this exists to remove.
 *
 * One dialog does both jobs because they are the same seven fields: passing an
 * `address` fills them from it and saves over it, passing none opens blank. A
 * separate edit dialog would be this file with different default values and a
 * second place to fix whenever the form grows a field.
 *
 * The recipient and phone are seeded from the profile because that is who they
 * almost always are, and they stay editable because sometimes they are not.
 */
export function AddressDialog({
  open,
  onOpenChange,
  address = null,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The address being corrected, or null to add a new one. */
  address?: Address | null;
  onSaved?: (address: Omit<Address, "id">, mode: "added" | "updated") => void;
}) {
  const { addresses, defaultId, add, update } = useAddresses();
  const { profile } = useProfile();
  const formId = useId();

  const editing = address !== null;
  const fields = address ? addressToFields(address) : EMPTY_ADDRESS_FIELDS;

  /* An empty book has no default to keep, so the first address saved is it —
     the box says so rather than offering a choice that is not one. The address
     that already IS the default gets the same treatment for the same reason:
     the only way out of being default is another address taking the title. */
  const isFirst = addresses.length === 0;
  const isDefault = editing && address.id === defaultId;
  const defaultIsFixed = isFirst || isDefault;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const next = fieldsToAddress(formDataToFields(form));
    const makeDefault = defaultIsFixed || form.get("makeDefault") === "on";

    if (editing) {
      update(address.id, next, { makeDefault });
    } else {
      add(next, { makeDefault });
    }

    onOpenChange(false);
    onSaved?.(next, editing ? "updated" : "added");
  }

  return (
    <Dialog.Root onOpenChange={onOpenChange} open={open}>
      <Dialog.Portal>
        <Dialog.Overlay className="io-modal__overlay" />
        <Dialog.Content className="io-modal">
          <div className="io-modal__head">
            <div>
              <Dialog.Title className="io-modal__title">
                {editing ? "Edit address" : "New address"}
              </Dialog.Title>
              <Dialog.Description className="io-modal__note">
                A landmark in the street line reaches the courier; a flat number alone
                often does not.
              </Dialog.Description>
            </div>
            <Dialog.Close aria-label="Close" className="io-modal__close">
              <X aria-hidden size={18} />
            </Dialog.Close>
          </div>

          <div className="io-modal__body">
            {/* Keyed so re-opening the dialog on a different address re-seeds
                the uncontrolled inputs — without it the second edit opens
                holding the first one's street. */}
            <form className="io-form" id={formId} key={address?.id ?? "new"} onSubmit={submit}>
              <div className="io-form__row">
                <label className="io-field">
                  <span>Label</span>
                  <input
                    defaultValue={fields.label}
                    name="label"
                    placeholder="Home, Studio, Parents…"
                    required
                  />
                </label>
                <label className="io-field">
                  <span>Recipient</span>
                  <input defaultValue={fields.name || profile.name} name="name" required />
                </label>
              </div>

              <label className="io-field">
                <span>Street and landmark</span>
                <input
                  defaultValue={fields.street}
                  name="street"
                  placeholder="12 Preview Street, near the depot"
                  required
                />
              </label>

              <div className="io-form__row">
                <label className="io-field">
                  <span>City</span>
                  <input defaultValue={fields.city} name="city" placeholder="Bengaluru" required />
                </label>
                <label className="io-field">
                  <span>State</span>
                  <input
                    defaultValue={fields.state}
                    name="state"
                    placeholder="Karnataka"
                    required
                  />
                </label>
              </div>

              <div className="io-form__row">
                <label className="io-field">
                  <span>Pincode</span>
                  <input
                    defaultValue={fields.pincode}
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
                    defaultValue={fields.phone || profile.mobile}
                    name="phone"
                    placeholder="+91 …"
                    required
                    type="tel"
                  />
                </label>
              </div>

              <label className="io-check">
                <input
                  defaultChecked={defaultIsFixed}
                  disabled={defaultIsFixed}
                  name="makeDefault"
                  type="checkbox"
                />
                <span>
                  Make this my default address
                  {isFirst && " — the first one saved always is."}
                  {isDefault && " — it already is. Pick another one to move it."}
                </span>
              </label>
            </form>
          </div>

          <div className="io-modal__foot">
            <Dialog.Close className="io-btn io-btn--ghost">Cancel</Dialog.Close>
            <button className="io-btn io-btn--solid" form={formId} type="submit">
              {editing ? "Save changes" : "Save address"}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
