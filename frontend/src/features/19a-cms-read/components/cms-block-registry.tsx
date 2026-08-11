import type { ComponentType } from "react";

import { BrandStory } from "@/components/sections/brand-story";
import { DestinationGrid } from "@/components/sections/destination-grid";
import { Hero } from "@/components/sections/hero";
import { Manifesto } from "@/components/sections/manifesto";
import { ProductGrid } from "@/components/sections/product-grid";
import { ServiceGrid } from "@/components/sections/service-grid";
import { SignalStrip } from "@/components/sections/signal-strip";
import type { CmsBlock, CmsBlockType } from "@/features/19a-cms-read/types/cms-block";

const registry: Record<CmsBlockType, ComponentType> = {
  hero: Hero,
  "signal-strip": SignalStrip,
  "product-rail": ProductGrid,
  "destination-grid": DestinationGrid,
  "brand-story": BrandStory,
  manifesto: Manifesto,
  "service-grid": ServiceGrid,
};

export function CmsBlockRenderer({ block }: { block: CmsBlock }) {
  const Block = registry[block.type];
  if (!Block || !block.active) return null;
  return <Block />;
}
