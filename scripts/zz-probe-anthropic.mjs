#!/usr/bin/env node
// One-shot funding probe for the lab-engine Anthropic key. Prints ONLY ok/fail +
// scrubbed error — never the key. Cheap (5 output tokens on the section model id).
import { config } from 'dotenv';
config({ path: '.env.local', quiet: true });

import { createAnthropic } from '@ai-sdk/anthropic';
import { generateText } from 'ai';

const key = process.env.ANTHROPIC_API_KEY;
if (!key || key.trim().length === 0) {
  console.log('ANTHROPIC_KEY_MISSING (absent from .env.local)');
  process.exit(2);
}
console.log(`key present (length=${key.length})`);

const anthropic = createAnthropic({ apiKey: key });
try {
  const res = await generateText({
    model: anthropic('claude-sonnet-4-5'),
    prompt: 'Reply with the single word OK.',
    maxOutputTokens: 5,
  });
  console.log('ANTHROPIC_OK ->', JSON.stringify(res.text));
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err);
  console.log('ANTHROPIC_FAIL ->', msg.slice(0, 300));
  process.exit(1);
}
