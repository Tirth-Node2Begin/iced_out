import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  output: "export",
  images: {
    unoptimized: true,
  },
  reactStrictMode: true,
  poweredByHeader: false,

  experimental: {
    /**
     * Barrel packages, rewritten to deep imports at compile time.
     *
     * Measured, and worth being honest about: on the tree as it stands this
     * changes nothing. A clean rebuild with these entries produced shared
     * chunks that were byte-identical to the build without them — same content
     * hashes, same 1447 KB. `radix-ui` (imported by all twenty files in
     * `components/ui/`) and `motion` (imported by 43 components) already ship
     * ESM that webpack tree-shakes properly, so there was nothing left for the
     * transform to remove.
     *
     * Kept anyway, because it is a compile-time SWC transform with no runtime
     * cost and it is cheap insurance: the day someone adds a dependency whose
     * barrel is *not* shakeable, this catches it silently instead of quietly
     * adding a few hundred KB to every page. Do not expect it to show up in a
     * bundle diff today.
     */
    optimizePackageImports: [
      "radix-ui",
      "motion",
      "motion/react",
      "lucide-react",
      "cmdk",
      "sonner",
    ],
  },
};

export default nextConfig;
