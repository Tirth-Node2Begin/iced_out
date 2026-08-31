export { catalogStore, heldProducts } from "./catalog-store";
export { useCatalog, useCatalogVersion, type CatalogQuery } from "./hooks/use-products";
export type {
  Product,
  ProductDestination,
  ProductImagePosition,
  ProductVariant,
  StockState,
} from "./types/product";
export { formatPrice } from "./utils/format-price";

/**
 * The catalogue as this app uses it: a price lookup and a formatter.
 *
 * The storefront's barrel also exports `listProducts`, `getProduct`,
 * `filterProducts`, `fetchProduct`, `loadCatalog`, `productRecord`,
 * `useProducts`, `useProduct` and `useCatalogQuery` — everything a shop needs to
 * put products on a page. None of that has a screen here, and the modules behind
 * it read `/catalog/**`, which this backend does not serve.
 *
 * The EDITABLE catalogue is `catalog-context.tsx`, and it is a different thing:
 * it reads `/admin/catalog/*` through `useRegister` and is what the catalogue
 * screens are built on.
 */
