import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { Logo } from "@/components/ui/logo";
import { DashboardContent } from "./_components/dashboard-content";
import { DashboardBackground } from "./_components/dashboard-background";

export default async function DashboardPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  return (
    <div className="min-h-screen bg-[var(--bg-base)] flex flex-col">
      {/* Subtle ambient glow */}
      <DashboardBackground />

      {/* Header — sticky, minimal chrome */}
      <header className="sticky top-0 z-50 border-b border-white/[0.06] backdrop-blur-xl bg-[var(--bg-base)]/80">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-6">
          <Link href="/" className="transition-opacity hover:opacity-80">
            <Logo size="sm" />
          </Link>
          <UserButton afterSignOutUrl="/" />
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 relative z-10">
        <div className="mx-auto max-w-5xl px-6 py-10">
          <DashboardContent />
        </div>
      </main>
    </div>
  );
}
