import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { BusinessException } from '../../../common/exceptions/app.exceptions';
import {
  AIProvider,
  ChatMessage,
  ChatOptions,
  ToolDefinition,
  ToolCall,
  ToolChatResult,
} from './ai-provider.interface';

const REQUEST_TIMEOUT_MS = 30_000;
const MAX_RETRIES = 0;

/**
 * Anthropic Claude provider. Implements the same AIProvider interface as GroqProvider
 * so the rest of the app is vendor-agnostic.
 *
 * Key differences from the OpenAI-compatible API:
 *  - System messages are a top-level `system` param, not a message in the array.
 *  - JSON mode is approximated via an explicit instruction + post-extraction.
 *  - Tool call objects use `input` not `arguments`, and the stop_reason is `tool_use`.
 */
@Injectable()
export class AnthropicProvider implements AIProvider {
  readonly name = 'anthropic';
  private readonly logger = new Logger(AnthropicProvider.name);

  private readonly client?: Anthropic;
  private readonly model: string;

  constructor(config: ConfigService) {
    const ai = config.get('ai') as {
      anthropicApiKey?: string;
      anthropicModel: string;
    };
    this.model = ai.anthropicModel;
    this.client = ai.anthropicApiKey
      ? new Anthropic({
          apiKey: ai.anthropicApiKey,
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
        'AI provider is not configured (missing ANTHROPIC_API_KEY)',
        'AI_NOT_CONFIGURED',
      );
    }

    // Claude separates system from the conversation turns.
    const systemMsg = messages.find((m) => m.role === 'system');
    const turns = messages.filter((m) => m.role !== 'system');

    let system = systemMsg?.content ?? '';
    if (options.json) {
      system +=
        '\n\nYou MUST respond with ONLY valid JSON and nothing else — no markdown fences, no explanation.';
    }

    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: options.maxTokens ?? 512,
        temperature: options.temperature ?? 0.2,
        system: system || undefined,
        messages: turns.map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        })),
      });

      const block = response.content[0];
      if (!block || block.type !== 'text') {
        throw new BusinessException('AI provider returned an empty response', 'AI_EMPTY_RESPONSE');
      }

      const text = block.text.trim();

      // When JSON mode was requested, strip any accidental markdown fence.
      if (options.json) {
        return text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
      }
      return text;
    } catch (error) {
      if (error instanceof BusinessException) throw error;
      const message = this.describe(error);
      this.logger.error(`Anthropic request failed: ${message}`);
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
        'AI provider is not configured (missing ANTHROPIC_API_KEY)',
        'AI_NOT_CONFIGURED',
      );
    }

    const systemMsg = messages.find((m) => m.role === 'system');
    const turns = messages.filter((m) => m.role !== 'system');

    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: options.maxTokens ?? 2000,
        temperature: options.temperature ?? 0.2,
        system: systemMsg?.content || undefined,
        tools: tools.map((t) => ({
          name: t.function.name,
          description: t.function.description,
          input_schema: t.function.parameters as Anthropic.Tool['input_schema'],
        })),
        messages: turns.map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        })),
      });

      const textBlocks = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === 'text')
        .map((b) => b.text)
        .join('');

      const toolUseBlocks = response.content.filter(
        (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
      );

      const toolCalls: ToolCall[] = toolUseBlocks.map((b) => ({
        id: b.id,
        name: b.name,
        arguments: b.input as Record<string, unknown>,
      }));

      return {
        content: textBlocks || null,
        toolCalls,
        rawMessage: response,
      };
    } catch (error) {
      if (error instanceof BusinessException) throw error;
      const message = this.describe(error);
      this.logger.error(`Anthropic chatWithTools failed: ${message}`);
      throw new BusinessException(`AI provider error: ${message}`, 'AI_PROVIDER_ERROR');
    }
  }

  private describe(error: unknown): string {
    if (error instanceof Anthropic.APIError) {
      return `${error.status ?? 'ERR'} ${error.message}`;
    }
    return error instanceof Error ? error.message : String(error);
  }
}
