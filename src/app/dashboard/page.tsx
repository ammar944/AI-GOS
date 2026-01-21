import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { Logo } from "@/components/ui/logo";
import { BlobBackground } from "@/components/ui/blob-background";
import { DashboardContent } from "./_components/dashboard-content";

export default async function DashboardPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="relative z-50 border-b border-border/50 backdrop-blur-sm bg-background/80">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link href="/" className="transition-opacity hover:opacity-80">
            <Logo size="md" />
          </Link>
          <div className="flex items-center gap-4">
            <UserButton afterSignOutUrl="/" />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <BlobBackground preset="hero" showGrid className="flex-1">
        <main className="container mx-auto px-4 py-10">
          <DashboardContent />
        </main>
      </BlobBackground>
    </div>
  );
}
