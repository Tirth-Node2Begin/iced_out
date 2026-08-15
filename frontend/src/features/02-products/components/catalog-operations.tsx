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
import { useCatalog } from "@/features/02-products/catalog-context";
import { COLLECTION_STATES, mintSlug } from "@/features/02-products/catalog-seed";
import { CatalogTabs } from "@/features/02-products/components/catalog-tabs";

export type CatalogOperationsView = "categories" | "collections";

/* ---- categories ---------------------------------------------------------- */

const CATEGORY_COLUMNS: Column[] = [
  { key: "name", label: "Category", primary: true, sub: "id" },
  { key: "products", label: "Products", align: "right", numeric: true },
];

const CATEGORY_FIELDS: FormField[] = [
  { key: "name", label: "Category name", placeholder: "Outerwear", required: true },
  { key: "products", label: "Products", type: "number", initial: "0" },
];

/* ---- collections --------------------------------------------------------- */

const COLLECTION_COLUMNS: Column[] = [
  { key: "name", label: "Collection", primary: true, sub: "id" },
  { key: "pieces", label: "Pieces", align: "right", numeric: true },
  { key: "status", label: "State", status: true },
];

const COLLECTION_FIELDS: FormField[] = [
  { key: "name", label: "Collection name", placeholder: "After Hours", required: true },
  { key: "pieces", label: "Pieces", type: "number", initial: "0" },
  /* Draft first, for the same reason a product starts as one. */
  { key: "status", label: "State", type: "select", options: COLLECTION_STATES, initial: "Draft" },
];

/**
 * The slug is minted from the name and then held: it is what a product's
 * category and a collection's page are filed under, so a rename must not
 * quietly re-file everything pointing at it.
 */
function deriveSlug(values: RecordRow, rows: RecordRow[], previous?: RecordRow): RecordRow {
  if (previous) return values;
  return { ...values, id: mintSlug(values.name, rows.map((row) => row.id)) };
}

function tally(rows: RecordRow[], key: string) {
  const total = rows.reduce((sum, row) => sum + (Number.parseInt(row[key] ?? "", 10) || 0), 0);
  return String(total);
}

function count(rows: RecordRow[], status: string) {
  return String(rows.filter((row) => row.status === status).length).padStart(2, "0");
}

export function CatalogOperations({ view }: { view: CatalogOperationsView }) {
  const { categories, collections, commit } = useCatalog();

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
          derive={deriveSlug}
          fields={CATEGORY_FIELDS}
          /* No state to be in, so the one chip is the whole register — kept
             rather than dropped so the row of controls does not change shape
             between the three catalogue screens. */
          filterValues={[]}
          icon={Tags}
          onCommit={(next) => commit("categories", next)}
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
    { label: "Published", value: count(collections, "Published"), icon: CheckCircle2, tone: "mint", note: "Live on the storefront" },
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
        { label: "Published", value: count(collections, "Published") },
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
        derive={deriveSlug}
        fields={COLLECTION_FIELDS}
        filterKey="status"
        filterValues={COLLECTION_STATES}
        icon={FolderKanban}
        onCommit={(next) => commit("collections", next)}
        rows={collections}
        searchKeys={["name", "id", "pieces", "status"]}
        singular="collection"
        toolbarLead={<CatalogTabs />}
        tone="violet"
      />
    </AdminPage>
  );
}
