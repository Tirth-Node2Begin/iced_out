export {
  filterProducts,
  getProduct,
  listProducts,
  matchesDestination,
} from "./api/product-repository";
export {
  catalogStore,
  fetchProduct,
  heldProducts,
  loadCatalog,
} from "./catalog-store";
export {
  productKeys,
  useCatalog,
  useCatalogQuery,
  useCatalogVersion,
  useProduct,
  useProducts,
  type CatalogQuery,
} from "./hooks/use-products";
export type {
  Product,
  ProductDestination,
  ProductImagePosition,
  ProductVariant,
  StockState,
} from "./types/product";
export { formatPrice } from "./utils/format-price";
