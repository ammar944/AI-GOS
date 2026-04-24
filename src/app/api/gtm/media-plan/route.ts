import { NextResponse } from 'next/server';

export async function GET(): Promise<NextResponse> {
  return NextResponse.json(
    { error: 'not_implemented', phase: 'gtm-phase-1', endpoint: 'media-plan' },
    { status: 501 },
  );
}

export async function POST(): Promise<NextResponse> {
  return NextResponse.json(
    { error: 'not_implemented', phase: 'gtm-phase-1', endpoint: 'media-plan' },
    { status: 501 },
  );
}
