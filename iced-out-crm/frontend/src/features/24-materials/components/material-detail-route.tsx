"use client";

import { Layers, Scale, Shirt } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { toast } from "sonner";

import { AdminPage, Btn, DetailList, Empty, Panel, Section, Status } from "@/components/shell/admin-ui";
import { AdjustStockDialog } from "@/features/24-materials/components/adjust-stock-dialog";
import { useMaterial } from "@/features/24-materials/materials-api";
import {
  KIND_LABELS,
  MOVEMENT_LABELS,
  UNIT_LABELS,
  withUnit,
  type Movement,
} from "@/features/24-materials/types";

/**
 * One material: what is on the shelf, what it is used in, and every movement
 * that got it there.
 *
 * The LEDGER is the reason this screen exists. A count on its own is a claim; a
 * count with the receipts, consumptions and corrections behind it is a fact an
 * operator can argue with. Nothing in the system changes a material quantity
 * without writing a row here.
 */

/* Colour on the glyph, never on the row — the same rule as the rest of the
   console. Receipts and released holds are good news, consumption is neutral
   (it is the point of the material), write-offs and downward corrections are
   not. */
const MOVEMENT_TONES: Record<Movement["type"], string> = {
  RECEIPT: "mint",
  RELEASE: "mint",
  CONSUME: "ink",
  RESERVE: "amber",
  ADJUST_UP: "sky",
  ADJUST_DOWN: "amber",
  WASTAGE: "rose",
  RETURN_OUT: "rose",
};

function MaterialDetail() {
  const params = useSearchParams();
  const id = params.get("id") ?? "";
  const { detail, loading, loaded, reload } = useMaterial(id);
  const [adjusting, setAdjusting] = useState(false);

  if (!loaded && loading) {
    return (
      <AdminPage back={{ href: "/inventory/materials", label: "Materials" }} eyebrow="Inventory" title="Loading…">
        <p className="aui-muted">Reading the material…</p>
      </AdminPage>
    );
  }

  if (!detail) {
    return (
      <AdminPage back={{ href: "/inventory/materials", label: "Materials" }} eyebrow="Inventory" title="Not found">
        <Empty
          copy="It may have been removed, or the link may be wrong."
          icon={Layers}
          title="That material could not be found"
        />
      </AdminPage>
    );
  }

  const { material, movements, usedIn } = detail;
  const unit = UNIT_LABELS[material.unit] ?? material.unit;

  return (
    <AdminPage
      actions={
        <Btn onClick={() => setAdjusting(true)} variant="ghost">
          <Scale aria-hidden size={15} strokeWidth={1.7} /> Correct the count
        </Btn>
      }
      back={{ href: "/inventory/materials", label: "Materials" }}
      eyebrow={KIND_LABELS[material.kind] ?? material.kind}
      icon={Layers}
      lede={material.code || "No code recorded."}
      spec={[
        { label: "Free", value: withUnit(material.available, material.unit) },
        { label: "Held", value: withUnit(material.reserved, material.unit) },
        { label: "On shelf", value: withUnit(material.onHand, material.unit) },
        { label: "Value", value: material.stockValue },
      ]}
      title={material.name}
    >
      <div className="crm-detail">
        <Section eyebrow="Record" title="Details">
          <Panel>
            <DetailList
              rows={[
                { label: "Kind", value: KIND_LABELS[material.kind] ?? material.kind },
                { label: "Measured in", value: unit },
                { label: "Cost per unit", value: material.unitCost },
                {
                  label: "Warn below",
                  value:
                    material.reorderPoint === "0"
                      ? "Never"
                      : withUnit(material.reorderPoint, material.unit),
                },
                {
                  label: "Stock",
                  value: (
                    <Status
                      tone={
                        material.state === "Out" ? "bad" : material.state === "At risk" ? "warn" : "good"
                      }
                      value={material.state}
                    />
                  ),
                },
                { label: "Supplier", value: material.supplier?.name ?? "Not recorded" },
                {
                  label: "Lead time",
                  value: material.leadTimeDays > 0 ? `${material.leadTimeDays} days` : "Not recorded",
                },
                { label: "Held at", value: material.warehouse?.name ?? "Not recorded" },
                { label: "Notes", value: material.notes || "—" },
              ]}
            />
          </Panel>
        </Section>

        <Section
          copy="The garments this goes into, and how much of it each one takes — cutting loss included."
          eyebrow="Used in"
          title="Recipes"
        >
          <Panel>
            {usedIn.length === 0 && (
              <Empty
                copy="Set a recipe on a stock item to say it is made from this."
                icon={Shirt}
                inline
                title="Not on any recipe"
              />
            )}

            {usedIn.length > 0 && (
              <ul className="crm-linked">
                {usedIn.map((entry) => (
                  <li key={entry.itemId}>
                    <Link href={`/inventory/overview?q=${encodeURIComponent(entry.item)}`}>
                      <span>
                        <strong>{entry.item}</strong>
                        <small>{entry.perUnit} {unit} per piece</small>
                      </span>
                      <b>
                        {entry.effective} {unit}
                      </b>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </Section>
      </div>

      <Section
        copy="Every movement, newest first. Nothing changes this material's count without appearing here."
        eyebrow="History"
        title="Ledger"
      >
        <Panel>
          {movements.length === 0 && (
            <Empty
              copy="Receive a purchase order against it, and the first entry appears."
              icon={Layers}
              inline
              title="Nothing has moved yet"
            />
          )}

          {movements.length > 0 && (
            <ul className="mat-ledger">
              {movements.map((movement, index) => (
                <li className="mat-ledger__row" data-tone={MOVEMENT_TONES[movement.type]} key={index}>
                  <span className="mat-ledger__what">
                    <strong>{MOVEMENT_LABELS[movement.type] ?? movement.type}</strong>
                    <small>
                      {movement.at ?? "—"}
                      {movement.reference ? ` · ${movement.reference}` : ""}
                      {movement.actor ? ` · ${movement.actor}` : ""}
                    </small>
                  </span>

                  {movement.note && <span className="mat-ledger__note">{movement.note}</span>}

                  {/* A hold moves nothing on the shelf, so its `qty` is zero and
                      printing "0" beside it would read as an error rather than
                      as the truth. The reserved figure is what changed. */}
                  <b className="mat-ledger__qty">
                    {movement.qty === "0"
                      ? `${movement.reservedAfter} ${unit} held`
                      : `${Number(movement.qty) > 0 ? "+" : ""}${movement.qty} ${unit}`}
                  </b>

                  <span className="mat-ledger__after">
                    {movement.onHandAfter} {unit} left
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </Section>

      {adjusting && (
        <AdjustStockDialog
          material={material}
          onClose={() => setAdjusting(false)}
          onDone={async () => {
            setAdjusting(false);
            await reload();
            toast.success("The count was corrected.");
          }}
        />
      )}
    </AdminPage>
  );
}

/* `useSearchParams` suspends, and this page is statically exported — without the
   boundary the whole route opts out of prerendering. */
export function MaterialDetailRoute() {
  return (
    <Suspense fallback={<p className="aui-muted">Reading the material…</p>}>
      <MaterialDetail />
    </Suspense>
  );
}
