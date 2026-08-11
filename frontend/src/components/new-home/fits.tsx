"use client";

import { motion } from "motion/react";
import Link from "next/link";

import {
  EASE_OUT,
  Reveal,
  SplitHeading,
} from "@/components/new-home/motion-primitives";
import { PRODUCTS } from "@/components/new-home/data";

const MotionLink = motion.create(Link);

function ProductCard({
  product,
  index,
}: {
  product: (typeof PRODUCTS)[number];
  index: number;
}) {
  return (
    <MotionLink
      className="nh-product"
      href="/new-drop"
      initial={{ opacity: 0, y: 34, scale: 0.985 }}
      transition={{
        duration: 0.78,
        // the source washes the row in left-to-right, one card behind the next
        delay: (index % 4) * 0.09 + Math.floor(index / 4) * 0.06,
        ease: EASE_OUT,
      }}
      viewport={{ once: true, amount: 0.2 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img alt={product.name} src={product.image} />

      <div className="nh-product__tags">
        <span className="nh-tag">{product.tag}</span>
        <span className="nh-heart">
          <svg
            aria-hidden
            fill="none"
            height="13"
            stroke="currentColor"
            strokeWidth="1.5"
            viewBox="0 0 24 24"
            width="13"
          >
            <path d="M12 20s-7-4.6-7-9.4A3.9 3.9 0 0 1 12 8a3.9 3.9 0 0 1 7 2.6C19 15.4 12 20 12 20Z" />
          </svg>
        </span>
      </div>

      <div className="nh-product__panel">
        <span>
          <span className="nh-product__name block">{product.name}</span>
          <span className="nh-product__price block">{product.price}</span>
        </span>
        <span className="nh-product__go">
          <svg
            aria-hidden
            fill="none"
            height="13"
            stroke="currentColor"
            strokeWidth="1.6"
            viewBox="0 0 24 24"
            width="13"
          >
            <path d="m9 5 7 7-7 7" />
          </svg>
        </span>
      </div>
    </MotionLink>
  );
}

/** 05 — the arrivals grid. */
export function Fits() {
  return (
    <section className="nh-section" id="fits">
      <div className="nh-wrap">
        <div className="nh-fits__head">
          <Reveal>
            <p className="nh-eyebrow">New arrival</p>
          </Reveal>

          <SplitHeading
            className="nh-fits__title"
            segments={[
              { text: "Fresh fits for " },
              { text: "your\n", light: true },
              { text: "next ", light: true },
              { text: "Workout!" },
            ]}
          />

          <Reveal delay={0.1}>
            <p className="nh-eyebrow" style={{ textAlign: "right" }}>
              All brands
            </p>
          </Reveal>
        </div>

        <div className="nh-fits__grid">
          {PRODUCTS.map((product, i) => (
            <ProductCard index={i} key={product.id} product={product} />
          ))}
        </div>

        <Reveal className="nh-fits__foot" delay={0.15}>
          <Link className="nh-pill nh-pill--dark" href="/new-drop">
            See all brands
            <span>
              <svg
                aria-hidden
                fill="none"
                height="13"
                stroke="currentColor"
                strokeWidth="1.7"
                viewBox="0 0 24 24"
                width="13"
              >
                <path d="M7 17 17 7M9 7h8v8" />
              </svg>
            </span>
          </Link>
        </Reveal>
      </div>
    </section>
  );
}
