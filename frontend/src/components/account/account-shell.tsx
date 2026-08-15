"use client";

import {
  Bell,
  LifeBuoy,
  LockKeyhole,
  MapPin,
  MessageSquareText,
  Package,
  Ticket,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { BrandMark } from "@/components/brand/brand-mark";
import { ProfileIdentity } from "@/components/account/profile-identity";
import { PageFrame } from "@/components/layout/page-frame";
import { useProfile } from "@/features/01-users/profile-context";
import { useOrders } from "@/features/07-orders/orders-context";
import { useCart } from "@/features/04-cart/cart-context";
import { isClaimed } from "@/features/10-coupons/vouchers";
import { useVouchers } from "@/features/10-coupons/vouchers-context";
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
  /* Under Orders, because that is what it comes from and what it goes back
     into: a return settles into credit here, and the credit is spent on the
     next order. The count is money the shop owes, so it is worth a number. */
  { href: "/account/vouchers", label: "Vouchers", title: "vouchers", icon: Ticket, count: "vouchers" },
  { href: "/account/addresses", label: "Addresses", title: "addresses", icon: MapPin },
  { href: "/account/feedback", label: "Feedback", title: "feedback", icon: MessageSquareText },
  { href: "/account/notifications", label: "Notifications", title: "notifications", icon: Bell },
  { href: "/account/support", label: "Support", title: "support", icon: LifeBuoy },
  { href: "/account/security", label: "Security", title: "security", icon: LockKeyhole },
] as const;

/**
 * The house, as printed in the rail.
 *
 * Fixed copy on purpose — none of it is a fact about this session, so none of
 * it is read from a store. It matches what the rest of the site already says
 * (the campaign's city, the storefront's market and currency, the support
 * address on `/contact`), and those are the four places to change if it moves.
 */
const HOUSE = [
  { label: "House", value: "Iced_out" },
  { label: "Studio", value: "Bengaluru, IN" },
  { label: "Market", value: "India · INR" },
  { label: "Care", value: "support@iced-out.example" },
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
  const { profile } = useProfile();
  const { vouchers } = useVouchers();

  const counts = {
    orders: orders.length,
    /* Only the ones still waiting to be redeemed — a claimed voucher is a
       record, not a thing waiting to be used. */
    vouchers: vouchers.filter((voucher) => !isClaimed(voucher)).length,
  };

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
      {/* Who the session belongs to, across the full width above everything
          else. It is the banner of the account rather than a card in the
          profile tab's column: the rail beside it prints the house, and the
          shopper is the larger of the two facts.
          On every tab, not just the profile — it is the header of the account,
          and a header that comes and goes as the tabs change is a header the
          eye has to look for. The tabs open underneath it. */}
      <div className="io-account">
        <ProfileIdentity />

        <div className="io-profile">
          <aside className="io-side">
            {/* The house, not the shopper.
                The name and the "Verified customer" line went because the
                account already says both louder and closer to the point: the
                banner above is the shopper's, and the profile tab is one row
                down in the menu and owns the record. The rows below are fixed
                copy — nothing in them is read from a store, so nothing in them
                can go stale mid-session. */}
            <div className="io-identity">
              {/* Outside the <dl>: a wrapper in there is only valid around a
                  dt/dd pair, and this is a heading for the list, not a row in
                  it. */}
              <p className="io-identity__brand">
                <BrandMark className="io-identity__mark" />
                ICED_OUT
                {/* The one live thing left in the card, and the reason it reads
                    as *your* account rather than a plaque: the disc shows the
                    photo saved on the profile tab the moment one exists. Until
                    then it is the empty state, not the name in two letters —
                    initials are the shopper's detail, and this card
                    deliberately prints none.
                    Plain <img>: the source is a data URL written this session,
                    so there is nothing for the image pipeline to optimise. */}
                {profile.photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img alt="" className="io-identity__photo" src={profile.photo} />
                ) : (
                  <span aria-hidden className="io-identity__photo io-identity__photo--empty">
                    <UserRound size={15} strokeWidth={1.6} />
                  </span>
                )}
              </p>

              <dl>
                {HOUSE.map(({ label, value }) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
            </div>

            <nav aria-label="Account" className="io-side__nav">
              <p className="io-side__label">Menu</p>
              <div className="io-side__links">
                {LINKS.map((link) => {
                  const { href, label, icon: Icon } = link;
                  const count = "count" in link ? counts[link.count] : undefined;

                  return (
                    /* `scroll={false}`: the rail is a tab bar, and a tab bar
                       that throws the page back to the top takes the menu you
                       are pointing at with it. Only the panel beside these
                       links changes, so the view stays where it was and the
                       next tab opens under the cursor. */
                    <Link
                      aria-current={isCurrent(href, pathname) ? "page" : undefined}
                      href={href}
                      key={href}
                      scroll={false}
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

          {/* Keyed on the path so the tab that just arrived plays its entrance
              rather than swapping in place. The route change remounts the panel
              anyway; the key is what makes that legible — one screen leaves and
              the next rises, instead of the column blinking to new copy. */}
          <div className="io-tab" key={pathname}>
            {children}
          </div>
        </div>
      </div>
    </PageFrame>
  );
}
