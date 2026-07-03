/**
 * Provider-agnostic chat abstraction. Swapping vendors (Groq, OpenAI, Bedrock…)
 * means adding a class that implements this interface — no call-site changes.
 */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatOptions {
  temperature?: number;
  maxTokens?: number;
  /** Hint the provider to return strict JSON. */
  json?: boolean;
}

export interface AIProvider {
  /** Stable provider name for logging/diagnostics. */
  readonly name: string;

  /** Whether the provider is configured (e.g. API key present). */
  isConfigured(): boolean;

  /** Run a chat completion and return the assistant's text content. */
  chat(messages: ChatMessage[], options?: ChatOptions): Promise<string>;
}

/** DI token for the active AIProvider implementation. */
export const AI_PROVIDER = Symbol('AI_PROVIDER');
