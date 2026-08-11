"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type AdminModuleLink = { href: string; label: string };

export function AdminModuleNav({ label, links }: { label: string; links: AdminModuleLink[] }) {
  const pathname = usePathname();
  const activeHref = links
    .filter((link) => pathname === link.href || pathname.startsWith(`${link.href}/`))
    .sort((left, right) => right.href.length - left.href.length)[0]?.href;
  return (
    <nav className="admin-module-nav" aria-label={`${label} administration`}>
      {links.map((link) => (
        <Link
          className={activeHref === link.href ? "is-current" : ""}
          href={link.href}
          key={link.href}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
