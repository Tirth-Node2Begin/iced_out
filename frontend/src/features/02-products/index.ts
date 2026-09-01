export {
  filterProducts,
  getProduct,
  listProducts,
  matchesDestination,
} from "./api/product-repository";
export {
  catalogStore,
  collectionsStore,
  fetchProduct,
  heldProducts,
  loadCatalog,
  TRENDING_LIMIT,
  trendingStore,
  type StoreCollection,
} from "./catalog-store";
export {
  productKeys,
  useCatalog,
  useCatalogQuery,
  useCatalogVersion,
  useCollections,
  useProduct,
  useProducts,
  useTrending,
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
export { productPieceHref } from "./utils/piece-href";
