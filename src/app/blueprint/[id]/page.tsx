import { redirect } from "next/navigation";
import { getBlueprintById } from "@/lib/actions/blueprints";
import { getMediaPlansByBlueprintId } from "@/lib/actions/media-plans";
import { BlueprintViewClient } from "./client";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function BlueprintPage({ params }: Props) {
  const { id } = await params;

  const [blueprintResult, mediaPlansResult] = await Promise.all([
    getBlueprintById(id),
    getMediaPlansByBlueprintId(id),
  ]);

  if (blueprintResult.error || !blueprintResult.data) {
    redirect("/dashboard");
  }

  return (
    <BlueprintViewClient
      blueprint={blueprintResult.data}
      linkedMediaPlans={mediaPlansResult.data ?? []}
    />
  );
}
