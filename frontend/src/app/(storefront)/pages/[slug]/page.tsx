import "@/styles/components/pages.css";

import type { Metadata } from "next";

import { PolicyPage, policySlugs, policyTitle } from "@/features/19a-cms-read/components/policy-page";
export default async function PublicPolicyRoute({ params }: { params: Promise<{ slug: string }> }) { const { slug } = await params; return <PolicyPage slug={slug} />; }
export function generateStaticParams() { return policySlugs.map((slug) => ({ slug })); }
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> { const { slug } = await params; return { title: policyTitle(slug) }; }
