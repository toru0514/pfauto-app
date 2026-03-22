import { getDashboardData, getSpreadsheetUrl } from "./actions";
import { DashboardContent } from "@/components/dashboard/dashboard-content";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [{ products, jobs }, spreadsheetUrl] = await Promise.all([
    getDashboardData(),
    getSpreadsheetUrl(),
  ]);

  return (
    <DashboardContent products={products} jobs={jobs} spreadsheetUrl={spreadsheetUrl} />
  );
}
