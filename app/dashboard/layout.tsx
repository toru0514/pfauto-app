import { getSpreadsheetUrl } from "./actions";
import { Sidebar } from "@/components/dashboard/sidebar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const spreadsheetUrl = await getSpreadsheetUrl();

  return (
    <div className="flex min-h-screen">
      <Sidebar spreadsheetUrl={spreadsheetUrl} />
      <main className="ml-52 flex-1 bg-background px-6 py-8">
        <div className="mx-auto max-w-5xl">{children}</div>
      </main>
    </div>
  );
}
