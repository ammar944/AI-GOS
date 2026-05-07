import { NextResponse } from 'next/server';

interface RetiredUnifiedChatResponse {
  error: string;
}

export const maxDuration = 30;
export const runtime = 'nodejs';

export async function POST(): Promise<NextResponse<RetiredUnifiedChatResponse>> {
  return NextResponse.json(
    {
      error:
        '/api/chat/unified is retired. Use /api/journey/stream for the Journey workspace chat.',
    },
    { status: 410 },
  );
}
