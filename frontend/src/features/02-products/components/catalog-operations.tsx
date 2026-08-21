"use client";

import { CheckCircle2, Clock3, FileEdit, FolderKanban, Layers3, Tags } from "lucide-react";

import { StatGrid, type Stat } from "@/components/admin/admin-stats";
import { AdminPage } from "@/components/admin/admin-ui";
import {
  RecordManager,
  type Column,
  type FormField,
  type RecordRow,
} from "@/components/admin/record-manager";
import { useCatalogRegisters } from "@/features/02-products/catalog-context";
import { COLLECTION_STATES } from "@/features/02-products/catalog-seed";
import { CatalogTabs } from "@/features/02-products/components/catalog-tabs";

export type CatalogOperationsView = "categories" | "collections";

/* ---- categories ---------------------------------------------------------- */

const CATEGORY_COLUMNS: Column[] = [
  { key: "name", label: "Category", primary: true, sub: "id" },
  { key: "products", label: "Products", align: "right", numeric: true },
];

/* Just the name. "Products" is a COUNT the server derives from what is actually
   filed under this category — it was a number field an operator could type, which
   meant the register could claim fourteen products in a category holding none. */
const CATEGORY_FIELDS: FormField[] = [
  { key: "name", label: "Category name", placeholder: "Outerwear", required: true },
];

/* ---- collections --------------------------------------------------------- */

const COLLECTION_COLUMNS: Column[] = [
  { key: "name", label: "Collection", primary: true, sub: "id" },
  { key: "pieces", label: "Pieces", align: "right", numeric: true },
  { key: "status", label: "State", status: true },
];

/* "Pieces" is derived, like a category's product count — see CATEGORY_FIELDS. */
const COLLECTION_FIELDS: FormField[] = [
  { key: "name", label: "Collection name", placeholder: "After Hours", required: true },
  /* Draft first, for the same reason a product starts as one. */
  { key: "status", label: "State", type: "select", options: COLLECTION_STATES, initial: "Draft" },
];

function tally(rows: RecordRow[], key: string) {
  const total = rows.reduce((sum, row) => sum + (Number.parseInt(row[key] ?? "", 10) || 0), 0);
  return String(total);
}

function count(rows: RecordRow[], status: string) {
  return String(rows.filter((row) => row.status === status).length).padStart(2, "0");
}

export function CatalogOperations({ view }: { view: CatalogOperationsView }) {
  /* The slug each of these is filed under is minted by the server from the name,
     and then held — it is what a product's category and a collection's page point
     at, so a rename must not quietly re-file everything pointing at it. */
  const { categories, collections, register, error } = useCatalogRegisters();
  const categoryRegister = register("categories");
  const collectionRegister = register("collections");

  if (view === "categories") {
    const stats: Stat[] = [
      { label: "Categories", value: String(categories.length).padStart(2, "0"), icon: Tags, tone: "sky", note: "Internal taxonomy only" },
      { label: "Products classified", value: tally(categories, "products"), icon: Layers3, tone: "violet", note: "Across every category" },
    ];

    return (
      <AdminPage
        eyebrow="Catalog · Classification"
        icon={Tags}
        lede="Internal taxonomy that powers filters and merchandising. Categories never create public routes — the storefront's navigation stays plan-controlled."
        spec={[
          { label: "Categories", value: String(categories.length).padStart(2, "0") },
          { label: "Products", value: tally(categories, "products") },
        ]}
        title={
          <>
            Category <em>system</em>
          </>
        }
      >
        <StatGrid stats={stats} />
        <RecordManager
          columns={CATEGORY_COLUMNS}
          error={error}
          fields={CATEGORY_FIELDS}
          /* No state to be in, so the one chip is the whole register — kept
             rather than dropped so the row of controls does not change shape
             between the three catalogue screens. */
          filterValues={[]}
          icon={Tags}
          loaded={categoryRegister.loaded}
          loading={categoryRegister.loading}
          onCreate={categoryRegister.onCreate}
          onDelete={categoryRegister.onDelete}
          onUpdate={categoryRegister.onUpdate}
          plural="categories"
          rows={categories}
          searchKeys={["name", "id", "products"]}
          singular="category"
          toolbarLead={<CatalogTabs />}
          tone="sky"
        />
      </AdminPage>
    );
  }

  const stats: Stat[] = [
    { label: "Live", value: count(collections, "Live"), icon: CheckCircle2, tone: "mint", note: "Live on the storefront" },
    { label: "Scheduled", value: count(collections, "Scheduled"), icon: Clock3, tone: "amber", note: "Waiting on a release" },
    { label: "Draft", value: count(collections, "Draft"), icon: FileEdit, tone: "violet", note: "Not visible to shoppers" },
    { label: "Pieces", value: tally(collections, "pieces"), icon: Layers3, tone: "sky", note: "Across every collection" },
  ];

  return (
    <AdminPage
      eyebrow="Catalog · Merchandising"
      icon={FolderKanban}
      lede="Product order, campaign content and the customer-facing story, in one versioned surface per collection."
      spec={[
        { label: "Collections", value: String(collections.length).padStart(2, "0") },
        { label: "Live", value: count(collections, "Live") },
        { label: "Pieces", value: tally(collections, "pieces") },
      ]}
      title={
        <>
          Collection <em>desk</em>
        </>
      }
    >
      <StatGrid stats={stats} />
      <RecordManager
        columns={COLLECTION_COLUMNS}
        error={error}
        fields={COLLECTION_FIELDS}
        filterKey="status"
        filterValues={COLLECTION_STATES}
        icon={FolderKanban}
        loaded={collectionRegister.loaded}
        loading={collectionRegister.loading}
        onCreate={collectionRegister.onCreate}
        onDelete={collectionRegister.onDelete}
        onUpdate={collectionRegister.onUpdate}
        rows={collections}
        searchKeys={["name", "id", "pieces", "status"]}
        singular="collection"
        toolbarLead={<CatalogTabs />}
        tone="violet"
      />
    </AdminPage>
  );
}
