// POST /api/documents/signed-url
// Returns a signed upload URL for Supabase Storage.
// Client uploads the file directly to this URL (bypasses Vercel body limit),
// then calls /api/documents/upload with the storage path.

import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { ACCEPTED_MIME_TYPES } from '@/lib/company-intel/document-types';

const BUCKET = 'document-uploads';
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { fileName?: string; mimeType?: string; fileSize?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { fileName, mimeType, fileSize } = body;

  if (!fileName || !mimeType) {
    return NextResponse.json({ error: 'fileName and mimeType are required' }, { status: 400 });
  }

  // Normalize MIME
  const normalizedMime = mimeType === 'text/x-markdown' ? 'text/markdown' : mimeType;

  // Allow application/octet-stream since browsers often report it for .docx
  if (!ACCEPTED_MIME_TYPES.includes(normalizedMime) && normalizedMime !== 'application/octet-stream') {
    return NextResponse.json({ error: `Unsupported file type: ${mimeType}` }, { status: 400 });
  }

  if (fileSize && fileSize > MAX_FILE_SIZE) {
    return NextResponse.json({ error: 'File exceeds 10MB limit' }, { status: 400 });
  }

  // Generate a unique path: userId/timestamp-filename
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storagePath = `${userId}/${Date.now()}-${safeName}`;

  const supabase = createAdminClient();
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUploadUrl(storagePath);

  if (error) {
    console.error('[documents/signed-url] Storage error:', error);
    return NextResponse.json({ error: 'Failed to create upload URL' }, { status: 500 });
  }

  return NextResponse.json({
    signedUrl: data.signedUrl,
    token: data.token,
    storagePath,
  });
}
