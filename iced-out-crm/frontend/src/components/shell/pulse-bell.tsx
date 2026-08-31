"use client";

import * as Dialog from "@radix-ui/react-dialog";
import {
  ArrowRight,
  Bell,
  Boxes,
  CircleDollarSign,
  Headphones,
  ShoppingBag,
  Star,
  Truck,
  Undo2,
  X,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { toneVars, type Tone } from "@/components/shell/admin-ui";
import { usePulse } from "@/features/15-dashboard/dashboard-api";

/**
 * The bell, and the drawer behind it.
 *
 * Both live in one component because they are one fact: the number on the bell
 * is how much of the drawer has not been read, and there is no way to keep
 * those honest from two places. The shell used to hold a three-line constant
 * and a badge that printed its length, which is a badge that can never be wrong
 * and can also never be right.
 *
 * Two decisions carried over, for their original reasons:
 *
 *   1. It idles when the tab is hidden. Nobody is reading a background tab, and
 *      polling forever for a screen nobody is looking at is waste.
 *      (That now lives in the pulse store's own poll.)
 *   2. The count is UNREAD, not total. Opening the drawer is the acknowledgement —
 *      there is no "mark all read" button, because the only way to reach the
 *      button is to open the thing that would have cleared it anyway.
 *
 * What is gone is the generator. This used to MINT a signal every twenty seconds
 * — "payment exception on IO-2026-1043", for an order that did not exist — so the
 * badge on an idle console climbed forever and every line behind it was invented.
 * The signals now come from `/admin/dashboard/pulse`, which reads `ops_signals`.
 * A store with nothing wrong shows an empty drawer, which is the point of it.
 */

/** The glyph each kind wears. One icon per area, matching the rail's. */
const GLYPH: Record<string, LucideIcon> = {
  order: ShoppingBag,
  payment: CircleDollarSign,
  shipment: Truck,
  inventory: Boxes,
  return: Undo2,
  support: Headphones,
  review: Star,
};

/**
 * The tone strings `ops_signals.tone` holds, narrowed to what the stylesheet has
 * variables for. An unrecognised one falls back rather than reaching `toneVars`
 * as a string it cannot resolve — a signal with a typo in its tone should still
 * be readable.
 */
const TONES = new Set<Tone>(["ink", "mint", "amber", "rose", "sky", "violet"]);

function toneOf(value: string): Tone {
  return TONES.has(value as Tone) ? (value as Tone) : "ink";
}

/** A duration, in the shortest words that are true. */
function ageLabel(seconds: number): string {
  if (seconds < 45) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export function PulseBell() {
  const [open, setOpen] = useState(false);
  const { signals } = usePulse();

  /**
   * How many signals had been seen the last time the drawer was open.
   *
   * The badge is `signals.length - seen`, derived rather than counted up by a
   * timer: the list is server-owned and newest-first, so "how many are new" is a
   * question about its length, and a separately-incremented counter could drift
   * from it after a failed poll.
   */
  const [seen, setSeen] = useState(0);
  /** How many at the head still wear the new-signal mark. Held apart from the
      badge so opening the drawer can clear the COUNT without erasing, in the same
      frame, the only clue as to which lines are the ones you came in to read. */
  const [fresh, setFresh] = useState(0);

  const unread = Math.max(0, signals.length - seen);

  /* A signal list that SHRANK — a resolved exception dropping off — must not
     leave `seen` above its length, or the badge stays dark after the next arrival.
     Clamped in a ref-free effect because it is a correction to state, not a
     render-time derivation. */
  const length = useRef(signals.length);

  useEffect(() => {
    if (signals.length < length.current) setSeen((count) => Math.min(count, signals.length));
    length.current = signals.length;
  }, [signals.length]);

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (!next) return;
    /* The lines that were unread on the way in stay marked while it is open. */
    setFresh(unread);
    setSeen(signals.length);
  }

  return (
    <>
      <button
        aria-label={
          unread ? `Open notifications, ${unread} unread` : "Open notifications, none unread"
        }
        className="aui-bell"
        onClick={() => onOpenChange(true)}
        type="button"
      >
        <Bell aria-hidden size={16} strokeWidth={1.7} />
        {unread > 0 && <b>{unread > 99 ? "99+" : unread}</b>}
      </button>

      <Dialog.Root onOpenChange={onOpenChange} open={open}>
        <Dialog.Portal>
          <Dialog.Overlay className="aui-overlay" />
          <Dialog.Content className="aui-drawer">
            <div className="aui-modal__head">
              <div>
                <Dialog.Title asChild>
                  <h2>Operations pulse</h2>
                </Dialog.Title>
                <Dialog.Description asChild>
                  <p>
                    {signals.length === 1
                      ? "One signal that needs awareness, not panic."
                      : `${signals.length} signals that need awareness, not panic.`}
                  </p>
                </Dialog.Description>
              </div>
              <Dialog.Close aria-label="Close notifications" className="aui-modal__close">
                <X aria-hidden size={16} strokeWidth={1.8} />
              </Dialog.Close>
            </div>

            <div className="aui-drawer__list">
              {signals.map((signal, index) => {
                const Icon = GLYPH[signal.kind] ?? ShoppingBag;
                return (
                  <Link
                    className="aui-pulse"
                    /* Unread runs down from the top: the list is newest-first
                       and only ever grows at the head. */
                    data-unread={index < fresh ? "true" : undefined}
                    href={signal.href}
                    key={signal.id}
                    onClick={() => onOpenChange(false)}
                    style={toneVars(toneOf(signal.tone))}
                  >
                    <span className="aui-pulse__glyph">
                      <Icon aria-hidden size={16} strokeWidth={1.7} />
                    </span>
                    <div>
                      <strong>{signal.title}</strong>
                      <p>{signal.detail}</p>
                      <small>{ageLabel(signal.offset)}</small>
                    </div>
                    <ArrowRight aria-hidden className="aui-pulse__go" size={14} strokeWidth={1.7} />
                  </Link>
                );
              })}

              {!signals.length && (
                <p className="aui-drawer__empty">Nothing needs you right now.</p>
              )}
            </div>

            <div className="aui-modal__foot">
              <p>
                <span className="aui-dot" /> Live
              </p>
              <Link
                className="aui-btn aui-btn--ghost aui-btn--sm"
                href="/"
                onClick={() => onOpenChange(false)}
              >
                Open dashboard <ArrowRight aria-hidden size={14} strokeWidth={1.7} />
              </Link>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
