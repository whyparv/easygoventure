import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { ApiResponse } from '../../common/dto/api-response.dto';
import { ApiStandardErrors } from '../../common/decorators/api-standard-errors.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { PERMISSIONS } from '../auth/rbac/permissions';
import type { AuthenticatedUser } from '../auth/auth.types';
import { AiCopilotService } from './ai-copilot.service';
import { AiActionStatus } from './schemas/ai-action.schema';
import { CreateSessionDto } from './dto/copilot/create-session.dto';
import { CopilotMessageDto } from './dto/copilot/copilot-message.dto';
import { RecordActionDto } from './dto/copilot/record-action.dto';
import { ApprovalDecisionDto } from './dto/copilot/approval-decision.dto';
import { ExecutedActionDto } from './dto/copilot/executed-action.dto';

/**
 * AI Copilot infrastructure — conversational memory, recommendations, approvals
 * and execution history. Shares the `ai` path with the legacy stateless endpoints
 * (different sub-paths, so nothing collides). Human approval is mandatory and the
 * backend performs no autonomous writes.
 */
@ApiTags('ai-copilot')
@ApiStandardErrors()
@Controller('ai')
export class AiCopilotController {
  constructor(private readonly copilot: AiCopilotService) {}

  @Post('sessions')
  @RequirePermissions(PERMISSIONS.AI_USE)
  @ApiOperation({ summary: 'Start a copilot session with an optional context snapshot' })
  async createSession(@Body() dto: CreateSessionDto, @CurrentUser() user: AuthenticatedUser) {
    return new ApiResponse(await this.copilot.createSession(dto, user), 'Session created');
  }

  @Get('sessions')
  @RequirePermissions(PERMISSIONS.AI_USE)
  @ApiOperation({ summary: 'List your copilot sessions' })
  async listSessions(@CurrentUser() user: AuthenticatedUser) {
    return new ApiResponse(await this.copilot.listSessions(user));
  }

  @Get('sessions/:id/messages')
  @RequirePermissions(PERMISSIONS.AI_USE)
  @ApiOperation({ summary: 'Get the message history for a session' })
  async messages(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return new ApiResponse(await this.copilot.getMessages(id, user));
  }

  @Post('sessions/:id/messages')
  @RequirePermissions(PERMISSIONS.AI_USE)
  @ApiOperation({ summary: 'Send a message to the copilot (persisted, context-grounded)' })
  async postMessage(
    @Param('id') id: string,
    @Body() dto: CopilotMessageDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return new ApiResponse(await this.copilot.postMessage(id, dto, user), 'Reply generated');
  }

  @Post('actions')
  @RequirePermissions(PERMISSIONS.AI_USE)
  @ApiOperation({ summary: 'Record an AI-recommended action (pending human approval)' })
  async recordAction(@Body() dto: RecordActionDto, @CurrentUser() user: AuthenticatedUser) {
    return new ApiResponse(await this.copilot.recordAction(dto, user), 'Action recorded');
  }

  @Get('actions')
  @RequirePermissions(PERMISSIONS.AI_USE)
  @ApiQuery({ name: 'status', required: false, enum: AiActionStatus })
  @ApiOperation({ summary: 'List AI actions (optionally by status)' })
  async listActions(
    @CurrentUser() user: AuthenticatedUser,
    @Query('status') status?: AiActionStatus,
  ) {
    return new ApiResponse(await this.copilot.listActions(user, status));
  }

  @Post('actions/:id/approve')
  @RequirePermissions(PERMISSIONS.AI_APPROVE_ACTION)
  @ApiOperation({ summary: 'Approve a recommended action (human-in-the-loop)' })
  async approve(
    @Param('id') id: string,
    @Body() dto: ApprovalDecisionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return new ApiResponse(await this.copilot.approveAction(id, dto, user), 'Action approved');
  }

  @Post('actions/:id/reject')
  @RequirePermissions(PERMISSIONS.AI_APPROVE_ACTION)
  @ApiOperation({ summary: 'Reject a recommended action' })
  async reject(
    @Param('id') id: string,
    @Body() dto: ApprovalDecisionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return new ApiResponse(await this.copilot.rejectAction(id, dto, user), 'Action rejected');
  }

  @Post('actions/:id/executed')
  @RequirePermissions(PERMISSIONS.AI_APPROVE_ACTION)
  @ApiOperation({ summary: 'Mark an approved action as executed by the client' })
  async executed(
    @Param('id') id: string,
    @Body() dto: ExecutedActionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return new ApiResponse(await this.copilot.markExecuted(id, dto, user), 'Action marked executed');
  }
}
