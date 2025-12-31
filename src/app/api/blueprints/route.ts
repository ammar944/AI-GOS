import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateShareToken } from "@/lib/blueprints/share-token";
import type { StrategicBlueprintOutput } from "@/lib/strategic-blueprint/output-types";
import type {
  ShareBlueprintResponse,
  ShareBlueprintErrorResponse,
} from "@/lib/blueprints/types";

interface ShareRequest {
  blueprint: StrategicBlueprintOutput;
}

export async function POST(
  request: NextRequest
): Promise<NextResponse<ShareBlueprintResponse | ShareBlueprintErrorResponse>> {
  try {
    const body = (await request.json()) as ShareRequest;
    const { blueprint } = body;

    // Validate blueprint exists and has required structure
    if (!blueprint || !blueprint.industryMarketOverview) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "INVALID_INPUT", message: "Invalid blueprint data" },
        },
        { status: 400 }
      );
    }

    // Generate unique share token
    const shareToken = generateShareToken();

    // Extract title from blueprint for display
    const title =
      blueprint.industryMarketOverview?.categorySnapshot?.category ||
      "Strategic Blueprint";

    // Save to Supabase
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("shared_blueprints")
      .insert({
        share_token: shareToken,
        blueprint_data: blueprint,
        title,
      })
      .select("share_token")
      .single();

    if (error) {
      console.error("Supabase insert error:", error);
      return NextResponse.json(
        {
          success: false,
          error: { code: "DATABASE_ERROR", message: "Failed to save blueprint" },
        },
        { status: 500 }
      );
    }

    // Build the share URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
    const shareUrl = `${baseUrl}/shared/${data.share_token}`;

    return NextResponse.json({
      success: true,
      shareToken: data.share_token,
      shareUrl,
    });
  } catch (error) {
    console.error("Share blueprint error:", error);
    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" },
      },
      { status: 500 }
    );
  }
}
