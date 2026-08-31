"use client";

import { AdminModuleNav } from "@/components/shell/admin-module-nav";

/**
 * The catalogue's three screens, as the first control in each one's toolbar.
 *
 * They used to sit in a floating pill above the page head, which put two rows
 * of navigation between the title and the work. Down here they are beside the
 * search field and the state chips: one row that says what you are looking at
 * and how you have narrowed it.
 */
const LINKS = [
  { href: "/catalog/products", label: "Products" },
  { href: "/catalog/categories", label: "Categories" },
  { href: "/catalog/collections", label: "Collections" },
];

export function CatalogTabs() {
  return <AdminModuleNav inline label="Catalog" links={LINKS} />;
}
