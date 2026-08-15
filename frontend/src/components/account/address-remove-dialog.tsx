"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";

import { useAddresses, type Address } from "@/features/01-users/addresses-context";

/**
 * Removing a saved address.
 *
 * The question used to be asked inside the card, in the space the buttons were
 * standing in. That put a sentence and two answers into a box sized for a
 * street, and in a row of cards it moved its neighbours to make room. It asks
 * over the page now, like every other question this account asks.
 *
 * The address is printed back in full rather than named: "Remove Home?" is a
 * label, and the labels are typed by the shopper — two of them can read the
 * same. The lines are the thing being lost, so the lines are what is shown.
 *
 * What happens next is stated, not implied: which address takes over as the
 * default, or that the book is about to be empty.
 */
export function AddressRemoveDialog({
  address,
  onOpenChange,
  onRemoved,
}: {
  /** The address being removed, or null when the dialog is closed. */
  address: Address | null;
  onOpenChange: (open: boolean) => void;
  onRemoved?: (address: Address) => void;
}) {
  const { addresses, defaultId, remove } = useAddresses();

  /* Read while the dialog is open, so the sentence describes this book rather
     than the one it had when the page mounted. */
  const wasDefault = address !== null && address.id === defaultId;
  const successor = addresses.find((entry) => entry.id !== address?.id);

  function confirm() {
    if (!address) return;
    remove(address.id);
    onOpenChange(false);
    onRemoved?.(address);
  }

  return (
    <Dialog.Root onOpenChange={onOpenChange} open={address !== null}>
      <Dialog.Portal>
        <Dialog.Overlay className="io-modal__overlay" />
        <Dialog.Content className="io-modal io-modal--ask">
          <div className="io-modal__head">
            <div>
              <Dialog.Title className="io-modal__title">Remove this address?</Dialog.Title>
              <Dialog.Description className="io-modal__note">
                It goes out of your book on this device. Orders already placed keep the
                address they were sent to.
              </Dialog.Description>
            </div>
            <Dialog.Close aria-label="Close" className="io-modal__close">
              <X aria-hidden size={18} />
            </Dialog.Close>
          </div>

          <div className="io-modal__body">
            {address && (
              <div className="io-card io-card--quiet">
                <div className="io-card__head">
                  <h4 className="io-card__title">{address.label}</h4>
                  {wasDefault && <span className="io-badge io-badge--ok">Default</span>}
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
              </div>
            )}

            {wasDefault && successor && (
              <p className="io-modal__aside">
                <strong>{successor.label}</strong> becomes your default, and checkout will
                pre-select it.
              </p>
            )}
            {!successor && (
              <p className="io-modal__aside">
                This is the last one — checkout will ask for an address next time.
              </p>
            )}
          </div>

          <div className="io-modal__foot">
            <Dialog.Close className="io-btn io-btn--ghost">Keep it</Dialog.Close>
            <button className="io-btn io-btn--solid" onClick={confirm} type="button">
              Remove address
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
