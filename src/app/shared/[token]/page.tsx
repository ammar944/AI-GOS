import { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SharedBlueprintView } from "@/components/shared-blueprint/shared-blueprint-view";
import type { StrategicBlueprintOutput } from "@/lib/strategic-blueprint/output-types";

interface PageProps {
  params: Promise<{ token: string }>;
}

// Generate dynamic metadata for SEO/sharing
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { token } = await params;
  const supabase = await createClient();

  const { data } = await supabase
    .from("shared_blueprints")
    .select("title")
    .eq("share_token", token)
    .single();

  const title = data?.title || "Strategic Blueprint";

  return {
    title: `${title} | Strategic Blueprint`,
    description: "View this shared Strategic Blueprint research document.",
    openGraph: {
      title: `${title} | Strategic Blueprint`,
      description: "View this shared Strategic Blueprint research document.",
      type: "article",
    },
  };
}

export default async function SharedBlueprintPage({ params }: PageProps) {
  const { token } = await params;

  // Validate token format
  if (!token || token.length < 10) {
    notFound();
  }

  // Fetch blueprint from database
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("shared_blueprints")
    .select("blueprint_data, title, created_at")
    .eq("share_token", token)
    .single();

  if (error || !data) {
    notFound();
  }

  return (
    <SharedBlueprintView
      blueprint={data.blueprint_data as StrategicBlueprintOutput}
      title={data.title}
      createdAt={data.created_at}
    />
  );
}
