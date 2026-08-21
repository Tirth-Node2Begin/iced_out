"use client";

import { spellCount, type AudienceContent } from "@/components/gender/data";
import { Reveal, SplitHeading } from "@/components/gender/motion";
import { useGenderPieces } from "@/components/gender/use-pieces";

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
  /**
   * How many pieces are actually published for this audience.
   *
   * The deck writes the release size as the token `{count}` rather than
   * asserting a number, because the number is whatever the console has
   * published — and this component rendered the token straight out, so the page
   * headline read "{COUNT} PIECES CUT FOR WEIGHT AND MOVEMENT" and the stat rail
   * under it read "{count} PIECES LIVE". `CollectionIntro` on /women had always
   * done the substitution; /new-drop reaches the same deck through here, and
   * this half of it was never given the count to fill in.
   *
   * Reading it here rather than taking it as a prop, because the page above is a
   * server component and the catalogue arrives over the network — the same
   * reason `DropEdit` beside it holds this hook.
   */
  const { pieces, loaded } = useGenderPieces(content.audience);
  const count = pieces.length;

  const { intro } = content;

  /* Spelled in the headline, which is a sentence, and printed as a figure in
     the rail beside "320 numbered units" — one fact, two registers.

     Until the catalogue lands there is no number to state, so the headline drops
     the clause rather than claiming "No pieces cut for weight and movement" for
     the half-second before the answer arrives. */
  const heading = loaded
    ? intro.heavy.replace("{count}", spellCount(count))
    : intro.heavy.replace("{count} ", "");

  const specs = intro.specs.map((spec) => ({
    ...spec,
    value: loaded ? spec.value.replace("{count}", String(count)) : spec.value.replace("{count}", "—"),
  }));
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
            <p className="gx-eyebrow">{intro.eyebrow}</p>
            <span className="gxd-header__badge">Numbered · Never restocked</span>
          </Reveal>

          <SplitHeading
            className="gxd-header__title"
            segments={[
              { text: heading },
              { text: intro.light, light: true },
            ]}
          />

          <Reveal delay={0.08}>
            <p className="gxd-header__copy">{intro.body}</p>
          </Reveal>

          <Reveal delay={0.14}>
            <ul className="gxd-facts">
              {specs.map((spec) => (
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
