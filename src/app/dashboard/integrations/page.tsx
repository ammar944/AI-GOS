import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { Logo } from "@/components/ui/logo";
import { DashboardBackground } from "../_components/dashboard-background";
import { IntegrationsDashboard } from "./_components/integrations-dashboard";

export default async function IntegrationsPage() {
  const { userId } = await auth();
  if (!userId) {
    redirect("/sign-in");
  }

  return (
    <div className="min-h-screen bg-[var(--bg-base)] flex flex-col">
      <DashboardBackground />

      <header className="sticky top-0 z-50 border-b border-[var(--border-default)] backdrop-blur-xl bg-[var(--bg-base)]/80">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <Link href="/" className="transition-opacity hover:opacity-80">
              <Logo size="sm" />
            </Link>
            <span className="text-[var(--text-quaternary)] select-none">|</span>
            <Link
              href="/dashboard"
              className="text-sm text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors duration-150"
            >
              &larr; Dashboard
            </Link>
          </div>
          <UserButton afterSignOutUrl="/" />
        </div>
      </header>

      <main className="flex-1 relative z-10">
        <div className="mx-auto max-w-5xl px-6 py-10">
          <div className="mb-8">
            <h1 className="text-2xl font-semibold text-[var(--text-primary)]">
              API Integrations
            </h1>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              Health status for all external services and API keys.
            </p>
          </div>
          <IntegrationsDashboard />
        </div>
      </main>
    </div>
  );
}
