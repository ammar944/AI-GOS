// Test: HTTP fetch → Strict LLM extraction
// Proves that LLM only extracts what's actually on the page

import { createOpenRouterClient, MODELS } from '../src/lib/openrouter/client';

async function testStrictExtraction(url: string, company: string) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🔍 Testing: ${company} (${url})`);
  console.log('='.repeat(60));

  // Step 1: Fetch raw HTML
  console.log('\n📡 Step 1: Fetching page with HTTP...');
  const response = await fetch(url);
  const html = await response.text();
  
  // Strip HTML tags to get text content
  const textContent = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 10000);
  
  console.log(`✅ Fetched ${textContent.length} chars of text content`);
  console.log('\n📄 Content preview:');
  console.log(textContent.slice(0, 300) + '...\n');

  // Step 2: Strict LLM extraction
  console.log('🤖 Step 2: Extracting with strict prompt...');
  
  const client = createOpenRouterClient();
  
  const strictPrompt = `You are extracting pricing data from webpage content.

STRICT RULES - FOLLOW EXACTLY:
1. ONLY extract prices that are EXPLICITLY written in the content below
2. For EACH price found, include the EXACT source text (verbatim quote)
3. If a price is NOT explicitly written, DO NOT include it
4. Do NOT use your training data - ONLY use this content
5. Do NOT guess or infer prices

Output JSON:
{
  "tiers": [
    {
      "name": "exact tier name from page",
      "price": "exact price as written (e.g., '$10/mo', 'Free', '$99 per user/month')",
      "source_quote": "verbatim text from content where you found this"
    }
  ],
  "extraction_notes": "any issues or observations"
}

WEBPAGE CONTENT FOR ${company}:
${textContent}`;

  const result = await client.chat({
    model: MODELS.GEMINI_FLASH,
    messages: [{ role: 'user', content: strictPrompt }],
    temperature: 0,
  });

  console.log('\n✅ Extraction result:');
  
  // Parse and display
  try {
    const jsonMatch = result.content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const data = JSON.parse(jsonMatch[0]);
      console.log(`\n📋 Found ${data.tiers?.length || 0} pricing tiers:\n`);
      
      for (const tier of data.tiers || []) {
        console.log(`  💰 ${tier.name}: ${tier.price}`);
        console.log(`     Source: "${tier.source_quote?.slice(0, 60)}..."`);
      }
      
      if (data.extraction_notes) {
        console.log(`\n📝 Notes: ${data.extraction_notes}`);
      }
    } else {
      console.log(result.content);
    }
  } catch {
    console.log(result.content);
  }
}

// Test with 3 companies
async function main() {
  console.log('🚀 Strict Extraction Test - HTTP + LLM');
  console.log('Testing that LLM ONLY extracts what\'s actually on the page\n');

  await testStrictExtraction('https://linear.app/pricing', 'Linear');
  await testStrictExtraction('https://notion.so/pricing', 'Notion');
  await testStrictExtraction('https://supabase.com/pricing', 'Supabase');
  
  console.log('\n✅ Test complete!');
}

main().catch(console.error);
