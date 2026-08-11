"use client";

import { ArrowDown, ArrowRight } from "lucide-react";
import Link from "next/link";

import { Container } from "@/components/ui/container";

export function Hero() {
  return (
    <section className="hero" id="top" aria-labelledby="hero-heading">
      <picture>
        <source
          type="image/avif"
          srcSet="/images/iced-out-hero@960.avif 960w, /images/iced-out-hero.avif 1536w"
          sizes="100vw"
        />
        <source
          type="image/webp"
          srcSet="/images/iced-out-hero@960.webp 960w, /images/iced-out-hero.webp 1536w"
          sizes="100vw"
        />
        <img
          className="hero__image"
          src="/images/iced-out-hero.webp"
          alt="Two models wearing oversized black Iced_out streetwear in a dark concrete studio"
          width={1536}
          height={1024}
          decoding="async"
          fetchPriority="high"
        />
      </picture>
      <div className="hero__scrim" aria-hidden="true" />
      <div className="media-grain" aria-hidden="true" />

      <Container className="hero__content">
        <p className="hero__eyebrow">
          <span /> Drop 001 / Live now
        </p>
        <h1 id="hero-heading">
          Cold by
          <br />
          <em>nature.</em>
        </h1>
        <p className="hero__copy">
          Uniforms for after dark. Built heavyweight, cut for movement, and released
          in limited numbers.
        </p>
        <div className="hero__actions">
          <Link className="button button--primary" href="/new-drop">
            Shop Drop 001
            <ArrowRight aria-hidden="true" size={17} />
          </Link>
          <Link className="button button--glass" href="/about">
            Our story
          </Link>
        </div>
      </Container>

      <div className="hero__footer">
        <Container className="hero__footer-inner">
          <div className="hero__edition">
            <span>Edition</span>
            <strong>001 / 320</strong>
          </div>
          <Link href="#new-drop">
            Scroll to discover
            <ArrowDown aria-hidden="true" size={16} />
          </Link>
          <div className="hero__location">
            <span>Origin</span>
            <strong>India / Worldwide</strong>
          </div>
        </Container>
      </div>
    </section>
  );
}
