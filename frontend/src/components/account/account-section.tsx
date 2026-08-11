import type { ReactNode } from "react";

/**
 * A section inside the account frame.
 *
 * The heading is an `h2`: `<AccountShell>` renders the page's `h1`, and two
 * competing headlines on one screen is both a broken outline and — at the size
 * this used to be set — two 88px display lines stacked on top of each other.
 *
 * Because the `h1` already names the tab ("Your security"), `title` carries the
 * sentence the headline cannot: what the screen is actually for. `actions`
 * holds the one control that belongs beside the header rather than inside a
 * panel below it.
 */
export function AccountSection({
  eyebrow,
  title,
  copy,
  actions,
  children,
}: {
  eyebrow: string;
  title: string;
  copy: string;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section className="io-sec">
      <header className="io-sec__head">
        <div>
          <p className="io-sec__eyebrow">{eyebrow}</p>
          <h2 className="io-sec__title">{title}</h2>
          <p className="io-sec__copy">{copy}</p>
        </div>
        {actions && <div className="io-sec__actions">{actions}</div>}
      </header>
      <div className="io-sec__body">{children}</div>
    </section>
  );
}
