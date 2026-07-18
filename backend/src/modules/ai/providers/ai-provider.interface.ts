export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_call_id?: string; // required when role === 'tool'
  name?: string;         // tool name for role === 'tool'
}

export interface ChatOptions {
  temperature?: number;
  maxTokens?: number;
  /** Hint the provider to return strict JSON. */
  json?: boolean;
}

/** JSON-Schema-compatible tool function definition. */
export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolChatResult {
  /** Text content from the AI, if it did not call tools. */
  content: string | null;
  /** Tool calls the AI wants to make (may be empty). */
  toolCalls: ToolCall[];
  /** The full assistant message to append to the conversation history. */
  rawMessage: unknown;
}

export interface AIProvider {
  /** Stable provider name for logging/diagnostics. */
  readonly name: string;

  /** Whether the provider is configured (e.g. API key present). */
  isConfigured(): boolean;

  /** Run a chat completion and return the assistant's text content. */
  chat(messages: ChatMessage[], options?: ChatOptions): Promise<string>;

  /** Optional: run one round of tool-augmented chat. */
  chatWithTools?(
    messages: ChatMessage[],
    tools: ToolDefinition[],
    options?: ChatOptions,
  ): Promise<ToolChatResult>;
}

/** DI token for the active AIProvider implementation. */
export const AI_PROVIDER = Symbol('AI_PROVIDER');
