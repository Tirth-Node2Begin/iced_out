import "@/styles/components/pages.css";

import type { Metadata } from "next";
import { Suspense } from "react";

import { SearchResults } from "@/features/06-search";

export const metadata: Metadata = { title: "Search", robots: { index: false, follow: false } };

export default function SearchPage() {
  return (
    <>
      <Suspense fallback={<div className="search-route-loading skeleton" />}>
        <SearchResults />
      </Suspense>
    </>
  );
}
