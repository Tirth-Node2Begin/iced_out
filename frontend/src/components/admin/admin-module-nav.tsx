"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * The screens inside one area, as a segmented pill above the page.
 *
 * The rail names areas; this names the screens in the area you are already in.
 * Keeping the second level here rather than nesting it in the rail is what
 * makes fourteen areas and fifty-five screens learnable — you only ever read one
 * list at a time, and it is always the list for where you are.
 */
export type AdminModuleLink = { href: string; label: string };

export function AdminModuleNav({
  label,
  links,
  inline,
}: {
  label: string;
  links: AdminModuleLink[];
  /**
   * Seats the pill in a list's toolbar instead of above the page, beside the
   * search field and the state chips. Which screen you are on and what you
   * have narrowed it to then read as one row of controls rather than two
   * bands separated by a page header.
   */
  inline?: boolean;
}) {
  const pathname = usePathname();

  /* Longest match wins: `/admin/catalog/products/edit` is on the products tab,
     not on whichever tab happens to be listed first. */
  const current = links
    .filter((link) => pathname === link.href || pathname.startsWith(`${link.href}/`))
    .sort((left, right) => right.href.length - left.href.length)[0]?.href;

  return (
    <nav
      aria-label={`${label} screens`}
      className={inline ? "aui-tabs aui-tabs--inline" : "aui-tabs"}
    >
      {links.map((link) => (
        <Link
          aria-current={current === link.href ? "page" : undefined}
          href={link.href}
          key={link.href}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
