import { AnalyticsReport, type AnalyticsReportView } from "@/features/16-analytics/components/analytics-report";
const reports: AnalyticsReportView[] = ["sales", "products", "customers", "inventory", "returns", "search", "shipping", "support"];
export default async function AnalyticsReportPage({ params }: { params: Promise<{ report: AnalyticsReportView }> }) { const { report } = await params; return <AnalyticsReport view={reports.includes(report) ? report : "sales"} />; }
export function generateStaticParams() { return reports.map((report) => ({ report })); }
