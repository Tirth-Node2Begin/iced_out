import type { ReactNode } from "react";

import { CatalogProvider } from "@/features/02-products/catalog-context";

/**
 * One store for the whole area, mounted here rather than in the app's global
 * providers: the products list, the category and collection registers and the
 * product editor are the only things that read it, and they all live under
 * this route. Its screens' own tabs are in each list's toolbar — see
 * `CatalogTabs`.
 */
export default function CatalogLayout({ children }: { children: ReactNode }) {
  return <CatalogProvider>{children}</CatalogProvider>;
}
