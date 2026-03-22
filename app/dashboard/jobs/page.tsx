import { getDashboardData } from "../actions";
import { JobsContent } from "@/components/dashboard/dashboard-content";

export const dynamic = "force-dynamic";

export default async function JobsPage() {
  const { jobs } = await getDashboardData();

  return (
    <main className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto max-w-6xl">
        <JobsContent jobs={jobs} />
      </div>
    </main>
  );
}
