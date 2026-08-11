"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";

import { ProductImage } from "@/components/commerce/product-image";
import { formatPrice } from "@/features/02-products";
import type { CartLine } from "@/types/commerce";

/**
 * The whole bag, when the summary can only show the top of it.
 *
 * The summary used to hold every line inside a 268px scroller, which is the one
 * thing a checkout column must not be: a list that hides its own end behind a
 * gesture, beside a total the shopper is trying to reconcile against it. It now
 * shows the first few and hands the rest to this.
 *
 * It lays out in COLUMNS rather than one long list, which is the whole point —
 * a grid of 240px cards fits a normal bag on one surface with nothing to scroll,
 * so "see everything" means seeing everything rather than scrolling somewhere
 * else instead.
 */
export function BagDialog({
  itemCount,
  lines,
  onOpenChange,
  open,
  subtotal,
}: {
  itemCount: number;
  lines: CartLine[];
  onOpenChange: (open: boolean) => void;
  open: boolean;
  subtotal: number;
}) {
  return (
    <Dialog.Root onOpenChange={onOpenChange} open={open}>
      <Dialog.Portal>
        {/* `--top`, because this opens over the checkout modal — see the layer
            note in checkout.css §0. */}
        <Dialog.Overlay className="io-modal__overlay io-modal__overlay--top" />
        <Dialog.Content className="io-modal io-modal--wide">
          <div className="io-modal__head">
            <div>
              <Dialog.Title className="io-modal__title">Your bag</Dialog.Title>
              <Dialog.Description className="io-modal__note">
                {itemCount} {itemCount === 1 ? "piece" : "pieces"} · {formatPrice(subtotal)} before
                delivery
              </Dialog.Description>
            </div>
            <Dialog.Close aria-label="Close" className="io-modal__close">
              <X aria-hidden size={18} />
            </Dialog.Close>
          </div>

          <div className="io-modal__body co-bag">
            {lines.map((line) => (
              <article className="co-bag__line" key={`${line.product.id}-${line.size}`}>
                <span className="co-summary__media">
                  <ProductImage position={line.product.imagePosition} />
                  <i>{line.quantity}</i>
                </span>
                <span className="co-bag__body">
                  <strong>{line.product.name}</strong>
                  <small>
                    {line.product.color} · Size {line.size}
                  </small>
                  <b>{formatPrice(line.product.price * line.quantity)}</b>
                </span>
              </article>
            ))}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
