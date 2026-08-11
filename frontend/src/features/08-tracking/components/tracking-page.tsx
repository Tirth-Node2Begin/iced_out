"use client";

/* ============================================================================
   The public shipment view
   ----------------------------------------------------------------------------
   Three blocks: the status ground, the route, and the way to a human. The old
   screen also carried an origin→destination "route map" widget and a second
   copy of the completion bar; both restated what the timeline and the meter
   already say, so neither survived. A tracking page is read in ten seconds on
   a phone — anything that is not "where is it, when does it land, what do I do
   about it" is in the way.

   Two rules from the previous build are kept because they are correctness, not
   styling: nothing claims progress the record does not show, and no customer
   name, address, mobile or payment data appears on a link that is meant to be
   forwarded to whoever is home.

   Look comes from `new_style.md` via `tracking.css` under `.tk-root`; structure
   comes from the shadcn registry (item, progress, badge, button) with the token
   bridge doing the theming. Motion is the §6.1 house entrance only.
   ========================================================================= */

import {
  ArrowLeft,
  ArrowUpRight,
  Check,
  CircleDashed,
  Clock3,
  Hash,
  LockKeyhole,
  MapPin,
  Radio,
  Truck,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/features/20-auth-security/auth-context";
import type { TrackingFixture } from "@/features/08-tracking/data/tracking-fixtures";

/** §4.3 — the house curve, the only easing on the page. */
export const EASE_OUT = [0.22, 1, 0.36, 1] as const;

/** §6.1 `Reveal` — the one entrance this page uses. */
export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();

  return (
    <motion.div
      className={className}
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 26 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: reduce ? 0.2 : 0.72, delay, ease: EASE_OUT }}
    >
      {children}
    </motion.div>
  );
}

/**
 * Where "back" goes from a shipment.
 *
 * A tracking link is public and forwardable, so the parent depends on who is
 * holding it: a signed-in shopper came from their orders, anyone else came from
 * the shop or from a pasted link and has no orders list to be sent to. The
 * session store's server snapshot is `false`, so the anonymous target is what
 * the exported HTML carries and hydration agrees before it re-reads.
 */
export function TrackingBack() {
  const { isAuthenticated, sessionReady } = useAuth();
  const signedIn = sessionReady && isAuthenticated;
  const back = signedIn
    ? { href: "/account/orders" as const, label: "Your orders" }
    : { href: "/" as const, label: "Iced_out" };

  return (
    <Link
      aria-label={`Go back to ${back.label}`}
      className="tk-back"
      href={back.href}
    >
      <ArrowLeft aria-hidden />
      Go back
      <span>{back.label}</span>
    </Link>
  );
}

/**
 * Splits the estimate into the two cuts of the §3.2 headline.
 *
 * `Expected 08–09 Aug` → heavy `EXPECTED` + light `08–09 Aug`. The estimate is
 * the one thing everybody opens this page for, so it is the headline rather
 * than the status word the old screen led with — "Processing." told a shopper
 * nothing they could act on.
 */
function splitEstimate(estimate: string) {
  const match = /^(expected|delivered|arriving)\b[\s·]*(.*)$/i.exec(estimate.trim());
  if (match && match[2]) return { lead: match[1], rest: match[2] };
  return { lead: "Arriving", rest: estimate };
}

export function TrackingPage({ tracking }: { tracking: TrackingFixture }) {
  const total = tracking.events.length;
  const done = tracking.events.filter((event) => event.complete).length;
  const progress = Math.round((done / total) * 100);
  /* A carrier signal is only live once a carrier actually holds the parcel. */
  const moving = tracking.status !== "Processing";
  /* The first step that has not happened is the one the parcel is waiting on. */
  const currentIndex = tracking.events.findIndex((event) => !event.complete);
  const { lead, rest } = splitEstimate(tracking.estimate);

  /* Everything the header does not already say, in the order it gets asked
     about. The header carries the date and the two numbers; these are the
     details behind them. */
  const facts = [
    { icon: Radio, k: "Status", v: tracking.status },
    { icon: MapPin, k: "Destination", v: tracking.destination },
    { icon: Truck, k: "Carrier", v: tracking.carrier },
    { icon: Hash, k: "Reference", v: tracking.awb },
    {
      icon: Clock3,
      k: "Last update",
      v: moving ? "Synced 2 min ago" : "Updates on dispatch",
    },
  ];

  return (
    <div className="tk-root">
      {/* ---------------------------------------------------- 01 · header */}
      <header className="tk-head">
        <div className="tk-shell">
          <TrackingBack />

          <div className="tk-head__top">
            <span className="tk-eyebrow">Shipment tracking</span>
            <span className="tk-head__id">Order {tracking.order}</span>
          </div>

          {/* the dot is the signal — an icon beside it reads as a second one */}
          <Badge className="tk-live" data-live={moving}>
            <span className="tk-live__dot" aria-hidden />
            {moving ? "Live carrier signal" : "Awaiting first carrier scan"}
          </Badge>

          <div className="tk-head__row">
            <h1 className="tk-display tk-head__title">
              {lead} <em>{rest}</em>
            </h1>

            <div className="tk-head__stats">
              <div className="tk-stat">
                <span className="tk-stat__k">Steps</span>
                <span className="tk-stat__v">
                  {String(done).padStart(2, "0")}/{String(total).padStart(2, "0")}
                </span>
              </div>
              <div className="tk-stat">
                <span className="tk-stat__k">Route</span>
                <span className="tk-stat__v">{progress}%</span>
              </div>
            </div>
          </div>

          <p className="tk-body tk-head__sub">
            {tracking.status === "Delivered"
              ? "This parcel has been handed over and the route is closed."
              : "Nothing below is marked done before it happens."}{" "}
            This public view carries no name, address, mobile number or payment
            detail.
          </p>
        </div>
      </header>

      {/* ----------------------------------------------------- 02 · route */}
      <section className="tk-section" id="route">
        <div className="tk-shell">
          <div className="tk-work">
            <Reveal>
              <div className="tk-panel">
                <div className="tk-panel__pad">
                  <div className="tk-panelHead">
                    <span className="tk-eyebrow">Route</span>
                    <span className="tk-panelHead__note">
                      Newest event last · times are IST
                    </span>
                  </div>

                  <ol className="tk-steps">
                    {tracking.events.map((event, i) => (
                      <li
                        className="tk-step"
                        key={event.label}
                        data-done={event.complete}
                        data-current={i === currentIndex}
                      >
                        <span className="tk-step__dot" aria-hidden>
                          {event.complete ? <Check /> : <CircleDashed />}
                        </span>
                        <div className="tk-step__body">
                          <h2 className="tk-step__label">{event.label}</h2>
                          <p className="tk-step__detail">{event.detail}</p>
                          <span className="tk-step__time">{event.time}</span>
                        </div>
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
            </Reveal>

            <Reveal delay={0.08} className="tk-aside">
              <div className="tk-panel">
                <div className="tk-panel__pad">
                  <div className="tk-ref">
                    <span className="tk-eyebrow">Shipment reference</span>
                    <span className="tk-ref__v">{tracking.order}</span>
                  </div>

                  <div className="tk-meter">
                    <div className="tk-meter__head">
                      <span className="tk-meter__k">Route complete</span>
                      <span className="tk-meter__v">
                        {done} of {total} steps
                      </span>
                    </div>
                    <Progress value={progress} aria-label="Route completion" />
                  </div>

                  <div className="tk-facts">
                    {facts.map(({ icon: Icon, k, v }) => (
                      <Item className="tk-fact" key={k}>
                        <ItemMedia>
                          <Icon aria-hidden />
                        </ItemMedia>
                        <ItemContent>
                          <ItemTitle>{v}</ItemTitle>
                          <ItemDescription>{k}</ItemDescription>
                        </ItemContent>
                      </Item>
                    ))}
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ----------------------------------------------------- 03 · close */}
      <section className="tk-section" id="support">
        <div className="tk-shell">
          <Reveal>
            <div className="tk-panel">
              <div className="tk-panel__pad">
                <div className="tk-close">
                  <div className="tk-close__copy">
                    <span className="tk-close__k">
                      <LockKeyhole aria-hidden />
                      About this link
                    </span>
                    <p>
                      Anyone holding this link can see the route above and nothing
                      else. Tokens will be hashed, revocable and rate-limited once
                      the carrier API lands. If the parcel is late or the route
                      looks wrong, the desk answers within two business days.
                    </p>
                  </div>

                  <Button className="tk-cta" asChild>
                    <Link href="/contact">
                      Delivery support
                      <span className="tk-cta__go" aria-hidden>
                        <ArrowUpRight />
                      </span>
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>
    </div>
  );
}
