export type CmsBlockType =
  | "hero"
  | "signal-strip"
  | "product-rail"
  | "destination-grid"
  | "brand-story"
  | "manifesto"
  | "service-grid";

export type CmsBlock = {
  id: string;
  type: CmsBlockType;
  position: number;
  active: boolean;
};

export type CmsPage = {
  slug: "home";
  title: string;
  updatedAt: string;
  blocks: CmsBlock[];
};
