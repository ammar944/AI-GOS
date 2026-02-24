// Groq Provider Configuration
// Used exclusively for Whisper transcription (voice-to-text)

import { createGroq } from '@ai-sdk/groq';

export const groq = createGroq({
  apiKey: process.env.GROQ_API_KEY,
});

export const WHISPER_MODEL = 'whisper-large-v3-turbo';
