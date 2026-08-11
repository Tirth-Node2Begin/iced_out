import type { CmsPage } from "@/features/19a-cms-read/types/cms-block";

export const homePageFixture: CmsPage = {
  slug: "home",
  title: "Iced_out — Uniforms for after dark",
  updatedAt: "2026-08-04T09:30:00.000Z",
  blocks: [
    { id: "home-hero", type: "hero", position: 1, active: true },
    { id: "home-signal", type: "signal-strip", position: 2, active: true },
    { id: "home-drop", type: "product-rail", position: 3, active: true },
    { id: "home-destinations", type: "destination-grid", position: 4, active: true },
    { id: "home-story", type: "brand-story", position: 5, active: true },
    { id: "home-manifesto", type: "manifesto", position: 6, active: true },
    { id: "home-services", type: "service-grid", position: 7, active: true },
  ],
};
