import { ArrowUpRight } from "lucide-react";
import Link from "next/link";

import { CROPS, type AudienceContent } from "@/components/gender/data";
import { Reveal } from "@/components/gender/motion";

/**
 * 02 — THE LOOK. `#gx-lookbook`, the hero's secondary CTA target.
 *
 * The lookbook used to be a pinned, hotspot-tagged spread. On a page this
 * short it is two campaign frames — the fits, at the size they were shot for,
 * each landing on the piece that carries them.
 *
 * The frames behave exactly like the product cards above: same radius, same
 * lift, same zoom, label chip in the same corner, caption underneath rather
 * than over the photograph. Two ways to read an image on one page is one too
 * many.
 */
export function DropLook({ content }: { content: AudienceContent }) {
  /* two frames, not three — the third look is the flat lay, which is a product
     shot rather than a fit and would break the pair */
  const frames = content.look.looks.slice(0, 2);

  return (
    <section aria-labelledby="gx-look-title" className="gxd-section" id="gx-lookbook">
      <div className="gxd-wrap">
        <div className="gxd-head">
          <Reveal className="gxd-head__lead">
            <p className="gx-eyebrow">02 / The look</p>
            <h2 className="gxd-head__title" id="gx-look-title">
              How it&rsquo;s worn
            </h2>
          </Reveal>

          <Reveal delay={0.08}>
            <p className="gxd-head__note">
              Two complete fits from the release, shot after dark. Tap either to
              open the piece that carries it.
            </p>
          </Reveal>
        </div>

        <div className="gxd-picks">
          {frames.map((look, index) => {
            const crop = CROPS[look.crop];

            return (
              <Reveal className="gxd-pick" delay={index * 0.08} key={look.id} y={24}>
                <Link
                  aria-label={`${look.label} — ${look.title}`}
                  className="gxd-pick__frame"
                  href={`/product?slug=${look.pins[0].slug}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    alt=""
                    decoding="async"
                    loading="lazy"
                    src={crop.src}
                    style={
                      { "--op": crop.op, "--z": crop.z ?? 1 } as React.CSSProperties
                    }
                  />
                  <span className="gxd-pick__label">{look.label}</span>
                </Link>

                <div className="gxd-pick__meta">
                  <h3 className="gxd-pick__title">
                    {look.title}
                    <ArrowUpRight aria-hidden size={16} />
                  </h3>
                  <p className="gxd-pick__copy">{look.copy}</p>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
