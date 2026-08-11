import type { Product } from "@/features/02-products/types/product";

export type {
  Product,
  ProductImagePosition,
  ProductVariant,
  StockState,
} from "@/features/02-products/types/product";

export type CartLine = {
  product: Product;
  quantity: number;
  size: string;
};
