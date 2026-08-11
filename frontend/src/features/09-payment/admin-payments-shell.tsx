"use client";

import { Banknote, CircleDollarSign, RefreshCw, Scale, WalletCards } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/admin/payments", label: "Overview", icon: CircleDollarSign },
  { href: "/admin/payments/transactions", label: "Transactions", icon: WalletCards },
  { href: "/admin/payments/refunds", label: "Refunds", icon: RefreshCw },
  { href: "/admin/payments/mismatches", label: "Mismatches", icon: Scale },
  { href: "/admin/payments/reconciliation", label: "Reconciliation", icon: Banknote },
  { href: "/admin/payments/settlements", label: "Settlements", icon: Banknote },
];

export function PaymentModuleNav() {
  const pathname = usePathname();
  return (
    <nav className="admin-module-nav" aria-label="Payment administration">
      {links.map(({ href, label, icon: Icon }) => (
        <Link className={pathname === href ? "is-current" : ""} href={href} key={href}><Icon aria-hidden="true" size={15} />{label}</Link>
      ))}
    </nav>
  );
}
