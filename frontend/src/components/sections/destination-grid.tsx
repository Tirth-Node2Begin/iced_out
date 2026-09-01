import { ArrowUpRight } from "lucide-react";
import Link from "next/link";

import { ProductImage } from "@/components/commerce/product-image";
import { Container } from "@/components/ui/container";
import type { ProductImagePosition } from "@/features/02-products";

const destinations: Array<{
  index: string;
  title: string;
  detail: string;
  href: string;
  position: ProductImagePosition;
}> = [
  { index: "01", title: "Men", detail: "After-dark layers", href: "/new-man", position: "top-right" },
  { index: "02", title: "Women", detail: "Structured uniforms", href: "/new-woman", position: "top-left" },
  /* Was Sale, at /sale — that route is gone, and the current release is the
     third destination the shop actually has. */
  { index: "03", title: "New drop", detail: "Edition 001", href: "/new-drop", position: "bottom-left" },
];

export function DestinationGrid() {
  return (
    <section className="destination-section section" aria-labelledby="destination-heading">
      <Container>
        <div className="destination-section__heading">
          <p className="eyebrow">Choose your signal</p>
          <h2 id="destination-heading">Find your layer.</h2>
        </div>
        <div className="destination-grid">
          {destinations.map((destination) => (
            <Link
              className="destination-card media-frame"
              href={destination.href}
              key={destination.index}
            >
              {/* The sprite is the subject here, not a stand-in for a missing photo:
                  these cards are editorial, and the quadrant each one names IS the
                  picture. Everywhere a real product is shown, the fallback is off. */}
              <ProductImage fallback="sprite" position={destination.position} />
              <span className="destination-card__index">{destination.index}</span>
              <div className="destination-card__footer">
                <div>
                  <h3>{destination.title}</h3>
                  <p>{destination.detail}</p>
                </div>
                <span className="destination-card__arrow">
                  <ArrowUpRight aria-hidden="true" size={20} />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </Container>
    </section>
  );
}
