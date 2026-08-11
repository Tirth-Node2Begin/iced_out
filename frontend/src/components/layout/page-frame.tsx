import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";

/**
 * The frame the bag, the wishlist and the profile open on.
 *
 * The three screens the header points at were each carrying their own heading
 * treatment, so moving between them read as three different sites. They share
 * one now: eyebrow, the two-cut headline of new_style §3.2, a short line of
 * copy, and a spec row on the right holding whatever the page actually counts.
 *
 * The spec entries are deliberately narrow — a number the page can prove, not
 * a dashboard. If a screen has nothing true to put there, it passes nothing.
 */
export type PageSpec = { label: string; value: string };

/**
 * Where a screen sits under the one above it.
 *
 * `label` names the destination rather than the gesture, because "Go back" on
 * its own is a promise the browser makes and this control does not: it is a
 * real `<Link>` to a known parent, so it behaves the same whether the shopper
 * arrived by clicking through, by reloading, or from a pasted URL.
 */
export type PageBack = { href: string; label: string };

export function PageFrame({
  back,
  eyebrow,
  title,
  lede,
  spec,
  children,
}: {
  back?: PageBack;
  eyebrow: string;
  /** Takes markup so a page can set the light cut with `<em>`. */
  title: ReactNode;
  lede?: string;
  spec?: PageSpec[];
  children: ReactNode;
}) {
  return (
    <div className="io-scope">
      <div className="io-page">
        <div className="io-page__wrap">
          {back && (
            <Link
              aria-label={`Go back to ${back.label}`}
              className="io-page__back"
              href={back.href}
            >
              <ArrowLeft aria-hidden size={14} strokeWidth={1.8} />
              Go back
              <span>{back.label}</span>
            </Link>
          )}

          <header className="io-page__head">
            <div>
              <p className="io-page__eyebrow">{eyebrow}</p>
              <h1 className="io-page__title">{title}</h1>
              {lede && <p className="io-page__lede">{lede}</p>}
            </div>

            {spec && spec.length > 0 && (
              <dl className="io-page__spec">
                {spec.map((entry) => (
                  <div key={entry.label}>
                    <dt>{entry.label}</dt>
                    <dd>{entry.value}</dd>
                  </div>
                ))}
              </dl>
            )}
          </header>

          <div className="io-page__body">{children}</div>
        </div>
      </div>
    </div>
  );
}
