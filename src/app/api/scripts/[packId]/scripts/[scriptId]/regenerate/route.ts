import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

export const maxDuration = 30;

export async function POST() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // V1: Single-script regeneration not yet implemented in the worker.
  return NextResponse.json(
    { error: 'Single-script regeneration coming soon. Use "Generate New Batch" instead.' },
    { status: 501 },
  );
}
