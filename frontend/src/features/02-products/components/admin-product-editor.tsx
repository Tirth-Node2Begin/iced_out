"use client";

import { AlertTriangle, Package, Save, Tag } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { StatGrid, type Stat } from "@/components/admin/admin-stats";
import { AdminPage, Btn, Empty, Field, Note, Panel, Section, Select } from "@/components/admin/admin-ui";
import {
  RecordManager,
  type Column,
  type FormField,
  type RecordRow,
} from "@/components/admin/record-manager";
import { useCatalog } from "@/features/02-products/catalog-context";
import {
  FALLBACK_SIZES,
  PRODUCT_STATES,
  VARIANT_STATES,
  mintVariantSku,
} from "@/features/02-products/catalog-seed";
import { available, findStockItem, sizesOf, useStock } from "@/features/03-inventory/stock-context";

/**
 * The product editor.
 *
 * It reads the record the catalogue actually holds rather than a fixture, so
 * what you saved on the register is what opens here — and saving writes back
 * to the same store, which is what the register re-reads on the way out.
 *
 * The eight-step wizard is gone. What is left is two things a person actually
 * edits: the product's own facts, and its variants — which are a register, so
 * they get the same add, edit and delete controls as everything else.
 */
const VARIANT_COLUMNS: Column[] = [
  { key: "id", label: "SKU", primary: true, sub: "colour" },
  { key: "size", label: "Size", align: "center" },
  { key: "stock", label: "In stock", align: "right", numeric: true },
  { key: "status", label: "State", status: true },
];

/**
 * The variant form, offering only the sizes this product's stock record is
 * actually held in — letters for a top, waist inches for a bottom. A size the
 * warehouse does not carry is not a size anyone can list.
 */
function variantFields(sizes: string[]): FormField[] {
  return [
    { key: "colour", label: "Colour", placeholder: "Washed black", required: true },
    { key: "size", label: "Size", type: "select", options: sizes, required: true, help: "From the sizes this item is stocked in." },
    { key: "stock", label: "In stock", type: "number", initial: "0" },
    { key: "status", label: "State", type: "select", options: VARIANT_STATES },
  ];
}

const CATEGORIES_FALLBACK = ["Uncategorised"];
const COLLECTIONS_FALLBACK = ["Unassigned"];

/**
 * A variant's SKU and the product it hangs off — neither of which the form
 * asks for. Uniqueness is checked against every variant in the catalogue
 * rather than this product's, because two products sharing a SKU is exactly
 * the mix-up a SKU exists to prevent.
 */
function deriveVariant(productSku: string, productId: string, all: RecordRow[]) {
  return (values: RecordRow, rows: RecordRow[], previous?: RecordRow): RecordRow => {
    if (previous) return values;
    return {
      ...values,
      product: productId,
      id: mintVariantSku(
        productSku,
        values.colour,
        values.size,
        all.map((variant) => variant.id),
      ),
    };
  };
}

export function AdminProductEditor({ productId }: { productId: string }) {
  const { products, categories, collections, variants, ready, commit } = useCatalog();
  const { items } = useStock();
  const router = useRouter();

  const product = products.find((entry) => entry.id === productId);
  /* The register is the only place a product is created, so anything that
     lands here without a record is a stale link or a hand-typed URL. */
  const [saved, setSaved] = useState(false);

  const categoryNames = categories.map((entry) => entry.name).filter(Boolean);
  const collectionNames = collections.map((entry) => entry.name).filter(Boolean);
  /* The stock record this product sells from — the source of both its sizes
     and the count on the shelf. `undefined` once that record is deleted. */
  const stockItem = findStockItem(items, product?.item ?? "");
  const stockSizes = stockItem ? sizesOf(items, stockItem.id) : FALLBACK_SIZES;
  const mine = variants.filter((variant) => variant.product === productId);
  const inStock = mine.reduce(
    (total, variant) => total + (Number.parseInt(variant.stock ?? "", 10) || 0),
    0,
  );

  if (!product) {
    return (
      <AdminPage
        back={{ href: "/admin/catalog/products", label: "Catalogue" }}
        eyebrow="Catalog · Product editor"
        icon={Package}
        lede="Nothing in the catalogue is filed under this slug."
        title={
          <>
            Product <em>not found</em>
          </>
        }
      >
        <Empty
          copy={
            ready
              ? `No product is filed under "${productId}". It may have been deleted from the register.`
              : "Reading the catalogue…"
          }
          icon={Package}
          title={ready ? "No such product" : "Loading"}
        />
      </AdminPage>
    );
  }

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const values: Record<string, string> = {};
    for (const [key, value] of form.entries()) values[key] = String(value).trim();

    commit("products", (current) =>
      current.map((entry) => (entry.id === productId ? { ...entry, ...values } : entry)),
    );

    setSaved(true);
    toast.success("Product saved", { description: `${values.name} was written to the catalogue.` });
  }

  const stats: Stat[] = [
    { label: "State", value: product.status ?? "Draft", icon: Package, tone: product.status === "Published" ? "mint" : "amber", note: "Set below and saved with the record" },
    { label: "Stock code", value: product.sku ?? "—", icon: Tag, tone: "sky", note: "Minted from the name" },
    { label: "Variants", value: String(mine.length).padStart(2, "0"), icon: Tag, tone: "violet", note: "Each with its own stock" },
    { label: "In stock", value: String(inStock), icon: Package, tone: inStock ? "sky" : "rose", note: inStock ? "Across every size" : "Nothing to sell yet" },
  ];

  return (
    <AdminPage
      actions={
        <>
          <Btn form="aui-product-form" type="submit" variant="solid">
            <Save aria-hidden size={15} strokeWidth={1.8} /> {saved ? "Saved" : "Save product"}
          </Btn>
          <Btn
            disabled={product.status === "Published"}
            onClick={() => {
              commit("products", (current) =>
                current.map((entry) =>
                  entry.id === productId ? { ...entry, status: "Published" } : entry,
                ),
              );
              toast.success("Published", {
                description: `${product.name} is live on the storefront.`,
              });
            }}
          >
            Publish product
          </Btn>
        </>
      }
      back={{ href: "/admin/catalog/products", label: "Catalogue" }}
      eyebrow="Catalog · Product editor"
      icon={Package}
      lede="Everything about this product on one screen. A draft is always saveable; publishing is one control, not a wizard."
      spec={[
        { label: "Slug", value: product.id },
        { label: "Code", value: product.sku ?? "—" },
        { label: "State", value: product.status ?? "Draft" },
      ]}
      title={
        <>
          Edit <em>{product.name}</em>
        </>
      }
    >
      <StatGrid stats={stats} />

      <div className="aui-grid aui-grid--2">
        <Section
          copy="The facts the storefront reads. Everything here is safe to change on a live product."
          eyebrow="Details"
          title="Product truth"
        >
          <Panel>
            <form className="aui-form aui-form--2" id="aui-product-form" onSubmit={save}>
              <Field label="Product name">
                <input defaultValue={product.name} name="name" required />
              </Field>
              <Field label="Price">
                <input defaultValue={product.price} name="price" required />
              </Field>
              <Field label="Collection">
                <Select
                  defaultValue={product.collection ?? collectionNames[0] ?? COLLECTIONS_FALLBACK[0]}
                  name="collection"
                  options={collectionNames.length ? collectionNames : COLLECTIONS_FALLBACK}
                />
              </Field>
              <Field label="Category">
                <Select
                  defaultValue={product.category ?? categoryNames[0] ?? CATEGORIES_FALLBACK[0]}
                  name="category"
                  options={categoryNames.length ? categoryNames : CATEGORIES_FALLBACK}
                />
              </Field>
              <Field label="State">
                <Select defaultValue={product.status ?? "Draft"} name="status" options={PRODUCT_STATES} />
              </Field>
              <Field label="Tax class">
                <Select
                  defaultValue={product.tax ?? "Apparel · 12%"}
                  name="tax"
                  options={["Apparel · 12%", "Accessories · 18%"]}
                />
              </Field>
              <Field full label="Short description">
                <textarea defaultValue={product.description ?? ""} name="description" rows={4} />
              </Field>
            </form>
          </Panel>
        </Section>

        <Section
          copy="What this product is filed under, and the stock record it sells from."
          eyebrow="Identity"
          title="Slug, code and stock"
        >
          <Panel>
            <div style={{ display: "grid", gap: 16 }}>
              <div className="aui-dl">
                <div>
                  <dt>Slug</dt>
                  <dd>{product.id}</dd>
                </div>
                <div>
                  <dt>SKU prefix</dt>
                  <dd>{product.sku ?? "—"}</dd>
                </div>
                <div>
                  <dt>Public URL</dt>
                  <dd>/products/{product.id}</dd>
                </div>
                <div>
                  <dt>Stock item</dt>
                  {/* Read live rather than copied in, so reserving pieces on the
                      inventory screen shows up here without a second edit. */}
                  <dd>
                    {stockItem
                      ? `${stockItem.itemName} · ${available(stockItem)} available`
                      : "No longer in inventory"}
                  </dd>
                </div>
              </div>
              <Note icon={AlertTriangle} tone="warn">
                The slug and the code do not follow a rename. The slug is a URL a customer may
                already hold, and the code is stamped on every SKU below it.
              </Note>
              <Btn
                onClick={() => {
                  commit("products", (current) => current.filter((entry) => entry.id !== productId));
                  toast.success("Product deleted", {
                    description: `${product.name} was removed from the catalogue.`,
                  });
                  router.push("/admin/catalog/products");
                }}
                variant="danger"
                wide
              >
                Delete this product
              </Btn>
            </div>
          </Panel>
        </Section>
      </div>

      <Section
        copy="Each size and colour is its own record with its own stock. Add, edit or remove them here."
        eyebrow="Variants"
        title={mine.length === 1 ? "1 variant" : `${mine.length} variants`}
      >
        <RecordManager
          columns={VARIANT_COLUMNS}
          derive={deriveVariant(product.sku ?? "SKU", productId, variants)}
          emptyHint="Nothing is buyable until this product has a size to buy. Add the first variant to get started."
          fields={variantFields(stockSizes)}
          filterKey="status"
          filterValues={VARIANT_STATES}
          icon={Tag}
          onCommit={(next) => commit("variants", next)}
          /* The register shows this product's sizes; the store holds every
             product's, so the updater is re-aimed at the whole list. */
          rows={mine}
          searchKeys={["id", "colour", "size", "status"]}
          singular="variant"
          tone="violet"
        />
      </Section>
    </AdminPage>
  );
}
