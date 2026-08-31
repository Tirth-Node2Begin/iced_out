"use client";

import { AlertTriangle, Package, Save, Tag } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { StatGrid, type Stat } from "@/components/shell/admin-stats";
import { MediaField } from "@/components/shell/media-field";
import { MediaGalleryField } from "@/components/shell/media-gallery-field";
import { AdminPage, Btn, Empty, Field, Note, Panel, Section, Select } from "@/components/shell/admin-ui";
import {
  RecordManager,
  type Column,
  type FormField,
  type RecordRow,
} from "@/components/shell/record-manager";
import { useCatalogRegisters } from "@/features/02-products/catalog-context";
import {
  FALLBACK_SIZES,
  PRODUCT_STATES,
  VARIANT_STATES,
} from "@/features/02-products/catalog-seed";
import { available, findStockItem, sizesOf, useStock } from "@/features/03-inventory/stock-context";

/**
 * The product editor.
 *
 * It reads the record the DATABASE holds, so what you saved on the register is
 * what opens here — and saving writes back through PATCH
 * /admin/catalog/products/{slug}, which is what both the register and the
 * storefront re-read afterwards.
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
 * The product a new variant hangs off — which the form does not ask for, because
 * it is the product being edited.
 *
 * The SKU is NOT minted here any more. `SkuMinter::uniqueVariantSku` does it, and
 * has to: uniqueness is checked against every variant in the database rather than
 * the ones this browser happens to be holding, and two products sharing a SKU is
 * exactly the mix-up a SKU exists to prevent.
 */
function deriveVariant(productId: string) {
  return (values: RecordRow, _rows: RecordRow[], previous?: RecordRow): RecordRow =>
    previous ? values : { ...values, product: productId };
}

export function AdminProductEditor({ productId }: { productId: string }) {
  const { products, categories, collections, variants, ready, register, error } =
    useCatalogRegisters();
  const productRegister = register("products");
  const variantRegister = register("variants");
  /* The gallery hangs off the STOCK ITEM, not the listing — a piece photographs
     the same however it is sold. Editing it here therefore writes through the
     inventory register, which is why that register's verbs are pulled in too. */
  const { items, register: stockRegister } = useStock();
  const router = useRouter();
  /* Held while a save or a publish is in flight, so neither control can be
     pressed twice into two requests. */
  const [busy, setBusy] = useState(false);

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
        back={{ href: "/catalog/products", label: "Catalogue" }}
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

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const values: Record<string, string> = {};
    for (const [key, value] of form.entries()) values[key] = String(value).trim();

    if (!product) return;

    setBusy(true);

    try {
      /* Sent as the whole record merged over the current one, so the register's
         `toUpdate` can work out what actually moved — a price it did not change
         must not be re-logged in `product_price_history`. */
      await productRegister.onUpdate({ ...product, ...values }, product);

      /* The gallery is a second record, so it is a second write — and only when
         it actually moved, because a PATCH to the stock item touches a row the
         warehouse screens are also looking at. Sent after the product so a
         refused product edit does not leave the photographs changed for a
         listing that did not save. */
      const gallery = values.images ?? "";

      if (stockItem && gallery !== (stockItem.images ?? "")) {
        await stockRegister.onUpdate({ ...stockItem, images: gallery }, stockItem);
      }

      setSaved(true);
      toast.success("Product saved", {
        description: `${values.name} was written to the catalogue.`,
      });
    } catch (caught) {
      /* Shown rather than swallowed: without this the button read "Saved" over a
         product the server had refused to change. */
      toast.error("That could not be saved", {
        description: caught instanceof Error ? caught.message : "The server refused the change.",
      });
    } finally {
      setBusy(false);
    }
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
          <Btn disabled={busy} form="aui-product-form" type="submit" variant="solid">
            <Save aria-hidden size={15} strokeWidth={1.8} />{" "}
            {busy ? "Saving…" : saved ? "Saved" : "Save product"}
          </Btn>
          <Btn
            disabled={busy || product.status === "Published"}
            onClick={() => {
              setBusy(true);
              productRegister
                .onUpdate({ ...product, status: "Published" }, product)
                .then(() =>
                  toast.success("Published", {
                    description: `${product.name} is live on the storefront.`,
                  }),
                )
                .catch((caught: unknown) =>
                  toast.error("That could not be published", {
                    description:
                      caught instanceof Error ? caught.message : "The server refused the change.",
                  }),
                )
                .finally(() => setBusy(false));
            }}
          >
            Publish product
          </Btn>
        </>
      }
      back={{ href: "/catalog/products", label: "Catalogue" }}
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
            <form
              className="aui-form aui-form--2"
              id="aui-product-form"
              onSubmit={(event) => void save(event)}
            >
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

              {/* The photo. Uploaded to `POST /admin/media` the moment it is
                  chosen, so what this field submits is the stored asset's URL —
                  see `MediaField`. A product without one draws an empty frame
                  rather than borrowing a picture of another garment. */}
              <Field
                full
                help="The one frame the card, the bag and search show. Replacing it takes effect as soon as you save."
                label="Primary photo"
              >
                <MediaField defaultValue={product.image ?? ""} label="Product photo" name="image" />
              </Field>

              {/* The rest of the run, which the product page pages through.
                  It belongs to the STOCK ITEM this listing sells from, so it is
                  shown and edited here but saved there — see `save`. Where the
                  item is gone there is nothing to attach photographs to, and the
                  field says so instead of silently discarding them. */}
              <Field
                full
                help={
                  stockItem
                    ? `The gallery on ${stockItem.itemName}. Every listing of this item shows the same run, so a re-shoot only has to happen once.`
                    : "This listing has no stock record, so there is nowhere to keep a gallery. Point it at an item on the catalogue register first."
                }
                label="More photos"
              >
                {stockItem ? (
                  <MediaGalleryField
                    defaultValue={stockItem.images ?? ""}
                    key={stockItem.id}
                    label="Product gallery"
                    name="images"
                  />
                ) : (
                  <p className="aui-gallery__count">No stock item.</p>
                )}
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
                disabled={busy}
                onClick={() => {
                  setBusy(true);
                  productRegister
                    .onDelete(product)
                    .then(() => {
                      toast.success("Product deleted", {
                        description: `${product.name} was removed from the catalogue.`,
                      });
                      /* Only after the server confirms. Navigating first meant
                         landing back on a register that still listed the product
                         because the delete had failed. */
                      router.push("/catalog/products");
                    })
                    .catch((caught: unknown) =>
                      toast.error("That could not be deleted", {
                        description:
                          caught instanceof Error
                            ? caught.message
                            : "The server refused the change.",
                      }),
                    )
                    .finally(() => setBusy(false));
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
          derive={deriveVariant(productId)}
          emptyHint="Nothing is buyable until this product has a size to buy. Add the first variant to get started."
          fields={variantFields(stockSizes)}
          filterKey="status"
          filterValues={VARIANT_STATES}
          error={error}
          icon={Tag}
          loaded={variantRegister.loaded}
          loading={variantRegister.loading}
          onCreate={variantRegister.onCreate}
          onDelete={variantRegister.onDelete}
          onUpdate={variantRegister.onUpdate}
          /* This product's variants only. The register behind them holds every
             product's, and the endpoints address one by SKU, so no re-aiming is
             needed — see `catalog-context`. */
          rows={mine}
          searchKeys={["id", "colour", "size", "status"]}
          singular="variant"
          tone="violet"
        />
      </Section>
    </AdminPage>
  );
}
