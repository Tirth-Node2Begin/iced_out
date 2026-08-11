"use client";

import {
  Bell,
  Heart,
  LifeBuoy,
  LockKeyhole,
  MapPin,
  MessageSquareText,
  Package,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { PageFrame } from "@/components/layout/page-frame";
import { useAddresses } from "@/features/01-users/addresses-context";
import { useProfile } from "@/features/01-users/profile-context";
import { useOrders } from "@/features/07-orders/orders-context";
import { useCart } from "@/features/04-cart/cart-context";
import { useWishlist } from "@/features/05-wishlist/wishlist-context";

/**
 * The frame every `/account` route is served in.
 *
 * `title` is the word the page's headline ends on, so each section reads as
 * one sentence — "Your orders", "Your security" — rather than a breadcrumb
 * pasted above a heading.
 *
 * The rail is two cards rather than a column of links floating on the page:
 * who the session belongs to, then where it can go. `count` is only declared
 * where the app can actually prove a number — everything else stays a label.
 *
 * Profile leads, and there is no "Overview" above it: the landing screen was a
 * table of contents for a menu already on the page, and every figure it printed
 * is printed by the frame or owned by the tab it linked to.
 */
const ROOT = "/account/profile";

const LINKS = [
  { href: ROOT, label: "Profile", title: "profile", icon: UserRound },
  { href: "/account/orders", label: "Orders", title: "orders", icon: Package, count: "orders" },
  { href: "/account/wishlist", label: "Saved", title: "saved pieces", icon: Heart, count: "saved" },
  { href: "/account/addresses", label: "Addresses", title: "addresses", icon: MapPin },
  { href: "/account/feedback", label: "Feedback", title: "feedback", icon: MessageSquareText },
  { href: "/account/notifications", label: "Notifications", title: "notifications", icon: Bell },
  { href: "/account/support", label: "Support", title: "support", icon: LifeBuoy },
  { href: "/account/security", label: "Security", title: "security", icon: LockKeyhole },
] as const;

/** Routes with a headline but no rail entry — a return is opened from an order,
    never from the menu, and without this it inherited "Your account". */
const EXTRA_TITLES = [{ href: "/account/returns", title: "return" }];

/**
 * Where "go back" goes, for every account screen except the landing one.
 *
 * Dropping the last path segment is nearly right and wrong in exactly the
 * places that matter: `/account/returns/new` would climb to `/account/returns`,
 * which is not a page — a return is opened from an order, so that is where
 * leaving one puts you. Anything else one level down goes home to the profile.
 */
const BACK_EXCEPTIONS: Array<{ prefix: string; href: string; label: string }> = [
  { prefix: "/account/orders/", href: "/account/orders", label: "Orders" },
  { prefix: "/account/returns", href: "/account/orders", label: "Orders" },
];

/** `/account` is the redirect into the profile, so it counts as the root too. */
const ROOTS = new Set([ROOT, `${ROOT}/`, "/account", "/account/"]);

function backFor(pathname: string) {
  // The landing screen has nowhere above it inside the account.
  if (ROOTS.has(pathname)) return undefined;

  const exception = BACK_EXCEPTIONS.find((entry) => pathname.startsWith(entry.prefix));
  return exception ?? { href: ROOT, label: "Your profile" };
}

function isCurrent(href: string, pathname: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AccountShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { itemCount } = useCart();
  const { productIds: saved } = useWishlist();
  const { orders } = useOrders();
  const { profile, initials } = useProfile();
  const { defaultAddress } = useAddresses();

  const counts = { orders: orders.length, saved: saved.length };

  /* Newest first, so this is the order just placed rather than the oldest
     fixture that happens to be compiled in. */
  const latest = orders[0];
  const title =
    LINKS.find((link) => isCurrent(link.href, pathname))?.title ??
    EXTRA_TITLES.find((entry) => isCurrent(entry.href, pathname))?.title ??
    LINKS[0].title;

  return (
    <PageFrame
      back={backFor(pathname)}
      eyebrow="Profile"
      spec={[
        /* Three numbers the app can actually prove — two of them live. */
        { label: "Orders", value: String(orders.length).padStart(2, "0") },
        { label: "In bag", value: String(itemCount).padStart(2, "0") },
        { label: "Saved", value: String(saved.length).padStart(2, "0") },
      ]}
      title={
        <>
          Your <em>{title}</em>
        </>
      }
    >
      <div className="io-profile">
        <aside className="io-side">
          <div className="io-identity">
            <div className="io-identity__top">
              {/* Plain <img>: the source is a data URL written this session, so
                  there is nothing for the image pipeline to optimise. */}
              {profile.photo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img alt="" className="io-identity__photo" src={profile.photo} />
              ) : (
                <span aria-hidden className="io-identity__avatar">
                  {initials}
                </span>
              )}
              <div>
                <p className="io-identity__name">{profile.name}</p>
                <p className="io-identity__state">
                  <ShieldCheck aria-hidden size={11} strokeWidth={1.8} />
                  Verified customer
                </p>
              </div>
            </div>

            {/* "Member — since 2026" and "Sessions — this device" were two
                strings, not two facts: neither was read from anything, and
                neither answered a question anyone opens the account to ask.
                These two are read from the stores and are the live ones —
                where the last order got to, and where the next one lands. The
                frame above already prints the three counts, so nothing here
                repeats them. */}
            <dl>
              <div>
                <dt>Last order</dt>
                <dd>{latest ? latest.status : "None yet"}</dd>
              </div>
              <div>
                <dt>Delivers to</dt>
                <dd>{defaultAddress ? defaultAddress.label : "Not set"}</dd>
              </div>
            </dl>
          </div>

          <nav aria-label="Account" className="io-side__nav">
            <p className="io-side__label">Menu</p>
            <div className="io-side__links">
              {LINKS.map((link) => {
                const { href, label, icon: Icon } = link;
                const count = "count" in link ? counts[link.count] : undefined;

                return (
                  <Link
                    aria-current={isCurrent(href, pathname) ? "page" : undefined}
                    href={href}
                    key={href}
                  >
                    <Icon aria-hidden size={15} strokeWidth={1.6} />
                    {label}
                    {count ? (
                      <span className="io-side__count">
                        {String(count).padStart(2, "0")}
                      </span>
                    ) : (
                      <span />
                    )}
                  </Link>
                );
              })}
            </div>
          </nav>

          <div className="io-side__help">
            <p>
              <strong>Need a person?</strong>
              Support answers order, delivery and return questions within two working
              days.
            </p>
            <Link className="io-btn io-btn--ghost io-btn--wide" href="/account/support">
              Contact support
            </Link>
          </div>
        </aside>

        <div>{children}</div>
      </div>
    </PageFrame>
  );
}
