"use client";

import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Eye,
  EyeOff,
  ImageOff,
  Pencil,
  RefreshCw,
  Shirt,
  Trash2,
  Wand2,
} from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { useRegisterList } from "@/api/use-register";
import { MediaField } from "@/components/shell/media-field";
import {
  AdminPage,
  Btn,
  ConfirmDialog,
  DetailList,
  Empty,
  Field,
  IconBtn,
  Modal,
  Note,
  Panel,
  Section,
  Select,
  Status,
  type SelectOption,
  type StatusTone,
} from "@/components/shell/admin-ui";
import type { RecordRow } from "@/components/shell/record-manager";
import { useHeroBoard } from "@/features/19b-home-hero/api/hero-board";
import type {
  CutoutState,
  HeroCard,
  HeroSource,
} from "@/features/19b-home-hero/types/hero-slide";

/**
 * The home page hero, as a screen an operator owns.
 *
 * The hero used to be three PNGs compiled into the frontend bundle, which made
 * the most valuable surface on the site the one thing nobody could change
 * without a deploy. This is that decision handed back: choose the garments, set
 * the running order.
 *
 * A garment gets its picture one of two ways, and the default is the one that
 * needs no work: **use a product's own photo**. The piece leading the home page
 * is nearly always a piece already in the catalogue with a photograph already
 * against it, so the form offers that list first and only falls back to an
 * upload for art direction — a shot taken for the hero and used nowhere else.
 *
 * The thing this screen is actually about is what happens next, on its own: a
 * hero garment has to float, so whichever frame is chosen goes to remove.bg and
 * the cutout is stored beside it. That is why each card shows both frames side
 * by side — a cutout is judged by comparing it to what it came from, and a
 * screen that showed only the result would make a bad segmentation impossible
 * to spot.
 *
 * A slide only reaches the home page once its cutout is `Ready`. Everything
 * else — waiting, failed, no API key — stays here with the reason on it and a
 * Retry beside the reason.
 */

/* Radix will not carry an empty string as an item value, so "no product" needs
   a token of its own. It is mapped back to "" on the way out. */
const NO_PRODUCT = "__none__";

/** How each cutout state should read, and in what colour. */
const CUTOUT_TONE: Record<CutoutState, StatusTone> = {
  Ready: "good",
  Pending: "warn",
  Skipped: "warn",
  Failed: "bad",
};

/**
 * The catalogue as a dropdown.
 *
 * `forPhoto` is what makes this two lists rather than one. When the slide is
 * taking the product's own photograph, a product that has never been shot
 * cannot be chosen — but it is left on the list, disabled and saying why,
 * rather than filtered off it. An operator looking for a piece that is missing
 * from a menu concludes the menu is broken; one that is present and greyed out
 * with "no photo" beside it has just been told what to go and fix.
 */
function productOptions(rows: RecordRow[], forPhoto: boolean): SelectOption[] {
  const products = rows
    .filter((row) => typeof row.id === "string" && row.id !== "")
    .map((row) => {
      const name = row.name || row.id;
      const noPhoto = !row.image;
      /* Status rides along because it decides whether the hero's product link
         works at all: only Published products are served to shoppers. */
      const status = row.status && row.status !== "Published" ? ` · ${row.status}` : "";

      return {
        value: String(row.id),
        label: forPhoto && noPhoto ? `${name} · no photo` : `${name}${status}`,
        disabled: forPhoto && noPhoto,
      };
    });

  /* Only the upload path may leave the product blank. A slide taking its
     picture FROM a product has no meaning without one. */
  return forPhoto ? products : [{ value: NO_PRODUCT, label: "No product — art only" }, ...products];
}

/** "" for the sentinel, the slug otherwise. */
function slugOf(value: string) {
  return value === NO_PRODUCT ? "" : value;
}

/**
 * The form both the add panel and the edit dialog draw.
 *
 * One component rather than two near-copies, because the rule it encodes —
 * which fields belong to which source, and that exactly one of them is answered
 * — is the part most likely to be got wrong twice. `slide` is the record being
 * edited, or null when adding.
 */
function HeroForm({
  slide,
  products,
  busy,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  slide: HeroCard | null;
  products: RecordRow[];
  busy: boolean;
  submitLabel: string;
  onSubmit: (values: {
    source: "upload" | "product";
    product: string;
    image: string;
    alt: string;
  }) => void;
  onCancel?: () => void;
}) {
  /* Controlled, unlike the rest of this console's forms, because the choice
     decides which fields exist — an uncontrolled radio cannot re-render the
     panel underneath it. Everything the choice does NOT govern stays
     uncontrolled and is read out of the form on submit. */
  const [kind, setKind] = useState<HeroSource>(slide?.sourceKind ?? "Product");
  const [product, setProduct] = useState(
    slide === null || slide.product === "" ? "" : slide.product,
  );

  const fromProduct = kind === "Product";
  const chosen = products.find((row) => row.id === product);
  /* What the slide would be cut from if it were saved right now: the product's
     current photo, which is not necessarily the frame an existing slide was cut
     from. Showing it here is how "this is out of date" becomes visible before
     the save rather than after it. */
  const preview = fromProduct ? (chosen?.image ?? "") : "";

  return (
    <form
      className="hero-form"
      onSubmit={(event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const values = new FormData(event.currentTarget);

        onSubmit({
          source: fromProduct ? "product" : "upload",
          product: fromProduct ? product : slugOf(String(values.get("product") ?? NO_PRODUCT)),
          image: String(values.get("image") ?? ""),
          alt: String(values.get("alt") ?? ""),
        });
      }}
    >
      <Field full group label="Where the picture comes from">
        <div className="hero-source">
          <label className="aui-check hero-source__opt">
            <input
              checked={fromProduct}
              name="source"
              onChange={() => setKind("Product")}
              type="radio"
              value="product"
            />
            <span aria-hidden className="aui-check__box" />
            <span className="aui-check__copy">
              <strong>Use a product&rsquo;s photo</strong>
              <small>
                The photograph already on the piece in the catalogue. Re-shoot it there and
                press Cut again to bring the hero up to date.
              </small>
            </span>
          </label>

          <label className="aui-check hero-source__opt">
            <input
              checked={!fromProduct}
              name="source"
              onChange={() => setKind("Upload")}
              type="radio"
              value="upload"
            />
            <span aria-hidden className="aui-check__box" />
            <span className="aui-check__copy">
              <strong>Upload a photograph</strong>
              <small>A frame shot for the hero and used nowhere else.</small>
            </span>
          </label>
        </div>
      </Field>

      {fromProduct ? (
        <Field
          full
          help="Only pieces that have been photographed can lead the hero. The rest are listed but cannot be chosen."
          label="Product"
        >
          <span className="hero-pick">
            <span className="hero-pick__frame">
              {preview ? (
                /* A plain <img>: the src is a runtime API URL, which the static
                   export's image optimiser has no build-time way to resolve. */
                /* eslint-disable-next-line @next/next/no-img-element */
                <img alt="" className="hero-pick__img" src={preview} />
              ) : (
                <span className="hero-card__blank">
                  <ImageOff aria-hidden size={16} strokeWidth={1.5} />
                  No photo
                </span>
              )}
            </span>
            <span className="hero-pick__control">
              <Select
                ariaLabel="Product"
                onValueChange={setProduct}
                options={productOptions(products, true)}
                placeholder="Choose a product…"
                value={product}
              />
            </span>
          </span>
        </Field>
      ) : (
        <>
          <Field
            full
            help="Shoot the piece on a plain backdrop — a ghost mannequin or a hanger both work. JPEG, PNG or WebP."
            label="Photograph"
          >
            <MediaField
              defaultValue={slide?.sourceKind === "Upload" ? slide.source : ""}
              label="Garment photograph"
              name="image"
            />
          </Field>

          <Field help="Where the hero sends a shopper who clicks this garment." label="Product">
            <Select
              ariaLabel="Product"
              defaultValue={slide === null || slide.product === "" ? NO_PRODUCT : slide.product}
              name="product"
              options={productOptions(products, false)}
              placeholder="No product"
            />
          </Field>
        </>
      )}

      <Field
        full={fromProduct}
        help="What a screen reader announces. Left empty, the product's name is used."
        hint="optional"
        label="Alt text"
      >
        <input
          defaultValue={slide?.alt ?? ""}
          maxLength={190}
          name="alt"
          placeholder="Black heavyweight hoodie, ghost mannequin"
          type="text"
        />
      </Field>

      <div className="hero-form__act">
        {onCancel && (
          <Btn onClick={onCancel} type="button">
            Cancel
          </Btn>
        )}
        <Btn disabled={busy || (fromProduct && product === "")} type="submit" variant="solid">
          {busy ? "Saving…" : submitLabel}
        </Btn>
      </div>
    </form>
  );
}

export function HeroWorkspace() {
  const { board, loading, loaded, error, add, save, recut, reorder, remove } = useHeroBoard();
  /* The catalogue register the rest of the console already reads, so the
     product list here is one shared request rather than a second copy of the
     catalogue with its own idea of what is published — and its rows already
     carry each product's photo, so choosing one needs no extra endpoint. */
  const products = useRegisterList("/admin/catalog/products");

  /** What is in flight, so nothing can be pressed twice into two requests. */
  const [busy, setBusy] = useState<string | null>(null);
  /* Bumped after a successful add. The photograph field holds its state
     internally — it uploads on choose, not on submit — so the only honest way
     to clear it is to remount the form. */
  const [formKey, setFormKey] = useState(0);
  const [editing, setEditing] = useState<HeroCard | null>(null);
  const [removing, setRemoving] = useState<HeroCard | null>(null);

  const slides = board?.slides ?? [];
  const configured = board?.cutout.configured ?? false;
  const provider = board?.cutout.provider ?? "remove.bg";
  const liveCount = slides.filter((slide) => slide.live).length;
  const stale = slides.filter((slide) => slide.sourceStale);
  /* Cut out successfully, but into something the hero cannot draw as a floating
     garment. Rolled up here as well as marked per card, because it is the one
     failure of this screen that looks fine in the console and wrong on the
     site. */
  const boxy = slides.filter((slide) => slide.cutoutFillsFrame);
  const full = board !== null && slides.length >= board.maxSlides;

  /** Every verb goes through here, so one place owns the spinner and the toast. */
  async function run(key: string, work: () => Promise<void>, done: string) {
    if (busy !== null) return;

    setBusy(key);

    try {
      await work();
      toast.success(done);
    } catch (failure) {
      /* The normaliser has already turned this into a sentence written to be
         shown, so it is shown rather than reworded. */
      toast.error(failure instanceof Error ? failure.message : "That did not save.");
    } finally {
      setBusy(null);
    }
  }

  function move(index: number, by: -1 | 1) {
    const next = [...slides];
    const target = index + by;

    if (target < 0 || target >= next.length) return;

    [next[index], next[target]] = [next[target], next[index]];

    void run("order", () => reorder(next.map((slide) => slide.id)), "Running order saved.");
  }

  return (
    <AdminPage
      eyebrow="Home page · Hero"
      icon={Shirt}
      lede="The garments that fly through the top of the home page. Take a product's own photograph or upload one — the background comes off automatically, and only a garment that has been cut out goes live."
      spec={[
        { label: "Garments", value: String(slides.length) },
        { label: "On the home page", value: String(liveCount) },
        { label: "Background removal", value: configured ? "Connected" : "Not connected" },
      ]}
      title={
        <>
          Hero <em>garments</em>
        </>
      }
    >
      {error && (
        <Note icon={AlertTriangle} title="The hero could not be read" tone="bad">
          {error}
        </Note>
      )}

      {loaded && !configured && (
        <Note icon={Wand2} title={`${provider} is not connected`} tone="warn">
          Photographs still save, but nothing is cut out and no garment can go live. Set{" "}
          <code>REMOVE_BG_API_KEY</code> in <code>backend/.env</code>, restart the API, then
          press Retry on each garment.
        </Note>
      )}

      {stale.length > 0 && (
        <Note icon={RefreshCw} title="The catalogue has moved on" tone="warn">
          {stale.length === 1
            ? `${stale[0].productName || "One garment"} has been re-photographed since it was cut out.`
            : `${stale.length} garments have been re-photographed since they were cut out.`}{" "}
          Press <strong>Cut again</strong> on each to bring the home page up to date.
        </Note>
      )}

      {boxy.length > 0 && (
        <Note icon={AlertTriangle} title="Some garments will not float" tone="warn">
          {boxy.length === 1
            ? `${boxy[0].productName || boxy[0].alt || "One garment"} came back`
            : `${boxy.length} garments came back`}{" "}
          still touching the frame, which the hero draws as a rectangle. Flat-lay and cropped
          photographs cannot be cut out into a floating garment — use a shot of the piece
          against a plain backdrop, or hide them until you have one.
        </Note>
      )}

      <Section
        copy="Pick the piece from the catalogue and its photograph is sent for background removal when you save."
        eyebrow="Add"
        title="Add a garment"
      >
        <Panel>
          <HeroForm
            busy={busy === "add"}
            key={formKey}
            onSubmit={(values) => {
              if (values.source === "upload" && values.image === "") {
                toast.error("Choose a photograph of the garment first.");
                return;
              }

              void run(
                "add",
                async () => {
                  await add(values);
                  setFormKey((key) => key + 1);
                },
                configured
                  ? "Garment saved — check the cutout on its card."
                  : `Garment saved. ${provider} is not connected, so nothing was cut out yet.`,
              );
            }}
            products={products.rows}
            slide={null}
            submitLabel={full ? "Hero is full" : "Save garment"}
          />
          {full && (
            <p className="hero-form__note">
              The hero holds {board?.maxSlides} garments. Remove one to add another.
            </p>
          )}
        </Panel>
      </Section>

      <Section
        copy="Shown in this order, one garment at a time. Only the cut-out ones appear on the site."
        eyebrow="Running order"
        title="What the home page shows"
      >
        {slides.length === 0 ? (
          <Empty
            copy={
              loading && !loaded
                ? "Reading the hero…"
                : "Nothing has been chosen yet, so the home page is showing its built-in garments. Add one above to take it over."
            }
            icon={Shirt}
            title="No hero garments yet"
          />
        ) : (
          <ol className="hero-run">
            {slides.map((slide, index) => (
              <li className="hero-card" key={slide.id}>
                <div className="hero-card__frames">
                  <figure className="hero-card__frame">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img alt="" className="hero-card__img" src={slide.source} />
                    <figcaption>
                      {slide.sourceKind === "Product" ? "Catalogue" : "Uploaded"}
                    </figcaption>
                  </figure>

                  <figure className="hero-card__frame hero-card__frame--cutout">
                    {slide.cutout ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img alt="" className="hero-card__img" src={slide.cutout} />
                    ) : (
                      <span className="hero-card__blank">
                        <ImageOff aria-hidden size={18} strokeWidth={1.5} />
                        Not cut out
                      </span>
                    )}
                    <figcaption>Cutout</figcaption>
                  </figure>
                </div>

                <div className="hero-card__body">
                  <p className="hero-card__pos">Position {index + 1}</p>
                  <h3 className="hero-card__title">
                    {slide.alt || slide.productName || "Untitled garment"}
                  </h3>

                  <p className="hero-card__states">
                    <Status
                      tone={slide.live ? "good" : "idle"}
                      value={slide.live ? "On the home page" : "Not showing"}
                    />
                    <Status tone={CUTOUT_TONE[slide.cutoutState]} value={slide.cutoutState} />
                    <Status
                      tone="info"
                      value={slide.sourceKind === "Product" ? "From catalogue" : "Uploaded"}
                    />
                    {slide.cutoutFillsFrame && <Status tone="warn" value="Fills the frame" />}
                  </p>

                  {slide.cutoutDetail && <p className="hero-card__detail">{slide.cutoutDetail}</p>}

                  {slide.cutoutFillsFrame && (
                    <p className="hero-card__detail">
                      This cutout still touches all four edges, so the hero will draw it as a
                      rectangle rather than as a garment hanging in space — the source looks
                      like a flat-lay or a crop.{" "}
                      {slide.sourceKind === "Product"
                        ? "Re-shoot the piece against a plain backdrop on the product, or upload a frame here instead."
                        : "Upload a shot of the piece against a plain backdrop."}
                    </p>
                  )}

                  {slide.sourceStale && (
                    <p className="hero-card__detail">
                      {slide.productName} has a newer photograph in the catalogue than the one
                      this was cut from. Press Cut again to use it.
                    </p>
                  )}

                  {slide.product !== "" && slide.productStatus !== "Published" && (
                    <p className="hero-card__detail">
                      {slide.productName} is {slide.productStatus.toLowerCase()}, so this garment
                      links to a page shoppers cannot open yet.
                    </p>
                  )}

                  <DetailList
                    rows={[
                      { label: "Product", value: slide.productName || "—" },
                      { label: "Last cutout", value: slide.cutoutAt || "Not attempted" },
                    ]}
                  />
                </div>

                <div className="hero-card__acts">
                  <span className="hero-card__order">
                    <IconBtn
                      disabled={busy !== null || index === 0}
                      icon={ArrowUp}
                      label="Move earlier"
                      onClick={() => move(index, -1)}
                    />
                    <IconBtn
                      disabled={busy !== null || index === slides.length - 1}
                      icon={ArrowDown}
                      label="Move later"
                      onClick={() => move(index, 1)}
                    />
                  </span>

                  <Btn
                    disabled={busy !== null}
                    onClick={() =>
                      void run(
                        `cut:${slide.id}`,
                        () => recut(slide.id),
                        "Background removal ran again.",
                      )
                    }
                    size="sm"
                  >
                    <RefreshCw aria-hidden size={13} strokeWidth={1.8} />
                    {busy === `cut:${slide.id}`
                      ? "Cutting…"
                      : slide.cutoutState === "Ready"
                        ? "Cut again"
                        : "Retry cutout"}
                  </Btn>

                  <Btn
                    disabled={busy !== null}
                    onClick={() =>
                      void run(
                        `show:${slide.id}`,
                        () => save(slide.id, { active: !slide.active }),
                        slide.active ? "Garment hidden." : "Garment switched on.",
                      )
                    }
                    size="sm"
                  >
                    {slide.active ? (
                      <EyeOff aria-hidden size={13} strokeWidth={1.8} />
                    ) : (
                      <Eye aria-hidden size={13} strokeWidth={1.8} />
                    )}
                    {slide.active ? "Hide" : "Show"}
                  </Btn>

                  <Btn disabled={busy !== null} onClick={() => setEditing(slide)} size="sm">
                    <Pencil aria-hidden size={13} strokeWidth={1.8} />
                    Edit
                  </Btn>

                  <IconBtn
                    danger
                    disabled={busy !== null}
                    icon={Trash2}
                    label={`Remove ${slide.alt || slide.productName || "this garment"}`}
                    onClick={() => setRemoving(slide)}
                  />
                </div>
              </li>
            ))}
          </ol>
        )}
      </Section>

      <Modal
        description="Changing which picture this garment uses runs background removal again. Changing the words does not."
        icon={Shirt}
        onOpenChange={(next) => !next && setEditing(null)}
        open={editing !== null}
        title="Edit garment"
      >
        {editing && (
          <HeroForm
            busy={busy === `edit:${editing.id}`}
            key={editing.id}
            onCancel={() => setEditing(null)}
            onSubmit={(values) => {
              if (values.source === "upload" && values.image === "") {
                toast.error("Choose a photograph of the garment first.");
                return;
              }

              const slide = editing;
              const changed =
                values.source !== (slide.sourceKind === "Product" ? "product" : "upload") ||
                values.product !== slide.product ||
                (values.source === "upload" && values.image !== slide.source);

              void run(
                `edit:${slide.id}`,
                async () => {
                  await save(slide.id, {
                    alt: values.alt,
                    /* The source fields only travel when something about the
                       picture actually moved. A patch that carries them anyway
                       would be asking the server to re-decide the frame — and
                       pay for a cutout — over an alt-text fix. */
                    ...(changed
                      ? {
                          source: values.source,
                          product: values.product,
                          ...(values.source === "upload" ? { image: values.image } : {}),
                        }
                      : {}),
                  });
                  setEditing(null);
                },
                changed ? "Picture changed — cutting it out." : "Garment updated.",
              );
            }}
            products={products.rows}
            slide={editing}
            submitLabel="Save changes"
          />
        )}
      </Modal>

      <ConfirmDialog
        confirmLabel="Remove garment"
        description={
          removing
            ? `${removing.alt || removing.productName || "This garment"} will stop showing on the home page. The photographs stay where they are.`
            : ""
        }
        onConfirm={() => {
          const slide = removing;
          setRemoving(null);
          if (slide) {
            void run(`del:${slide.id}`, () => remove(slide.id), "Garment removed from the hero.");
          }
        }}
        onOpenChange={(next) => !next && setRemoving(null)}
        open={removing !== null}
        title="Remove this garment?"
      />
    </AdminPage>
  );
}
