import { getSpreadsheetUrl } from "./actions";
import { Sidebar } from "@/components/dashboard/sidebar";
import { MobileHeader } from "@/components/dashboard/mobile-header";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const spreadsheetUrl = await getSpreadsheetUrl();

  return (
    <div className="flex min-h-screen">
      <div className="hidden md:block">
        <Sidebar spreadsheetUrl={spreadsheetUrl} />
      </div>
      <MobileHeader spreadsheetUrl={spreadsheetUrl} />
      <main className="flex-1 bg-background px-4 pt-18 pb-8 md:ml-52 md:px-6 md:pt-8">
        <div className="mx-auto max-w-5xl">{children}</div>
      </main>
    </div>
  );
}
