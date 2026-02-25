// Groq Provider Configuration
// Used for Whisper transcription (voice-to-text) and Llama 4 Scout chat

import { createGroq } from '@ai-sdk/groq';

export const groq = createGroq({
  apiKey: process.env.GROQ_API_KEY,
});

export const WHISPER_MODEL = 'whisper-large-v3-turbo';
export const GROQ_CHAT_MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct';
