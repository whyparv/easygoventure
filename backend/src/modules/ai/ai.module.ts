import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { HotelsModule } from '../hotels/hotels.module';
import { BrainModule } from '../brain/brain.module';
import { ServiceCatalogModule } from '../service-catalog/service-catalog.module';
import { AgenciesModule } from '../agencies/agencies.module';
import { AI_PROVIDER, AIProvider } from './providers/ai-provider.interface';
import { GroqProvider } from './providers/groq.provider';
import { AnthropicProvider } from './providers/anthropic.provider';
import { OpenRouterProvider } from './providers/openrouter.provider';
import { AIService } from './ai.service';
import { AIController } from './ai.controller';
import { AiCopilotController } from './ai-copilot.controller';
import { AiCopilotService } from './ai-copilot.service';
import { AiCopilotRepository } from './ai-copilot.repository';
import { AiSession, AiSessionSchema } from './schemas/ai-session.schema';
import { AiMessage, AiMessageSchema } from './schemas/ai-message.schema';
import { AiAction, AiActionSchema } from './schemas/ai-action.schema';
import { AiApproval, AiApprovalSchema } from './schemas/ai-approval.schema';

/**
 * AI module. Active provider is resolved at startup from the first configured key.
 * Priority: OpenRouter (OPENROUTER_API_KEY) → Anthropic (ANTHROPIC_API_KEY) → Groq (GROQ_API_KEY).
 */
@Module({
  imports: [
    HotelsModule,
    BrainModule,
    ServiceCatalogModule,
    AgenciesModule,
    MongooseModule.forFeature([
      { name: AiSession.name, schema: AiSessionSchema },
      { name: AiMessage.name, schema: AiMessageSchema },
      { name: AiAction.name, schema: AiActionSchema },
      { name: AiApproval.name, schema: AiApprovalSchema },
    ]),
  ],
  controllers: [AIController, AiCopilotController],
  providers: [
    OpenRouterProvider,
    AnthropicProvider,
    GroqProvider,
    {
      provide: AI_PROVIDER,
      useFactory: (
        openrouter: OpenRouterProvider,
        anthropic: AnthropicProvider,
        groq: GroqProvider,
      ): AIProvider => {
        if (openrouter.isConfigured()) return openrouter;
        if (anthropic.isConfigured()) return anthropic;
        return groq;
      },
      inject: [OpenRouterProvider, AnthropicProvider, GroqProvider],
    },
    AIService,
    AiCopilotService,
    AiCopilotRepository,
  ],
  exports: [AIService],
})
export class AiModule {}
