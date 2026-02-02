import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import type {
  GetBlueprintResponse,
  GetBlueprintErrorResponse,
} from "@/lib/blueprints/types";

interface RouteParams {
  params: Promise<{ token: string }>;
}

export async function GET(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse<GetBlueprintResponse | GetBlueprintErrorResponse>> {
  try {
    const { token } = await params;

    // Validate token format
    if (!token || token.length < 10) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "INVALID_TOKEN", message: "Invalid share token" },
        },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // Fetch blueprint by share token
    const { data, error } = await supabase
      .from("shared_blueprints")
      .select("blueprint_data, title, created_at")
      .eq("share_token", token)
      .single();

    if (error || !data) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "NOT_FOUND", message: "Blueprint not found" },
        },
        { status: 404 }
      );
    }

    // Increment view count (fire and forget - don't block response)
    supabase
      .from("shared_blueprints")
      .update({ view_count: (data as { view_count?: number }).view_count ? (data as { view_count?: number }).view_count! + 1 : 1 })
      .eq("share_token", token)
      .then(() => {});

    return NextResponse.json({
      success: true,
      blueprint: data.blueprint_data,
      title: data.title,
      createdAt: data.created_at,
    });
  } catch (error) {
    console.error("Fetch blueprint error:", error);
    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" },
      },
      { status: 500 }
    );
  }
}
