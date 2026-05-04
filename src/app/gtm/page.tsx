import Link from "next/link";
import type { ReactElement } from "react";
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import {
  RunsIndexTable,
  type GtmRunListItem,
} from "@/components/gtm/RunsIndexTable";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";

export default async function GtmPage(): Promise<ReactElement> {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  const supabase = await createClient();
  const { data: runs, error } = await supabase
    .from("gtm_runs")
    .select("run_id, input_url, status, created_at, updated_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .returns<GtmRunListItem[]>();

  if (error) {
    throw new Error(
      `Failed to list GTM runs for Clerk user ${userId}: ${error.message}`
    );
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-10 sm:px-6">
        <header className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-6">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.06em] text-muted-foreground">
              AIGOS · Pre-Pitch Audit
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-normal text-foreground">
              GTM runs
            </h1>
          </div>
          <Button asChild>
            <Link href="/gtm/new">New run</Link>
          </Button>
        </header>

        <RunsIndexTable runs={runs} />
      </div>
    </main>
  );
}
