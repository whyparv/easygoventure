import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { HotelsModule } from '../hotels/hotels.module';
import { BrainModule } from '../brain/brain.module';
import { ServiceCatalogModule } from '../service-catalog/service-catalog.module';
import { AgenciesModule } from '../agencies/agencies.module';
import { AI_PROVIDER } from './providers/ai-provider.interface';
import { GroqProvider } from './providers/groq.provider';
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
 * AI module. The active provider is bound to the `AI_PROVIDER` token, so swapping
 * vendors is a one-line change here - nothing downstream depends on Groq directly.
 *
 * The legacy stateless endpoints (parse-inquiry, followup-suggestion,
 * proposal-summary, chat, next-action) remain intact. The copilot layer adds
 * conversational memory, recommendations, approvals and execution history on top.
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
    GroqProvider,
    { provide: AI_PROVIDER, useExisting: GroqProvider },
    AIService,
    AiCopilotService,
    AiCopilotRepository,
  ],
  exports: [AIService],
})
export class AiModule {}
