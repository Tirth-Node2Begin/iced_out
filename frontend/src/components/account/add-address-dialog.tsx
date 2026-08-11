"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useId, type FormEvent } from "react";

import { useAddresses } from "@/features/01-users/addresses-context";
import { useProfile } from "@/features/01-users/profile-context";

/**
 * Adding an address without leaving the profile.
 *
 * The Addresses tab has the same form inline, which is right for the tab whose
 * job is the whole book. Here the address is a detail on somebody else's page,
 * so it opens over it and hands the page back on save — going to another tab
 * and back to change one destination is the trip this exists to remove.
 *
 * The recipient and phone are seeded from the profile because that is who they
 * almost always are, and they stay editable because sometimes they are not.
 */
export function AddAddressDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { addresses, add } = useAddresses();
  const { profile } = useProfile();
  const formId = useId();

  /* An empty book has no default to keep, so the first address saved is it —
     the box says so rather than offering a choice that is not one. */
  const isFirst = addresses.length === 0;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    add(
      {
        label: String(form.get("label") ?? "New address"),
        name: String(form.get("name") ?? ""),
        lines: [
          String(form.get("street") ?? ""),
          `${form.get("city")}, ${form.get("state")} ${form.get("pincode")}`,
        ],
        phone: String(form.get("phone") ?? ""),
      },
      { makeDefault: isFirst || form.get("makeDefault") === "on" },
    );

    onOpenChange(false);
  }

  return (
    <Dialog.Root onOpenChange={onOpenChange} open={open}>
      <Dialog.Portal>
        <Dialog.Overlay className="io-modal__overlay" />
        <Dialog.Content className="io-modal">
          <div className="io-modal__head">
            <div>
              <Dialog.Title className="io-modal__title">New address</Dialog.Title>
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
            <form className="io-form" id={formId} onSubmit={submit}>
              <div className="io-form__row">
                <label className="io-field">
                  <span>Label</span>
                  <input name="label" placeholder="Home, Studio, Parents…" required />
                </label>
                <label className="io-field">
                  <span>Recipient</span>
                  <input defaultValue={profile.name} name="name" required />
                </label>
              </div>

              <label className="io-field">
                <span>Street and landmark</span>
                <input
                  name="street"
                  placeholder="12 Preview Street, near the depot"
                  required
                />
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
                    defaultValue={profile.mobile}
                    name="phone"
                    placeholder="+91 …"
                    required
                    type="tel"
                  />
                </label>
              </div>

              <label className="io-check">
                <input
                  defaultChecked={isFirst}
                  disabled={isFirst}
                  name="makeDefault"
                  type="checkbox"
                />
                <span>
                  Make this my default address
                  {isFirst && " — the first one saved always is."}
                </span>
              </label>
            </form>
          </div>

          <div className="io-modal__foot">
            <Dialog.Close className="io-btn io-btn--ghost">Cancel</Dialog.Close>
            <button className="io-btn io-btn--solid" form={formId} type="submit">
              Save address
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
