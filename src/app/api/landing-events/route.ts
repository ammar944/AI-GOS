import { NextRequest, NextResponse } from 'next/server';
import {
  LandingSiteConfigError,
  recordLandingEvent,
} from '@/lib/saaslaunch/events';
import { LandingEventValidationError } from '@/lib/saaslaunch/event-contract';

export const runtime = 'nodejs';

interface EventAcceptedResponse {
  accepted: true;
  id: string;
}

interface EventRejectedResponse {
  accepted: false;
  error: string;
}

function buildCorsHeaders(origin: string | null): HeadersInit {
  return {
    'Access-Control-Allow-Headers': 'content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Origin': origin ?? '*',
    Vary: 'Origin',
  };
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown landing event ingest error';
}

export async function OPTIONS(
  request: NextRequest,
): Promise<NextResponse<null>> {
  return new NextResponse(null, {
    status: 204,
    headers: buildCorsHeaders(request.headers.get('origin')),
  });
}

export async function POST(
  request: NextRequest,
): Promise<NextResponse<EventAcceptedResponse | EventRejectedResponse>> {
  const origin = request.headers.get('origin');
  const userAgent = request.headers.get('user-agent');
  let body: unknown;

  try {
    body = await request.json();
  } catch (error) {
    return NextResponse.json(
      {
        accepted: false,
        error: `Invalid JSON landing event body: ${getErrorMessage(error)}`,
      },
      { status: 400, headers: buildCorsHeaders(origin) },
    );
  }

  try {
    const result = await recordLandingEvent({
      payload: body,
      origin,
      userAgent,
    });

    return NextResponse.json(
      {
        accepted: true,
        id: result.id,
      },
      { status: 202, headers: buildCorsHeaders(origin) },
    );
  } catch (error) {
    const message = getErrorMessage(error);

    if (error instanceof LandingSiteConfigError) {
      return NextResponse.json(
        {
          accepted: false,
          error: message,
        },
        { status: 403, headers: buildCorsHeaders(origin) },
      );
    }

    if (error instanceof LandingEventValidationError) {
      return NextResponse.json(
        {
          accepted: false,
          error: message,
        },
        { status: 400, headers: buildCorsHeaders(origin) },
      );
    }

    console.error('[landing-events] ingest failed', {
      error: message,
      origin,
      userAgent,
    });

    return NextResponse.json(
      {
        accepted: false,
        error: 'Landing event could not be recorded',
      },
      { status: 500, headers: buildCorsHeaders(origin) },
    );
  }
}
