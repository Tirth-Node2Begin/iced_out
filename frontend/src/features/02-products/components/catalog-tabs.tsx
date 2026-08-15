"use client";

import { AdminModuleNav } from "@/components/admin/admin-module-nav";

/**
 * The catalogue's three screens, as the first control in each one's toolbar.
 *
 * They used to sit in a floating pill above the page head, which put two rows
 * of navigation between the title and the work. Down here they are beside the
 * search field and the state chips: one row that says what you are looking at
 * and how you have narrowed it.
 */
const LINKS = [
  { href: "/admin/catalog/products", label: "Products" },
  { href: "/admin/catalog/categories", label: "Categories" },
  { href: "/admin/catalog/collections", label: "Collections" },
];

export function CatalogTabs() {
  return <AdminModuleNav inline label="Catalog" links={LINKS} />;
}
