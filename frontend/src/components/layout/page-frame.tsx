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

/**
 * A screen may open without the masthead.
 *
 * The account is the case it was written for: every one of its tabs prints the
 * shopper's identity banner across the top, so a 6rem "Your profile" above that
 * banner was the same page saying its own name twice, and it pushed the thing
 * the shopper came for a screen-height down. Passing no `title` drops the
 * header block and starts the body near the top of the page — the band behind
 * it shortens to a wash rather than a hero (`.io-page--bare`).
 */
export function PageFrame({
  back,
  eyebrow,
  title,
  lede,
  spec,
  children,
}: {
  back?: PageBack;
  eyebrow?: string;
  /** Takes markup so a page can set the light cut with `<em>`. Omit for a screen that carries its own header. */
  title?: ReactNode;
  lede?: string;
  spec?: PageSpec[];
  children: ReactNode;
}) {
  const masthead = title !== undefined;

  return (
    <div className="io-scope">
      <div className={masthead ? "io-page" : "io-page io-page--bare"}>
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

          {masthead && (
            <header className="io-page__head">
              <div>
                {eyebrow && <p className="io-page__eyebrow">{eyebrow}</p>}
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
          )}

          <div className="io-page__body">{children}</div>
        </div>
      </div>
    </div>
  );
}
