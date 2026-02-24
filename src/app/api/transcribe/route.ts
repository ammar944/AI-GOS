import { auth } from '@clerk/nextjs/server';
import { experimental_transcribe as transcribe } from 'ai';
import { groq, WHISPER_MODEL } from '@/lib/ai/groq-provider';

export const maxDuration = 30;

const ALLOWED_MIME_TYPES = [
  'audio/webm',
  'audio/ogg',
  'audio/mp4',
  'audio/mpeg',
  'audio/wav',
  'audio/flac',
  'audio/x-m4a',
];

const MAX_SIZE_BYTES = 25 * 1024 * 1024; // 25MB

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const { audioBase64, mimeType } = body as {
    audioBase64?: string;
    mimeType?: string;
  };

  if (!audioBase64 || !mimeType) {
    return Response.json(
      { error: 'Missing required fields: audioBase64, mimeType' },
      { status: 400 },
    );
  }

  if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
    return Response.json(
      { error: `Unsupported mime type: ${mimeType}. Allowed: ${ALLOWED_MIME_TYPES.join(', ')}` },
      { status: 400 },
    );
  }

  // Decode base64 and check size
  const binaryStr = atob(audioBase64);
  if (binaryStr.length > MAX_SIZE_BYTES) {
    return Response.json(
      { error: `Audio exceeds 25MB limit (${(binaryStr.length / 1024 / 1024).toFixed(1)}MB)` },
      { status: 400 },
    );
  }

  const audioData = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    audioData[i] = binaryStr.charCodeAt(i);
  }

  try {
    const result = await transcribe({
      model: groq.transcription(WHISPER_MODEL),
      audio: audioData,
      providerOptions: {
        groq: {
          prompt:
            'ROAS, CAC, CPM, CPC, ICP, LTV, AOV, MQL, SQL, CTR, KPI, media plan, strategic blueprint, ad creative, conversion funnel, retargeting, lookalike audiences, demand generation',
        },
      },
    });

    return Response.json({ text: result.text });
  } catch (err) {
    console.error('Transcription error:', err);
    return Response.json(
      { error: 'Transcription failed. Please try again.' },
      { status: 500 },
    );
  }
}
