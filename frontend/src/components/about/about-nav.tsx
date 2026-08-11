"use client";

import Link from "next/link";

import { PrimaryNav } from "@/components/nav/primary-nav";

export function AboutNav() {
  return (
    <>
      <Link className="nh-about-skip" href="#main-content">
        Skip to content
      </Link>
      {/* Same wrapper the site root mounts the bar in: it is what makes the bar
          sticky, and <BrandMorph> measures the wordmark's landing spot inside
          it — without the scope the flight has no fixed point to settle on. */}
      <div className="nh-nav-scope">
        <PrimaryNav currentPath="/about" logoHref="/" signInHref="/auth/login?returnTo=%2Fabout" />
      </div>
    </>
  );
}
