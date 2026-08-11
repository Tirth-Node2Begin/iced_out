import type { ProductImagePosition } from "@/features/02-products";

type ProductImageProps = {
  position: ProductImagePosition;
  className?: string;
};

export function ProductImage({ position, className = "" }: ProductImageProps) {
  return (
    <div
      aria-hidden="true"
      className={`product-sprite product-sprite--${position} ${className}`}
    />
  );
}
