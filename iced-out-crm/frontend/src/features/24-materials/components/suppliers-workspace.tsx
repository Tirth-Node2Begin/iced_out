"use client";

import { Factory } from "lucide-react";
import { useCallback, useMemo } from "react";

import { AdminPage, type StatusTone } from "@/components/shell/admin-ui";
import {
  RecordManager,
  type Column,
  type FormField,
  type RecordRow,
} from "@/components/shell/record-manager";
import { materials as api, useSuppliers } from "@/features/24-materials/materials-api";
import type { Supplier } from "@/features/24-materials/types";

/**
 * Who the materials come from.
 *
 * The column that earns its place is LEAD TIME. A fabric that takes six weeks to
 * arrive is a different planning problem from one that takes three days, and
 * this is the only place in the system that difference is written down — it is
 * what turns "we are low on fleece" into "we needed to order it a fortnight
 * ago".
 */
function toRow(supplier: Supplier): RecordRow {
  return {
    id: supplier.id,
    name: supplier.name,
    contactName: supplier.contactName,
    email: supplier.email,
    phone: supplier.phone,
    city: supplier.city,
    country: supplier.country,
    leadTimeDays: String(supplier.leadTimeDays),
    leadTime: supplier.leadTime,
    status: supplier.status,
    statusCode: supplier.statusCode,
    materials: String(supplier.materialsCount),
    openPurchases: String(supplier.openPurchases),
    notes: supplier.notes,
  };
}

const STATUS_TONES: Record<string, StatusTone> = { Active: "good", Archived: "idle" };

export function SuppliersWorkspace() {
  const { suppliers, loading, error, loaded, reload } = useSuppliers({ status: "all" });

  const rows = useMemo(() => suppliers.map(toRow), [suppliers]);
  const after = useCallback(async () => {
    await reload();
  }, [reload]);

  const fields: FormField[] = useMemo(
    () => [
      { key: "name", label: "Supplier", required: true, full: true, placeholder: "Northside Mills" },
      { key: "contactName", label: "Who you deal with", placeholder: "R. Iyer" },
      { key: "email", label: "Email", type: "email", placeholder: "sales@mills.example" },
      { key: "phone", label: "Phone", type: "tel" },
      {
        key: "leadTimeDays",
        label: "Lead time",
        hint: "days",
        type: "number",
        min: "0",
        help: "How long an order takes to arrive. It is what tells you when a reorder point is too late to act on.",
      },
      { key: "city", label: "City" },
      { key: "country", label: "Country", initial: "India" },
      {
        key: "statusCode",
        label: "Status",
        type: "select",
        options: [
          { value: "ACTIVE", label: "Active" },
          { value: "ARCHIVED", label: "Archived" },
        ],
        initial: "ACTIVE",
        help: "Archiving keeps every material and purchase attached to them — it only takes the supplier out of the pickers.",
      },
      { key: "notes", label: "Notes", type: "textarea", full: true },
    ],
    [],
  );

  const columns: Column[] = useMemo(
    () => [
      { key: "name", label: "Supplier", primary: true, sub: "contactName" },
      { key: "city", label: "Where", hideSmall: true },
      { key: "leadTime", label: "Lead time", hideSmall: true },
      { key: "materials", label: "Materials", numeric: true, align: "right" },
      { key: "openPurchases", label: "Open POs", numeric: true, align: "right" },
      { key: "email", label: "Email", hideSmall: true },
      { key: "status", label: "Status", status: true },
    ],
    [],
  );

  return (
    <AdminPage
      eyebrow="Inventory"
      icon={Factory}
      lede="Where the materials come from, and how long each of them takes to arrive."
      spec={[
        { label: "Suppliers", value: String(suppliers.length) },
        {
          label: "With open orders",
          value: String(suppliers.filter((supplier) => supplier.openPurchases > 0).length),
        },
      ]}
      title={
        <>
          Material <em>suppliers</em>
        </>
      }
    >
      <RecordManager
        columns={columns}
        emptyHint="Add whoever the fabric, the trims and the labels come from. A material can name one, and a purchase order has to."
        error={error}
        fields={fields}
        filterKey="status"
        filterOrder={["Active", "Archived"]}
        filterValues={["Active", "Archived"]}
        icon={Factory}
        loaded={loaded}
        loading={loading}
        onCreate={async (values) => {
          await api.createSupplier({
            name: values.name,
            contactName: values.contactName,
            email: values.email,
            phone: values.phone,
            city: values.city,
            country: values.country,
            leadTimeDays: Number(values.leadTimeDays ?? 0) || 0,
            notes: values.notes,
          });
          await after();
        }}
        onDelete={async (row) => {
          await api.removeSupplier(row.id);
          await after();
        }}
        onUpdate={async (values, previous) => {
          await api.updateSupplier(previous.id, {
            name: values.name,
            contactName: values.contactName,
            email: values.email,
            phone: values.phone,
            city: values.city,
            country: values.country,
            leadTimeDays: Number(values.leadTimeDays ?? 0) || 0,
            status: values.statusCode,
            notes: values.notes,
          });
          await after();
        }}
        plural="suppliers"
        rows={rows}
        searchKeys={["id", "name", "contactName", "email", "city"]}
        singular="Supplier"
        statusTone={(row) => STATUS_TONES[row.status]}
      />
    </AdminPage>
  );
}
