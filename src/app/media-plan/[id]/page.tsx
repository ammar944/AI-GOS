import { redirect } from "next/navigation";
import { getMediaPlanById } from "@/lib/actions/media-plans";
import { getBlueprintById } from "@/lib/actions/blueprints";
import { MediaPlanViewClient } from "./client";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function MediaPlanPage({ params }: Props) {
  const { id } = await params;
  const result = await getMediaPlanById(id);

  if (result.error || !result.data) {
    redirect("/dashboard");
  }

  // If linked to a blueprint, fetch the title
  let blueprintTitle: string | null = null;
  if (result.data.blueprint_id) {
    const bpResult = await getBlueprintById(result.data.blueprint_id);
    if (bpResult.data) {
      blueprintTitle = bpResult.data.title;
    }
  }

  return (
    <MediaPlanViewClient
      mediaPlan={result.data}
      blueprintTitle={blueprintTitle}
    />
  );
}
