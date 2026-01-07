// src/app/api/blueprint/[id]/confirm-edit/route.ts
// Endpoint for confirming or cancelling proposed edits

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { storeChunksWithEmbeddings } from '@/lib/chat/embeddings';
import { chunkBlueprint } from '@/lib/chat/chunking';
import type { BlueprintSection } from '@/lib/chat/types';
import type { StrategicBlueprintOutput } from '@/lib/strategic-blueprint/output-types';

interface ConfirmEditRequest {
  conversationId: string;
  editResult: {
    section: string;
    fieldPath: string;
    oldValue: unknown;
    newValue: unknown;
    explanation: string;
  };
  confirmed: boolean;
}

interface ConfirmEditResponse {
  success: boolean;
  versionId?: string;
  versionNumber?: number;
  message: string;
}

/**
 * Re-chunk a specific section after an edit is applied.
 * Deletes old chunks for the section and creates new ones with updated embeddings.
 */
async function rechunkSection(
  blueprintId: string,
  section: BlueprintSection,
  sectionData: Record<string, unknown>,
  fullBlueprint: StrategicBlueprintOutput
): Promise<{ rechunked: number; cost: number }> {
  const supabase = await createClient();

  // Delete old chunks for this section
  const { error: deleteError } = await supabase
    .from('blueprint_chunks')
    .delete()
    .eq('blueprint_id', blueprintId)
    .eq('section', section);

  if (deleteError) {
    throw new Error(`Failed to delete old chunks: ${deleteError.message}`);
  }

  // Generate new chunks for the full blueprint but filter to just this section
  const allChunks = chunkBlueprint(blueprintId, fullBlueprint);
  const sectionChunks = allChunks.filter((c) => c.section === section);

  // Store new chunks with embeddings
  const { stored, cost } = await storeChunksWithEmbeddings(sectionChunks);

  return { rechunked: stored, cost };
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: blueprintId } = await params;

  try {
    const body: ConfirmEditRequest = await request.json();

    // Validate request
    if (!body.editResult) {
      return NextResponse.json(
        { success: false, message: 'Edit result is required' },
        { status: 400 }
      );
    }

    if (!body.editResult.section || !body.editResult.fieldPath) {
      return NextResponse.json(
        { success: false, message: 'Section and fieldPath are required' },
        { status: 400 }
      );
    }

    // If not confirmed, just return success with cancelled message
    if (!body.confirmed) {
      const response: ConfirmEditResponse = {
        success: true,
        message: 'Edit cancelled',
      };
      return NextResponse.json(response);
    }

    // Apply the edit via RPC
    const supabase = await createClient();

    const { data: rpcResult, error: rpcError } = await supabase.rpc(
      'apply_blueprint_edit',
      {
        p_blueprint_id: blueprintId,
        p_section: body.editResult.section,
        p_field_path: body.editResult.fieldPath,
        p_new_value: JSON.stringify(body.editResult.newValue),
        p_edited_by: 'chat', // Indicate edit came from chat interface
      }
    );

    if (rpcError) {
      console.error('RPC error:', rpcError);
      return NextResponse.json(
        { success: false, message: `Failed to apply edit: ${rpcError.message}` },
        { status: 500 }
      );
    }

    // Fetch the updated blueprint for re-chunking
    const { data: blueprintData, error: fetchError } = await supabase
      .from('blueprints')
      .select('output')
      .eq('id', blueprintId)
      .single();

    if (fetchError || !blueprintData?.output) {
      console.error('Failed to fetch updated blueprint:', fetchError);
      // Edit was applied but re-chunking failed - log but don't fail the request
      const response: ConfirmEditResponse = {
        success: true,
        versionId: rpcResult?.version_id,
        versionNumber: rpcResult?.version_number,
        message: 'Edit applied successfully (re-chunking skipped)',
      };
      return NextResponse.json(response);
    }

    // Re-chunk the affected section
    try {
      await rechunkSection(
        blueprintId,
        body.editResult.section as BlueprintSection,
        blueprintData.output[body.editResult.section],
        blueprintData.output as StrategicBlueprintOutput
      );
    } catch (rechunkError) {
      console.error('Re-chunking error:', rechunkError);
      // Edit was applied but re-chunking failed - still report success
    }

    const response: ConfirmEditResponse = {
      success: true,
      versionId: rpcResult?.version_id,
      versionNumber: rpcResult?.version_number,
      message: 'Edit applied successfully',
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Confirm edit error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { success: false, message: `Failed to process edit confirmation: ${message}` },
      { status: 500 }
    );
  }
}
