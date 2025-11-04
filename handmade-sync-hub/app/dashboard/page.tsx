import { getDashboardData } from "./actions";
import { DashboardContent } from "@/components/dashboard/dashboard-content";

export default async function DashboardPage() {
  const { products, jobs } = await getDashboardData();

  return (
    <main className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto max-w-6xl">
        <DashboardContent products={products} jobs={jobs} />
      </div>
    </main>
  );
}
