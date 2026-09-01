"use client";

import { Boxes, ClipboardCheck, ShoppingBag, Users, X, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useCallback, useState } from "react";

import { useHydrated } from "@/lib/use-hydrated";

/**
 * The first thing a new operator sees, and the only screen written for someone
 * who has never used this console before.
 *
 * The console assumes a lot: that you know a "queue" is work waiting on you,
 * that the rail down the left is the whole business, that publishing a product
 * is what puts it on the shop. Someone who runs the shop but does not work in
 * software knows none of that on their first morning, and the dashboard they
 * land on is a wall of figures that are all zero until they do something —
 * which is precisely when they most need to be told what that something is.
 *
 * So: four things, in the order they have to happen. A product cannot be sold
 * before it exists, cannot ship before there is stock, and there are no orders
 * or customers to look at until both are true. That dependency IS the order of
 * the cards, which is why they are numbered rather than merely listed.
 *
 * It disappears for good once dismissed, and it is deliberately not shown again
 * on a schedule — a banner that comes back is a banner people learn to ignore.
 */

const DISMISS_KEY = "iced_crm_start_here_dismissed";

type Step = {
  href: string;
  icon: LucideIcon;
  title: string;
  copy: string;
};

const STEPS: Step[] = [
  {
    href: "/catalog/products",
    icon: Boxes,
    title: "Put something up for sale",
    copy: "Add a product, give it a price and press Publish. It goes on the shop straight away.",
  },
  {
    href: "/inventory/overview",
    icon: ClipboardCheck,
    title: "Say how many you have",
    copy: "Enter how many pieces sit in each warehouse. The shop stops selling an item when it runs out.",
  },
  {
    href: "/orders",
    icon: ShoppingBag,
    title: "Deal with an order",
    copy: "Confirm what somebody bought, then send it out. The customer is told at every step.",
  },
  {
    href: "/customers",
    icon: Users,
    title: "Look a customer up",
    copy: "Everyone who has an account, and everything each of them has ever ordered.",
  },
];

export function StartHere() {
  /* Client-only: the export was built with nobody signed in, so the server's
     markup cannot know whether this was dismissed. Reading in the initializer
     rather than an effect keeps it to one paint — but `hydrated` below is what
     actually guards the first render, so the two never disagree. */
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return window.localStorage.getItem(DISMISS_KEY) === "1";
    } catch {
      /* Private window, or site data blocked. Showing the guide is the right
         answer to "we could not find out" — the cost is one dismissal, and the
         cost of the other guess is a new operator never seeing it at all. */
      return false;
    }
  });

  const hydrated = useHydrated();

  const dismiss = useCallback(() => {
    setDismissed(true);
    try {
      window.localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* Same as the read: the preference simply does not persist. */
    }
  }, []);

  if (!hydrated || dismissed) return null;

  /* The same page frame every console screen uses, so the card's edges line up
     with the dashboard's below it and with the bar above. `aui-page__body`
     carries the top padding, which is what keeps the rhythm between this and
     the section that follows equal to the gap between any other two. */
  return (
    <div className="aui-page">
      <div className="aui-page__wrap">
        <div className="aui-page__body">
          <section aria-labelledby="start-here-title" className="aui-start">
            <div className="aui-start__head">
              <div>
                <p className="aui-start__eyebrow">New here</p>
                <h2 className="aui-start__title" id="start-here-title">
                  Start with these four
                </h2>
                <p className="aui-start__copy">
                  This console runs the shop — everything you change here shows on the website, so
                  there is nowhere else to sign in. Work down the list and the figures below fill
                  themselves in.
                </p>
              </div>
              <button className="aui-start__close" onClick={dismiss} type="button">
                <X aria-hidden size={14} strokeWidth={1.6} />
                <span>Hide this</span>
              </button>
            </div>

            <ol className="aui-start__grid">
              {STEPS.map((step, index) => (
                <li key={step.href}>
                  <Link className="aui-start__card" href={step.href}>
                    <span aria-hidden className="aui-start__num">
                      {index + 1}
                    </span>
                    <span className="aui-start__glyph">
                      <step.icon aria-hidden size={17} strokeWidth={1.5} />
                    </span>
                    <span className="aui-start__label">{step.title}</span>
                    <span className="aui-start__hint">{step.copy}</span>
                  </Link>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </div>
    </div>
  );
}
