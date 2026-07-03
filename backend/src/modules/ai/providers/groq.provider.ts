import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Groq from 'groq-sdk';
import { BusinessException } from '../../../common/exceptions/app.exceptions';
import { AIProvider, ChatMessage, ChatOptions } from './ai-provider.interface';

/** Abort a request after this many ms. */
const REQUEST_TIMEOUT_MS = 15_000;
/** At most one retry (so a maximum of two attempts total), handled by the SDK. */
const MAX_RETRIES = 1;

/**
 * Groq AI provider — talks to the Groq Chat Completions API via the official
 * `groq-sdk`. Configuration comes from the `ai` config namespace. The SDK exposes
 * an OpenAI-compatible surface, so `messages`, `temperature`, `max_tokens` and
 * `response_format` map straight through.
 */
@Injectable()
export class GroqProvider implements AIProvider {
  readonly name = 'groq';
  private readonly logger = new Logger(GroqProvider.name);

  /** Values Groq accepts for `reasoning_effort`; `auto` means "omit the param". */
  private readonly reasoningEffort: 'none' | 'default' | 'low' | 'medium' | 'high' | 'auto';
  private readonly apiKey?: string;
  private readonly model: string;
  private readonly client?: Groq;

  constructor(config: ConfigService) {
    const ai = config.get('ai') as {
      groqApiKey?: string;
      groqModel: string;
      groqReasoningEffort: 'none' | 'default' | 'low' | 'medium' | 'high' | 'auto';
    };
    this.apiKey = ai.groqApiKey;
    this.model = ai.groqModel;
    this.reasoningEffort = ai.groqReasoningEffort;
    this.client = this.apiKey
      ? new Groq({
          apiKey: this.apiKey,
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
        'AI provider is not configured (missing GROQ_API_KEY)',
        'AI_NOT_CONFIGURED',
      );
    }

    try {
      const completion = await this.client.chat.completions.create({
        model: this.model,
        messages,
        temperature: options.temperature ?? 0.2,
        max_completion_tokens: options.maxTokens ?? 512,
        // Disable chain-of-thought for reasoning models (Qwen3 etc.): it wastes the
        // token budget and truncates JSON mode. `auto` omits the param entirely.
        ...(this.reasoningEffort !== 'auto'
          ? { reasoning_effort: this.reasoningEffort }
          : {}),
        ...(options.json ? { response_format: { type: 'json_object' } } : {}),
      });

      const content = completion.choices?.[0]?.message?.content;
      if (!content) {
        throw new BusinessException(
          'AI provider returned an empty response',
          'AI_EMPTY_RESPONSE',
        );
      }
      return content.trim();
    } catch (error) {
      // Business exceptions (empty response) propagate untouched.
      if (error instanceof BusinessException) throw error;

      const message = this.describe(error);
      this.logger.error(`Groq request failed: ${message}`);
      throw new BusinessException(`AI provider error: ${message}`, 'AI_PROVIDER_ERROR');
    }
  }

  private describe(error: unknown): string {
    if (error instanceof Groq.APIError) {
      return `${error.status ?? 'ERR'} ${error.message}`;
    }
    return error instanceof Error ? error.message : String(error);
  }
}
