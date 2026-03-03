// Web Search Tool — replaces perplexitySearch
// Uses SearchAPI.io Google search (fast HTTP call, ~3-5s) instead of Perplexity model (40s+)
// Claude sub-agents synthesize the raw results themselves

import { betaZodTool } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';

const SEARCHAPI_URL = 'https://www.searchapi.io/api/v1/search';

export const webSearch = betaZodTool({
  name: 'webSearch',
  description:
    'Search the web for market research, competitor intelligence, and industry data. ' +
    'Returns Google search results (titles, URLs, snippets) for the agent to synthesize.',
  inputSchema: z.object({
    query: z.string().describe('The search query'),
    context: z
      .string()
      .optional()
      .describe('Optional context to refine interpretation of results'),
  }),
  run: async ({ query }) => {
    const apiKey = process.env.SEARCHAPI_KEY;
    if (!apiKey) {
      return JSON.stringify({
        results: 'Search unavailable: SEARCHAPI_KEY not configured',
        sources: [],
      });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000); // 15s hard limit

    try {
      const url = new URL(SEARCHAPI_URL);
      url.searchParams.set('engine', 'google');
      url.searchParams.set('q', query);
      url.searchParams.set('api_key', apiKey);

      const response = await fetch(url.toString(), {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });

      if (!response.ok) {
        return JSON.stringify({
          results: `Search failed: HTTP ${response.status}`,
          sources: [],
        });
      }

      const data = (await response.json()) as {
        organic_results?: Array<{
          title: string;
          link: string;
          snippet: string;
        }>;
        error?: string;
      };

      if (data.error) {
        return JSON.stringify({
          results: `Search error: ${data.error}`,
          sources: [],
        });
      }

      const results = data.organic_results ?? [];

      if (results.length === 0) {
        return JSON.stringify({
          results: `No results found for: ${query}`,
          sources: [],
        });
      }

      // Format as readable text for Claude to synthesize
      const formatted = results
        .slice(0, 10) // top 10 results
        .map(
          (r, i) => `${i + 1}. **${r.title}** — ${r.link}\n${r.snippet}`,
        )
        .join('\n\n');

      const sources = results.slice(0, 10).map((r) => ({
        url: r.link,
        title: r.title,
      }));

      return JSON.stringify({
        results: `# Search Results: ${query}\n\n${formatted}`,
        sources,
      });
    } catch (err) {
      const msg =
        err instanceof Error && err.name === 'AbortError'
          ? `Search timed out after 15s for query: ${query}`
          : `Search failed: ${err instanceof Error ? err.message : String(err)}`;
      return JSON.stringify({ results: msg, sources: [] });
    } finally {
      clearTimeout(timeout);
    }
  },
});
