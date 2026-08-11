"use client";

import { ArrowUpRight } from "lucide-react";
import Link from "next/link";

import { CROPS, type AudienceContent } from "@/components/gender/data";
import { Blinds, Reveal, SplitHeading } from "@/components/gender/motion";

/**
 * The brand story banner.
 *
 * The wordmark is rendered as pure outline (`-webkit-text-stroke`, transparent
 * fill) — the same register the footer uses, so the two read as bookends. The
 * photograph enters through the blinds primitive at 13 slices, centre-out.
 */
export function BrandStory({ content }: { content: AudienceContent }) {
  const { story } = content;
  const crop = CROPS[story.crop];

  return (
    <section className="gx-section gx-story">
      <div className="gx-wrap gx-story__layout">
        <div className="gx-story__copy">
          <Reveal>
            <p className="gx-eyebrow">{story.eyebrow}</p>
          </Reveal>

          <Reveal delay={0.08}>
            <p aria-hidden className="gx-ghostType gx-story__word">
              {story.word}
            </p>
          </Reveal>

          <SplitHeading
            className="gx-story__title"
            segments={[{ text: story.heavy }, { text: story.light, light: true }]}
          />

          {story.body.map((paragraph, index) => (
            <Reveal delay={0.15 + index * 0.08} key={paragraph.slice(0, 24)}>
              <p className="gx-body">{paragraph}</p>
            </Reveal>
          ))}

          <div className="gx-story__principles">
            {story.principles.map((principle, index) => (
              <Reveal
                className="gx-story__principle"
                delay={0.1 + index * 0.08}
                key={principle.key}
              >
                <b>{principle.key}</b>
                <span>{principle.text}</span>
              </Reveal>
            ))}
          </div>

          <Reveal delay={0.2}>
            <Link
              className="gx-pill gx-pill--glass"
              href="/about"
              style={{ marginTop: "clamp(1.5rem, 3vw, 2.25rem)" }}
            >
              Read the studio notes
              <ArrowUpRight aria-hidden size={14} />
            </Link>
          </Reveal>
        </div>

        <div className="gx-story__media">
          <Blinds
            alt="Iced_out campaign — the after-hours release"
            className="h-full"
            direction="center"
            imgClassName="gx-story__shot"
            slices={13}
            src={crop.src}
            style={{ "--op": crop.op } as React.CSSProperties}
          />
          <span className="gx-story__stamp">{story.stamp}</span>
        </div>
      </div>
    </section>
  );
}
