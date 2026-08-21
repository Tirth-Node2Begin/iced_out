import type { RecordRow } from "@/components/admin/record-manager";

/**
 * The catalogue's vocabularies — the states a record can be in, and the order the
 * filter chips sit in.
 *
 * What this file used to hold as well was `SEEDED`: five products, four
 * categories, three collections and ten variants, written into `localStorage` on
 * first load. That was the console's demo data, and it is gone — the registers
 * read `/admin/catalog/*` now, so what is on screen is what the database holds.
 * The id-minting helpers went with it: a slug is a URL somebody may keep and a
 * SKU is stamped on what ships, so both are the server's to mint (`SkuMinter`) —
 * a browser minting its own is how two operators create the same slug twice.
 *
 * Kept out of `catalog-context` and kept free of `"use client"`: it is plain data,
 * so it costs a server component nothing to read — an export pulled across a
 * client boundary arrives on the server as a reference proxy rather than the
 * value it looks like.
 *
 * These lists mirror the vocabularies in `store_settings`, which the API
 * validates against (`CatalogController::assertVocabulary`). They have to agree:
 * a state offered here that the server rejects is a dropdown that cannot be
 * submitted.
 */
export type CatalogRecord = RecordRow;

export type CatalogKind = "products" | "categories" | "collections" | "variants";

export const PRODUCT_STATES = ["Published", "Scheduled", "Draft"];

/**
 * A collection is `Live`, not `Published`.
 *
 * This said "Published" while the API has always validated collections against
 * `Live, Scheduled, Draft` — so the state the form offered first was the one
 * state the server would refuse. It only ever worked because nothing was
 * reaching the server.
 */
export const COLLECTION_STATES = ["Live", "Scheduled", "Draft"];

export const VARIANT_STATES = ["Active", "Low", "Out", "Archived"];

/**
 * Sizes for a product whose stock record has gone.
 *
 * A product's real vocabulary comes from the inventory item it sells from —
 * letters for a top, waist inches for a bottom — and is asked for there. This
 * is only what is left to offer when that item can no longer be found, so the
 * variant form still has something to show rather than an empty menu.
 */
export const FALLBACK_SIZES = ["S", "M", "L", "XL"];
