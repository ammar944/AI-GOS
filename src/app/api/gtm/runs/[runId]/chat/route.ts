/**
 * POST /api/gtm/runs/[runId]/chat
 *
 * PRD: gtm-conversational-canvas (T7)
 *
 * Streaming orchestrator chat endpoint. Wires:
 *   - Clerk auth + Supabase ownership check (mirrors dispatch route)
 *   - RunOrchestratorDeps backed by Supabase + dispatch-skill
 *   - runOrchestrator → toUIMessageStreamResponse() for DefaultChatTransport
 *
 * Skill body cost flows through Anthropic + Perplexity (existing dispatch
 * machinery). Orchestrator brain + patch_artifact body run on Ollama (cheap).
 */

import { NextResponse } from "next/server";
import type { UIMessage } from "ai";
import { auth } from "@clerk/nextjs/server";
import { dispatchSkill } from "@/lib/gtm/dispatch-skill";
import {
  runOrchestrator,
  type InsertPatchedArtifactInput,
  type InsertPatchedArtifactResult,
  type InsertSkillArtifactInput,
  type InsertSkillArtifactResult,
  type RunOrchestratorDeps,
} from "@/lib/ai/orchestrator";
import type {
  ArtifactRow,
  DispatchSkillStageInput,
  DispatchSkillStageResult,
} from "@/lib/gtm/orchestrator-tools";
import type { LighthouseSkill } from "@/lib/gtm/types";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 300;

interface GtmRunChatRow {
  run_id: string;
  user_id: string;
  input_url: string;
  stages: Record<string, unknown> | null;
}

interface ChatBody {
  messages: UIMessage[];
}

type ChatRouteContext = {
  params: Promise<{ runId: string }>;
};

export async function POST(
  request: Request,
  { params }: ChatRouteContext,
): Promise<Response> {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json(
      { error: "gtm_chat_unauthenticated" },
      { status: 401 },
    );
  }

  const { runId } = await params;
  const supabase = await createClient();

  const { data: run, error: loadError } = await supabase
    .from("gtm_runs")
    .select("run_id, user_id, input_url, stages")
    .eq("run_id", runId)
    .maybeSingle<GtmRunChatRow>();

  if (loadError) {
    return NextResponse.json(
      {
        error: "gtm_chat_load_failed",
        message: loadError.message,
        run_id: runId,
      },
      { status: 500 },
    );
  }

  if (!run) {
    return NextResponse.json(
      { error: "gtm_run_not_found", run_id: runId },
      { status: 404 },
    );
  }

  if (run.user_id !== userId) {
    return NextResponse.json(
      { error: "gtm_chat_forbidden", run_id: runId },
      { status: 403 },
    );
  }

  const body = (await request.json()) as ChatBody;
  if (!Array.isArray(body?.messages)) {
    return NextResponse.json(
      { error: "gtm_chat_invalid_body", message: "Expected { messages: UIMessage[] }." },
      { status: 400 },
    );
  }

  const deps = buildOrchestratorDeps({
    supabase,
    runId: run.run_id,
    userId,
    inputUrl: run.input_url,
    stages: run.stages,
  });

  const result = await runOrchestrator(body.messages, run.run_id, deps);
  return result.toUIMessageStreamResponse();
}

// ---------------------------------------------------------------------------
// Default Supabase + dispatch-skill backed deps
// ---------------------------------------------------------------------------

interface BuildDepsOptions {
  supabase: Awaited<ReturnType<typeof createClient>>;
  runId: string;
  userId: string;
  inputUrl: string;
  stages: Record<string, unknown> | null;
}

export function buildOrchestratorDeps(
  opts: BuildDepsOptions,
): RunOrchestratorDeps {
  const { supabase, runId, userId, inputUrl, stages } = opts;

  return {
    userId,

    dispatchSkillRun: async (
      input: DispatchSkillStageInput,
    ): Promise<DispatchSkillStageResult> => {
      try {
        const output = await dispatchSkill(input.skill, {
          input_url: inputUrl,
          run_id: runId,
          prior_stages: stages ?? {},
          // refinement_context is forwarded to skills that opt-in; harmless if ignored
          refinement_context: input.refinement_context,
        });
        return { status: "completed", output };
      } catch (error) {
        return {
          status: "failed",
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },

    fetchLatestVersion: async (skill: LighthouseSkill): Promise<number> => {
      const { data } = await supabase
        .from("gtm_artifacts")
        .select("version")
        .eq("run_id", runId)
        .eq("skill", skill)
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle<{ version: number }>();
      return data?.version ?? 0;
    },

    fetchArtifactById: async (id: string): Promise<ArtifactRow | null> => {
      const { data } = await supabase
        .from("gtm_artifacts")
        .select("id, run_id, skill, version, content_md")
        .eq("id", id)
        .maybeSingle<ArtifactRow>();
      return data ?? null;
    },

    insertSkillArtifact: async (
      input: InsertSkillArtifactInput,
    ): Promise<InsertSkillArtifactResult> => {
      const { data, error } = await supabase
        .from("gtm_artifacts")
        .insert({
          run_id: input.run_id,
          user_id: input.user_id,
          skill: input.skill,
          version: input.version,
          parent_id: null,
          content_md: input.content_md,
          source: "skill_output",
          created_by: "orchestrator",
        })
        .select("id, version")
        .single<{ id: string; version: number }>();

      if (error || !data) {
        throw new Error(
          `gtm_artifacts insert failed (skill_output): ${error?.message ?? "unknown"}`,
        );
      }
      return { id: data.id, version: data.version };
    },

    insertPatchedArtifact: async (
      input: InsertPatchedArtifactInput,
    ): Promise<InsertPatchedArtifactResult> => {
      const { data, error } = await supabase
        .from("gtm_artifacts")
        .insert({
          run_id: input.run_id,
          user_id: userId,
          skill: input.skill,
          version: input.version,
          parent_id: input.parent_id,
          content_md: input.content_md,
          source: "agent_patch",
          created_by: userId,
        })
        .select("id, version")
        .single<{ id: string; version: number }>();

      if (error || !data) {
        throw new Error(
          `gtm_artifacts insert failed (agent_patch): ${error?.message ?? "unknown"}`,
        );
      }
      return { id: data.id, version: data.version };
    },
  };
}
