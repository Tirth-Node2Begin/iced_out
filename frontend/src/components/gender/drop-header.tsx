import type { AudienceContent } from "@/components/gender/data";
import { Reveal, SplitHeading } from "@/components/gender/motion";

/**
 * THE RELEASE HEADER. `#gx-head` — the first thing under the hero.
 *
 * The hero sells the drop; this states it. Kicker and terms on one line, then
 * the headline at display size, one paragraph, and the three numbers that
 * define the run — so a visitor who scrolled past the hero still knows what
 * they are looking at, and how limited it is, before the first product.
 *
 * The headline uses `SplitHeading`, which is the house two-cut treatment the
 * hero itself is set in: a heavy condensed first half and a light extended
 * tail. Set as one flat line at body weight it read as a caption that had
 * wandered up the page rather than as the title of a release.
 *
 * Everything comes out of `content.intro`, which is the same deck /women
 * reads — nothing here is hard-coded per audience.
 */
export function DropHeader({ content }: { content: AudienceContent }) {
  /* Named with `aria-label` rather than `aria-labelledby`: `SplitHeading`
     shatters its text into one span per character, and pointing at it would
     hand a screen reader the heading a letter at a time. */
  return (
    <section
      aria-label={`${content.label} — Drop 001`}
      className="gxd-section"
      id="gx-head"
    >
      <div className="gxd-wrap">
        <div className="gxd-header">
          <Reveal className="gxd-header__top">
            <p className="gx-eyebrow">{content.intro.eyebrow}</p>
            <span className="gxd-header__badge">Numbered · Never restocked</span>
          </Reveal>

          <SplitHeading
            className="gxd-header__title"
            segments={[
              { text: content.intro.heavy },
              { text: content.intro.light, light: true },
            ]}
          />

          <Reveal delay={0.08}>
            <p className="gxd-header__copy">{content.intro.body}</p>
          </Reveal>

          <Reveal delay={0.14}>
            <ul className="gxd-facts">
              {content.intro.specs.map((spec) => (
                <li key={spec.label}>
                  <b>{spec.value}</b>
                  <span>{spec.label}</span>
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
