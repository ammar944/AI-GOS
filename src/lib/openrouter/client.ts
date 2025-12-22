// OpenRouter API Client
// Uses OpenAI-compatible API format

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatCompletionOptions {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
}

export interface ChatCompletionResponse {
  content: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  cost: number;
}

// Model identifiers for OpenRouter
export const MODELS = {
  GEMINI_FLASH: "google/gemini-3-flash-preview",
  PERPLEXITY_SONAR: "perplexity/sonar-pro-search",
  GPT_4O: "openai/gpt-4o",
  CLAUDE_SONNET: "anthropic/claude-3.5-sonnet",
} as const;

// Approximate costs per 1M tokens (input/output) - for estimation
const MODEL_COSTS: Record<string, { input: number; output: number }> = {
  [MODELS.GEMINI_FLASH]: { input: 0.075, output: 0.30 },
  [MODELS.PERPLEXITY_SONAR]: { input: 1.0, output: 1.0 },
  [MODELS.GPT_4O]: { input: 2.5, output: 10.0 },
  [MODELS.CLAUDE_SONNET]: { input: 3.0, output: 15.0 },
};

function estimateCost(
  model: string,
  promptTokens: number,
  completionTokens: number
): number {
  const costs = MODEL_COSTS[model] || { input: 1.0, output: 1.0 };
  const inputCost = (promptTokens / 1_000_000) * costs.input;
  const outputCost = (completionTokens / 1_000_000) * costs.output;
  return inputCost + outputCost;
}

export class OpenRouterClient {
  private apiKey: string;
  private baseUrl = "https://openrouter.ai/api/v1";

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error("OpenRouter API key is required");
    }
    this.apiKey = apiKey;
  }

  async chat(options: ChatCompletionOptions): Promise<ChatCompletionResponse> {
    const { model, messages, temperature = 0.7, maxTokens = 4096 } = options;

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
        "X-Title": "AI-GOS Media Plan Generator",
      },
      body: JSON.stringify({
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = response.statusText;
      try {
        const errorData = JSON.parse(errorText);
        errorMessage = errorData.error?.message || errorData.message || errorText;
      } catch {
        errorMessage = errorText || response.statusText;
      }
      console.error(`OpenRouter API error [${response.status}]:`, errorMessage);
      throw new Error(
        `OpenRouter API error: ${response.status} - ${errorMessage}`
      );
    }

    const data = await response.json();

    const promptTokens = data.usage?.prompt_tokens || 0;
    const completionTokens = data.usage?.completion_tokens || 0;

    return {
      content: data.choices[0]?.message?.content || "",
      usage: {
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens,
      },
      cost: estimateCost(model, promptTokens, completionTokens),
    };
  }

  async chatJSON<T>(options: ChatCompletionOptions): Promise<{ data: T; usage: ChatCompletionResponse["usage"]; cost: number }> {
    // Add JSON instruction to system message
    const messagesWithJSON = options.messages.map((msg, index) => {
      if (index === 0 && msg.role === "system") {
        return {
          ...msg,
          content: `${msg.content}\n\nIMPORTANT: Respond ONLY with valid JSON. No markdown, no code blocks, no explanation.`,
        };
      }
      return msg;
    });

    const response = await this.chat({
      ...options,
      messages: messagesWithJSON,
    });

    // Clean the response - remove markdown code blocks if present
    let cleanContent = response.content.trim();
    if (cleanContent.startsWith("```json")) {
      cleanContent = cleanContent.slice(7);
    } else if (cleanContent.startsWith("```")) {
      cleanContent = cleanContent.slice(3);
    }
    if (cleanContent.endsWith("```")) {
      cleanContent = cleanContent.slice(0, -3);
    }
    cleanContent = cleanContent.trim();

    try {
      const data = JSON.parse(cleanContent) as T;
      return {
        data,
        usage: response.usage,
        cost: response.cost,
      };
    } catch {
      throw new Error(`Failed to parse JSON response: ${cleanContent.slice(0, 200)}...`);
    }
  }
}

// Factory function to create client (matches Supabase pattern)
export function createOpenRouterClient(): OpenRouterClient {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY environment variable is not set");
  }
  return new OpenRouterClient(apiKey);
}
