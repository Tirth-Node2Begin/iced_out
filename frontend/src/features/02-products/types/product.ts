export type ProductImagePosition =
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right";

export type StockState = "IN_STOCK" | "LOW_STOCK" | "SOLD_OUT";

export type ProductVariant = {
  id: string;
  size: "XS" | "S" | "M" | "L" | "XL";
  color: string;
  colorHex: string;
  material: string;
  stock: StockState;
  available: number;
};

export type Product = {
  id: string;
  slug: string;
  name: string;
  category: string;
  description: string;
  story: string;
  fabric: string;
  care: string;
  price: number;
  compareAtPrice?: number;
  color: string;
  badge?: string;
  imagePosition: ProductImagePosition;
  audience: "men" | "women" | "unisex";
  collection: string;
  isNew: boolean;
  variants: ProductVariant[];
};

export type ProductDestination =
  | "all"
  | "new-drop"
  | "men"
  | "women"
  | "sale"
  | `collection:${string}`;
