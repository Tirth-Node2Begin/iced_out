import type { ReactNode } from "react";
import { AdminModuleNav } from "@/components/admin/admin-module-nav";
export default function CatalogLayout({ children }: { children: ReactNode }) { return <><AdminModuleNav label="Catalog" links={["products","categories","collections","imports"].map((page) => ({href:`/admin/catalog/${page}`,label:page}))} />{children}</>; }
