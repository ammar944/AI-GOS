import type { StrategicBlueprintOutput } from "@/lib/strategic-blueprint/output-types";

export interface SharedBlueprint {
  id: string;
  share_token: string;
  blueprint_data: StrategicBlueprintOutput;
  title: string | null;
  created_at: string;
  expires_at: string | null;
  view_count: number;
}

export interface ShareBlueprintRequest {
  blueprint: StrategicBlueprintOutput;
}

export interface ShareBlueprintResponse {
  success: true;
  shareToken: string;
  shareUrl: string;
}

export interface ShareBlueprintErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
  };
}

export interface GetBlueprintResponse {
  success: true;
  blueprint: StrategicBlueprintOutput;
  title: string | null;
  createdAt: string;
}

export interface GetBlueprintErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
  };
}
