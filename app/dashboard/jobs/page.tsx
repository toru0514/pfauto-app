import { getDashboardData } from "../actions";
import { JobsContent } from "@/components/dashboard/dashboard-content";

export const dynamic = "force-dynamic";

export default async function JobsPage() {
  const { jobs } = await getDashboardData();

  return <JobsContent jobs={jobs} />;
}
