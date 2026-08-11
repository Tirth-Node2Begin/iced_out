import { ArrowRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { Container } from "@/components/ui/container";

export function BrandStory() {
  return (
    <section className="brand-story-section section" aria-labelledby="brand-story-heading">
      <Container>
        <div className="brand-story-card media-frame">
          <Image
            src="/images/product-still-life@1200.avif"
            alt="Iced_out heavyweight hoodie, utility overshirt, and cargo trousers arranged in the studio"
            fill
            loading="lazy"
            sizes="(max-width: 768px) 100vw, 92vw"
          />
          <div className="brand-story-card__scrim" aria-hidden="true" />
          <div className="media-grain" aria-hidden="true" />
          <div className="brand-story-card__content">
            <div>
              <p className="eyebrow">Iced_out / Since after dark</p>
              <h2 id="brand-story-heading">Built in the quiet.</h2>
            </div>
            <div className="brand-story-card__copy">
              <p>
                A study in weight, stillness, and the parts of the city that only
                appear when everyone else leaves.
              </p>
              <Link className="button button--glass" href="/about">
                Read our story
                <ArrowRight aria-hidden="true" size={17} />
              </Link>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
