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

import { toneVars } from "@/components/admin/admin-ui";
import {
  ageLabel,
  PULSE_LIMIT,
  signalAt,
  standingSignals,
  type Signal,
  type SignalKind,
} from "@/features/15-dashboard/data/operations-pulse";

/**
 * The bell, and the drawer behind it.
 *
 * Both live in one component because they are one fact: the number on the bell
 * is how much of the drawer has not been read, and there is no way to keep
 * those honest from two places. The shell used to hold a three-line constant
 * and a badge that printed its length, which is a badge that can never be wrong
 * and can also never be right.
 *
 * Three decisions carried over from the activity feed, for the same reasons:
 *
 *   1. ONE interval. The clock and the arriving signal are minted in the same
 *      callback off refs, rather than a timer effect plus a second effect
 *      watching it — that second effect is a synchronous setState in an effect
 *      body, which is both a cascading render and a lint error in this repo.
 *   2. It idles when the tab is hidden. Nobody is reading a background tab, and
 *      a drawer that mints a signal every twenty seconds forever would greet a
 *      returning operator with a badge in the hundreds and nothing behind it.
 *   3. Age is counted from the pulse's own clock, never from `Date`. See the
 *      note on the data module.
 *
 * The count is UNREAD, not total. Opening the drawer is the acknowledgement —
 * there is no "mark all read" button, because the only way to reach the button
 * is to open the thing that would have cleared it anyway.
 */

/** How often the clock moves, and how many of those before a signal lands. */
const TICK_SECONDS = 5;
const TICKS_PER_SIGNAL = 4;

/** The glyph each kind wears. One icon per area, matching the rail's. */
const GLYPH: Record<SignalKind, LucideIcon> = {
  order: ShoppingBag,
  payment: CircleDollarSign,
  shipment: Truck,
  inventory: Boxes,
  return: Undo2,
  support: Headphones,
  review: Star,
};

const STANDING = standingSignals();

export function PulseBell() {
  const [open, setOpen] = useState(false);
  const [signals, setSignals] = useState<Signal[]>(STANDING);
  const [clock, setClock] = useState(0);
  const [watching, setWatching] = useState(true);
  /** Signals that have arrived since the drawer was last opened. It starts full:
      a backlog nobody has read yet is exactly what the badge is for. */
  const [unread, setUnread] = useState(STANDING.length);
  /** How many at the head of the list still wear the new-signal mark.
      Held apart from `unread` so opening the drawer can clear the BADGE without
      also erasing, in the same frame, the only clue as to which lines are the
      ones you came in to read. */
  const [fresh, setFresh] = useState(STANDING.length);

  /* Counters, not state: nothing renders them, and holding them in refs is
     what keeps the interval free of a stale closure over its own tick. */
  const ticks = useRef(0);
  const minted = useRef(STANDING.length);
  const openRef = useRef(false);

  useEffect(() => {
    const onVisibility = () => setWatching(!document.hidden);
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  useEffect(() => {
    if (!watching) return;

    const timer = setInterval(() => {
      ticks.current += 1;
      const seconds = ticks.current * TICK_SECONDS;
      setClock(seconds);

      if (ticks.current % TICKS_PER_SIGNAL !== 0) return;

      const signal = signalAt(minted.current, seconds);
      minted.current += 1;
      setSignals((prev) => [signal, ...prev].slice(0, PULSE_LIMIT));
      /* Arriving into an open drawer is arriving read: the operator is looking
         straight at it, and a badge that ticks up while you watch the line
         appear is a badge nobody trusts again. */
      setFresh((count) => count + 1);
      if (!openRef.current) setUnread((count) => count + 1);
    }, TICK_SECONDS * 1_000);

    return () => clearInterval(timer);
  }, [watching]);

  function onOpenChange(next: boolean) {
    openRef.current = next;
    setOpen(next);
    if (!next) return;
    /* Reading `unread` from the render rather than from inside the setter: a
       side effect in a state updater runs twice under Strict Mode. */
    setFresh(unread);
    setUnread(0);
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
                const Icon = GLYPH[signal.kind];
                return (
                  <Link
                    className="aui-pulse"
                    /* Unread runs down from the top: the list is newest-first
                       and only ever grows at the head. */
                    data-unread={index < fresh ? "true" : undefined}
                    href={signal.href}
                    key={signal.id}
                    onClick={() => onOpenChange(false)}
                    style={toneVars(signal.tone)}
                  >
                    <span className="aui-pulse__glyph">
                      <Icon aria-hidden size={16} strokeWidth={1.7} />
                    </span>
                    <div>
                      <strong>{signal.title}</strong>
                      <p>{signal.detail}</p>
                      <small>{ageLabel(signal.offset + clock - signal.born)}</small>
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
                href="/admin"
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
