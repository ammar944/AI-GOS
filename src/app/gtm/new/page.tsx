import type { ReactElement } from "react";
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { NewRunForm } from "@/components/gtm/NewRunForm";

export default async function NewGtmRunPage(): Promise<ReactElement> {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-10 sm:px-6">
        <header className="border-b border-border pb-6">
          <p className="font-mono text-xs uppercase tracking-[0.06em] text-muted-foreground">
            AIGOS · Pre-Pitch Audit
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-normal text-foreground">
            New GTM run
          </h1>
        </header>

        <section className="flex flex-col gap-4">
          <NewRunForm />
        </section>
      </div>
    </main>
  );
}
