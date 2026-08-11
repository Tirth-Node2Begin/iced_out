"use client";

import Link from "next/link";

import { Reveal } from "@/components/new-home/motion-primitives";

/**
 * The site footer — the one plate every page ends on.
 *
 * There used to be four of these: `layout/footer` for the storefront shell,
 * `home-v2/site-footer` for the home experiences, `gender/site-footer` for the
 * listing routes, and `new-home/site-footer` for /new-home, /new-man,
 * /new-woman and /about. A visitor walking from the home page to a product to
 * their bag met three different endings. This is that ending, once.
 *
 * `.nh-foot` carries its own token scope (see new-home.css), so the block does
 * not need to sit inside `.nh-root` to resolve its colours — it renders the
 * same under the storefront theme, the `.hv2` home scope and the listing pages.
 */

type FooterColumn = {
  title: string;
  links: { label: string; href: string }[];
};

/* Labels are the design's; the hrefs point at whatever route actually exists.
   Anything without a home yet lands on /contact, which is where every one of
   these used to go. */
const FOOTER_COLUMNS: FooterColumn[] = [
  {
    title: "Shop",
    links: [
      { label: "Men", href: "/new-man" },
      { label: "Women", href: "/new-woman" },
      { label: "Accessories", href: "/collections" },
      { label: "Seasonal", href: "/sale" },
    ],
  },
  {
    title: "Support",
    links: [
      { label: "Shipping", href: "/pages/shipping-policy" },
      { label: "Returns", href: "/pages/return-policy" },
      { label: "Size guide", href: "/contact" },
      { label: "Contact", href: "/contact" },
    ],
  },
  {
    title: "Studio",
    links: [
      { label: "About", href: "/about" },
      { label: "Journal", href: "/contact" },
      { label: "Stockists", href: "/contact" },
      { label: "Careers", href: "/contact" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="nh-foot">
      <div className="nh-wrap">
        <div className="nh-foot__top">
          {/* the two colours here were inline, which no stylesheet can override —
              they live in .nh-foot__lead now so the footer's type reads as one */}
          <Reveal className="nh-foot__lead">
            <p className="nh-eyebrow">Gear up · every season</p>
            <p className="nh-body">
              Built for the cold starts and the long finishes. Limited runs,
              restocked when the season turns.
            </p>
          </Reveal>

          <nav aria-label="Footer" className="nh-foot__cols">
            {FOOTER_COLUMNS.map((col, i) => (
              <Reveal className="nh-foot__col" delay={0.08 * i} key={col.title}>
                <h4>{col.title}</h4>
                {col.links.map((link) => (
                  <Link href={link.href} key={link.label}>
                    {link.label}
                  </Link>
                ))}
              </Reveal>
            ))}
          </nav>
        </div>

        <p aria-hidden className="nh-foot__word">
          Iced_out
        </p>

        <div className="nh-foot__bar">
          <span>© {new Date().getFullYear()} Iced_out</span>
          <span>Every season · every workout</span>
        </div>
      </div>
    </footer>
  );
}
