import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { BusinessException } from '../../../common/exceptions/app.exceptions';
import {
  AIProvider,
  ChatMessage,
  ChatOptions,
  ToolDefinition,
  ToolCall,
  ToolChatResult,
} from './ai-provider.interface';

const REQUEST_TIMEOUT_MS = 45_000;
const MAX_RETRIES = 0;

/**
 * Synquic self-hosted LLM provider (Ollama + OpenAI-compatible gateway).
 * Base URL: https://self-llm.synquic.cloud/v1
 * Auth: X-API-Key header (not Authorization: Bearer).
 */
@Injectable()
export class SynquicProvider implements AIProvider {
  readonly name = 'synquic';
  private readonly logger = new Logger(SynquicProvider.name);

  private readonly client?: OpenAI;
  private readonly model: string;

  constructor(config: ConfigService) {
    const ai = config.get('ai') as {
      synquicApiKey?: string;
      synquicBaseUrl: string;
      synquicModel: string;
    };
    this.model = ai.synquicModel;
    this.client = ai.synquicApiKey
      ? new OpenAI({
          baseURL: ai.synquicBaseUrl,
          // The gateway accepts X-API-Key; pass a placeholder for the SDK's
          // Authorization header and add the real key as a custom header.
          apiKey: 'sk-placeholder',
          defaultHeaders: { 'X-API-Key': ai.synquicApiKey },
          timeout: REQUEST_TIMEOUT_MS,
          maxRetries: MAX_RETRIES,
        })
      : undefined;
  }

  isConfigured(): boolean {
    return Boolean(this.client);
  }

  async chat(messages: ChatMessage[], options: ChatOptions = {}): Promise<string> {
    if (!this.client) {
      throw new BusinessException(
        'AI provider is not configured (missing SYNQUIC_API_KEY)',
        'AI_NOT_CONFIGURED',
      );
    }

    // Ollama models don't support response_format; inject a JSON instruction instead.
    const msgs = options.json ? this.injectJsonInstruction(messages) : messages;

    try {
      const completion = await this.client.chat.completions.create({
        model: this.model,
        messages: msgs as OpenAI.Chat.ChatCompletionMessageParam[],
        temperature: options.temperature ?? 0.2,
        max_tokens: options.maxTokens ?? 800,
        stream: false,
      });

      const content = completion.choices?.[0]?.message?.content;
      if (!content) {
        throw new BusinessException('AI provider returned an empty response', 'AI_EMPTY_RESPONSE');
      }

      const text = content.trim();
      if (options.json) {
        return text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
      }
      return text;
    } catch (error) {
      if (error instanceof BusinessException) throw error;
      const message = this.describe(error);
      this.logger.error(`Synquic chat failed: ${message}`);
      throw new BusinessException(`AI provider error: ${message}`, 'AI_PROVIDER_ERROR');
    }
  }

  async chatWithTools(
    messages: ChatMessage[],
    tools: ToolDefinition[],
    options: ChatOptions = {},
  ): Promise<ToolChatResult> {
    if (!this.client) {
      throw new BusinessException(
        'AI provider is not configured (missing SYNQUIC_API_KEY)',
        'AI_NOT_CONFIGURED',
      );
    }

    try {
      const completion = await this.client.chat.completions.create({
        model: this.model,
        messages: messages as OpenAI.Chat.ChatCompletionMessageParam[],
        tools: tools as OpenAI.Chat.ChatCompletionTool[],
        tool_choice: 'auto',
        temperature: options.temperature ?? 0.2,
        max_tokens: options.maxTokens ?? 2000,
        stream: false,
      });

      const choice = completion.choices?.[0];
      if (!choice) {
        throw new BusinessException('AI provider returned no choices', 'AI_EMPTY_RESPONSE');
      }

      const toolCalls: ToolCall[] = (choice.message.tool_calls ?? [])
        .filter((tc): tc is OpenAI.Chat.ChatCompletionMessageToolCall & { type: 'function' } => tc.type === 'function')
        .map((tc) => ({
          id: tc.id,
          name: tc.function.name,
          arguments: (() => {
            try {
              return JSON.parse(tc.function.arguments || '{}') as Record<string, unknown>;
            } catch {
              return {} as Record<string, unknown>;
            }
          })(),
        }));

      return {
        content: choice.message.content ?? null,
        toolCalls,
        rawMessage: choice.message,
      };
    } catch (error) {
      if (error instanceof BusinessException) throw error;
      const message = this.describe(error);
      this.logger.error(`Synquic chatWithTools failed: ${message}`);
      throw new BusinessException(`AI provider error: ${message}`, 'AI_PROVIDER_ERROR');
    }
  }

  private injectJsonInstruction(messages: ChatMessage[]): ChatMessage[] {
    const systemIdx = messages.findIndex((m) => m.role === 'system');
    if (systemIdx >= 0) {
      return messages.map((m, i) =>
        i === systemIdx
          ? { ...m, content: m.content + '\n\nRespond with ONLY valid JSON and nothing else — no markdown fences, no explanation.' }
          : m,
      );
    }
    return [
      { role: 'system', content: 'Respond with ONLY valid JSON and nothing else — no markdown fences, no explanation.' },
      ...messages,
    ];
  }

  private describe(error: unknown): string {
    if (error instanceof OpenAI.APIError) {
      return `${error.status ?? 'ERR'} ${error.message}`;
    }
    return error instanceof Error ? error.message : String(error);
  }
}
