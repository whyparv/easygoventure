import { Body, Controller, Post } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { PERMISSIONS } from '../auth/rbac/permissions';
import { ApiResponse } from '../../common/dto/api-response.dto';
import { ApiStandardResponse } from '../../common/decorators/api-standard-response.decorator';
import { ApiStandardErrors } from '../../common/decorators/api-standard-errors.decorator';
import { AIService } from './ai.service';
import { ParseInquiryDto } from './dto/parse-inquiry.dto';
import { FollowupSuggestionDto } from './dto/followup-suggestion.dto';
import { ProposalSummaryDto } from './dto/proposal-summary.dto';
import { ChatDto } from './dto/chat.dto';
import { NextActionDto } from './dto/next-action.dto';
import { ProposalDraftDto } from './dto/proposal-draft.dto';
import { LeadChatDto } from './dto/lead-chat.dto';
import { LeadIntakeChatDto } from './dto/lead-intake-chat.dto';
import { GenerateQuoteDto } from './dto/generate-quote.dto';
import {
  ChatResponseDto,
  FollowupSuggestionResponseDto,
  NextActionResponseDto,
  ParsedInquiryResponseDto,
  ProposalSummaryResponseDto,
} from './dto/ai-response.dto';

@ApiTags('ai')
@ApiStandardErrors()
@RequirePermissions(PERMISSIONS.AI_USE)
@Controller('ai')
export class AIController {
  constructor(private readonly aiService: AIService) {}

  @Post('parse-inquiry')
  @ApiOperation({ summary: 'Extract structured fields from a free-text inquiry' })
  @ApiStandardResponse(ParsedInquiryResponseDto)
  async parseInquiry(@Body() dto: ParseInquiryDto) {
    const result = await this.aiService.parseInquiry(dto);
    return new ApiResponse(result, 'Inquiry parsed');
  }

  @Post('followup-suggestion')
  @ApiOperation({ summary: 'Generate a suggested follow-up message for a lead' })
  @ApiStandardResponse(FollowupSuggestionResponseDto)
  async followupSuggestion(@Body() dto: FollowupSuggestionDto) {
    const result = await this.aiService.followupSuggestion(dto);
    return new ApiResponse(result, 'Follow-up suggestion generated');
  }

  @Post('proposal-summary')
  @ApiOperation({ summary: 'Generate a client-friendly proposal summary' })
  @ApiStandardResponse(ProposalSummaryResponseDto)
  async proposalSummary(@Body() dto: ProposalSummaryDto) {
    const result = await this.aiService.proposalSummary(dto);
    return new ApiResponse(result, 'Proposal summary generated');
  }

  @Post('chat')
  @ApiOperation({ summary: 'Conversational DMC assistant (multi-turn)' })
  @ApiStandardResponse(ChatResponseDto)
  async chat(@Body() dto: ChatDto) {
    const result = await this.aiService.chat(dto);
    return new ApiResponse(result, 'Reply generated');
  }

  @Post('next-action')
  @ApiOperation({ summary: 'Recommend the best next action for the current lead' })
  @ApiStandardResponse(NextActionResponseDto)
  async nextAction(@Body() dto: NextActionDto) {
    const result = await this.aiService.nextAction(dto);
    return new ApiResponse(result, 'Next action recommended');
  }

  @Post('proposal-draft')
  @ApiOperation({ summary: 'Generate a customer-facing proposal (hotels/activities/transfers/visa)' })
  async proposalDraft(@Body() dto: ProposalDraftDto) {
    const result = await this.aiService.proposalDraft(dto);
    return new ApiResponse(result, 'Proposal drafted');
  }

  @Post('lead-chat')
  @ApiOperation({ summary: 'Lead-specific AI chat (uses brain prompt + full lead context)' })
  @ApiStandardResponse(ChatResponseDto)
  async leadChat(@Body() dto: LeadChatDto, @CurrentUser() user: AuthenticatedUser) {
    const result = await this.aiService.leadChat(dto, user);
    return new ApiResponse(result, 'Reply generated');
  }

  @Post('lead-intake-chat')
  @ApiOperation({ summary: 'Conversational lead intake - AI gathers missing fields via chat' })
  async leadIntakeChat(@Body() dto: LeadIntakeChatDto, @CurrentUser() user: AuthenticatedUser) {
    const result = await this.aiService.leadIntakeChat(dto, user);
    return new ApiResponse(result, 'Lead intake reply generated');
  }

  @Post('generate-quote')
  @ApiOperation({ summary: 'Generate a formatted WhatsApp quote message with calculated pricing' })
  async generateQuote(@Body() dto: GenerateQuoteDto, @CurrentUser() user: AuthenticatedUser) {
    const result = await this.aiService.generateQuote(dto, user);
    return new ApiResponse(result, 'Quote generated');
  }
}
