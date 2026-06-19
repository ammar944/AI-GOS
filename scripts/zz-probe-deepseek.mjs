#!/usr/bin/env node
// One-shot funding probe for the lab-engine DeepSeek key. Prints ONLY ok/fail +
// scrubbed error — never the key. Cheap (few output tokens on the section model).
import { config } from 'dotenv';
config({ path: '.env.local', quiet: true });

import { createDeepSeek } from '@ai-sdk/deepseek';
import { generateText } from 'ai';

const key = process.env.DEEPSEEK_API_KEY;
if (!key || key.trim().length === 0) {
  console.log('DEEPSEEK_KEY_MISSING (absent from .env.local)');
  process.exit(2);
}
console.log(`key present (length=${key.length})`);

const deepseek = createDeepSeek({ apiKey: key });
try {
  const res = await generateText({
    model: deepseek('deepseek-v4-flash'),
    prompt: 'Reply with the single word OK.',
    maxOutputTokens: 5,
  });
  console.log('DEEPSEEK_OK ->', JSON.stringify(res.text));
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err);
  console.log('DEEPSEEK_FAIL ->', msg.slice(0, 300));
  process.exit(1);
}
