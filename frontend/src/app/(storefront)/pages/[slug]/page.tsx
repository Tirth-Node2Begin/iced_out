import "@/styles/components/pages.css";

import { PolicyPage, policySlugs } from "@/features/19a-cms-read/components/policy-page";
export default async function PublicPolicyRoute({ params }: { params: Promise<{ slug: string }> }) { const { slug } = await params; return <PolicyPage slug={slug} />; }
export function generateStaticParams() { return policySlugs.map((slug) => ({ slug })); }
