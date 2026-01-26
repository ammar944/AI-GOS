import { redirect } from "next/navigation";
import { getBlueprintById } from "@/lib/actions/blueprints";
import { BlueprintViewClient } from "./client";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function BlueprintPage({ params }: Props) {
  const { id } = await params;
  const result = await getBlueprintById(id);

  if (result.error || !result.data) {
    redirect("/dashboard");
  }

  return <BlueprintViewClient blueprint={result.data} />;
}
