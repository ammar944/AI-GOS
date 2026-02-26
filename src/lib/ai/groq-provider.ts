// Groq Provider Configuration
// Used for Whisper transcription, Llama 3.3 70B chat, Kimi K2 synthesis, and GPT-OSS extraction

import { createGroq } from '@ai-sdk/groq';

export const groq = createGroq({
  apiKey: process.env.GROQ_API_KEY,
});

export const WHISPER_MODEL = 'whisper-large-v3-turbo';
export const GROQ_CHAT_MODEL = 'llama-3.3-70b-versatile';
export const GROQ_SYNTHESIS_MODEL = 'moonshotai/kimi-k2-instruct-0905';
export const GROQ_EXTRACTION_MODEL = 'openai/gpt-oss-20b';
