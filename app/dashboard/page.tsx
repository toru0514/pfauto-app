import { getDashboardData, getSpreadsheetUrl } from "./actions";
import { DashboardContent } from "@/components/dashboard/dashboard-content";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [{ products, jobs }, spreadsheetUrl] = await Promise.all([
    getDashboardData(),
    getSpreadsheetUrl(),
  ]);

  return (
    <main className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto max-w-6xl">
        <DashboardContent products={products} jobs={jobs} spreadsheetUrl={spreadsheetUrl} />
      </div>
    </main>
  );
}
