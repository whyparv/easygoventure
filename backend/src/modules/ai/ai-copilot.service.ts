import { Injectable } from '@nestjs/common';
import { Types } from 'mongoose';
import {
  BusinessException,
  NotFoundException,
  ValidationException,
} from '../../common/exceptions/app.exceptions';
import { AuditService } from '../audit/audit.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import { AIService } from './ai.service';
import { AiCopilotRepository } from './ai-copilot.repository';
import { AiSessionDocument } from './schemas/ai-session.schema';
import { AiMessageDocument, AiMessageRole } from './schemas/ai-message.schema';
import { AiActionDocument, AiActionStatus } from './schemas/ai-action.schema';
import { AiApprovalDecision } from './schemas/ai-approval.schema';
import { CreateSessionDto } from './dto/copilot/create-session.dto';
import { CopilotMessageDto } from './dto/copilot/copilot-message.dto';
import { RecordActionDto } from './dto/copilot/record-action.dto';
import { ApprovalDecisionDto } from './dto/copilot/approval-decision.dto';
import { ExecutedActionDto } from './dto/copilot/executed-action.dto';

@Injectable()
export class AiCopilotService {
  constructor(
    private readonly repo: AiCopilotRepository,
    private readonly ai: AIService,
    private readonly audit: AuditService,
  ) {}

  private orgId(user: AuthenticatedUser): Types.ObjectId {
    if (!user.organizationId) {
      throw new BusinessException('An organization context is required', 'ORGANIZATION_REQUIRED');
    }
    return new Types.ObjectId(user.organizationId);
  }

  // ── Sessions & messages ────────────────────────────────────────────────

  async createSession(dto: CreateSessionDto, user: AuthenticatedUser): Promise<AiSessionDocument> {
    return this.repo.createSession({
      organizationId: this.orgId(user),
      userId: new Types.ObjectId(user.id),
      title: dto.title,
      contextType: dto.contextType,
      contextId: dto.contextId,
      contextSnapshot: dto.contextSnapshot,
    });
  }

  listSessions(user: AuthenticatedUser): Promise<AiSessionDocument[]> {
    return this.repo.listSessions({
      organizationId: this.orgId(user),
      userId: new Types.ObjectId(user.id),
    });
  }

  async getSessionOrThrow(id: string, user: AuthenticatedUser): Promise<AiSessionDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new ValidationException(`"${id}" is not a valid id`, 'INVALID_ID');
    }
    const session = await this.repo.findSession(id, this.orgId(user));
    if (!session) throw new NotFoundException(`Session "${id}" not found`, 'AI_SESSION_NOT_FOUND');
    return session;
  }

  async getMessages(id: string, user: AuthenticatedUser): Promise<AiMessageDocument[]> {
    const session = await this.getSessionOrThrow(id, user);
    return this.repo.listMessages(new Types.ObjectId(session.id as string), this.orgId(user));
  }

  /**
   * Persisted copilot chat: stores the user turn, calls the existing AIService
   * (grounded in the session's context snapshot + prior turns), stores the reply.
   */
  async postMessage(
    id: string,
    dto: CopilotMessageDto,
    user: AuthenticatedUser,
  ): Promise<{ reply: string; message: AiMessageDocument }> {
    const session = await this.getSessionOrThrow(id, user);
    const sessionId = new Types.ObjectId(session.id as string);
    const organizationId = this.orgId(user);

    await this.repo.createMessage({
      organizationId,
      sessionId,
      role: AiMessageRole.USER,
      content: dto.message,
    });

    const prior = await this.repo.listMessages(sessionId, organizationId);
    const history = prior
      .filter((m) => m.role === AiMessageRole.USER || m.role === AiMessageRole.ASSISTANT)
      .slice(-20)
      .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));

    const context = session.contextSnapshot
      ? JSON.stringify(session.contextSnapshot).slice(0, 8000)
      : undefined;

    const { reply } = await this.ai.chat({ message: dto.message, history, context });

    const assistantMessage = await this.repo.createMessage({
      organizationId,
      sessionId,
      role: AiMessageRole.ASSISTANT,
      content: reply,
    });
    await this.repo.touchSession(session.id as string, organizationId);
    return { reply, message: assistantMessage };
  }

  // ── Actions (recommend → approve/reject → executed) ────────────────────

  async recordAction(dto: RecordActionDto, user: AuthenticatedUser): Promise<AiActionDocument> {
    return this.repo.createAction({
      organizationId: this.orgId(user),
      sessionId: dto.sessionId ? new Types.ObjectId(dto.sessionId) : null,
      userId: new Types.ObjectId(user.id),
      type: dto.type,
      summary: dto.summary,
      payload: dto.payload ?? {},
      targetEntity: dto.targetEntity,
      targetId: dto.targetId,
      status: AiActionStatus.RECOMMENDED,
    });
  }

  listActions(user: AuthenticatedUser, status?: AiActionStatus): Promise<AiActionDocument[]> {
    return this.repo.listActions({
      organizationId: this.orgId(user),
      ...(status ? { status } : {}),
    });
  }

  async getActionOrThrow(id: string, user: AuthenticatedUser): Promise<AiActionDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new ValidationException(`"${id}" is not a valid id`, 'INVALID_ID');
    }
    const action = await this.repo.findAction(id, this.orgId(user));
    if (!action) throw new NotFoundException(`Action "${id}" not found`, 'AI_ACTION_NOT_FOUND');
    return action;
  }

  /** Approve a recommendation. Records the human decision (mandatory before execution). */
  async approveAction(id: string, dto: ApprovalDecisionDto, user: AuthenticatedUser): Promise<AiActionDocument> {
    const action = await this.getActionOrThrow(id, user);
    if (action.status !== AiActionStatus.RECOMMENDED) {
      throw new BusinessException(
        `Only a RECOMMENDED action can be approved (is ${action.status})`,
        'INVALID_ACTION_STATE',
      );
    }
    await this.repo.createApproval({
      organizationId: this.orgId(user),
      actionId: new Types.ObjectId(action.id as string),
      decidedByUserId: new Types.ObjectId(user.id),
      decision: AiApprovalDecision.APPROVED,
      reason: dto.reason,
    });
    const updated = await this.repo.updateAction(
      id,
      { status: AiActionStatus.APPROVED },
      this.orgId(user),
    );
    await this.audit.recordForActor(user, undefined, {
      action: 'ai.action.approved',
      entity: 'AiAction',
      entityId: id,
      newValue: { type: action.type, summary: action.summary },
    });
    return updated ?? action;
  }

  async rejectAction(id: string, dto: ApprovalDecisionDto, user: AuthenticatedUser): Promise<AiActionDocument> {
    const action = await this.getActionOrThrow(id, user);
    if (action.status !== AiActionStatus.RECOMMENDED) {
      throw new BusinessException(
        `Only a RECOMMENDED action can be rejected (is ${action.status})`,
        'INVALID_ACTION_STATE',
      );
    }
    await this.repo.createApproval({
      organizationId: this.orgId(user),
      actionId: new Types.ObjectId(action.id as string),
      decidedByUserId: new Types.ObjectId(user.id),
      decision: AiApprovalDecision.REJECTED,
      reason: dto.reason,
    });
    const updated = await this.repo.updateAction(
      id,
      { status: AiActionStatus.REJECTED },
      this.orgId(user),
    );
    await this.audit.recordForActor(user, undefined, {
      action: 'ai.action.rejected',
      entity: 'AiAction',
      entityId: id,
    });
    return updated ?? action;
  }

  /**
   * Mark an APPROVED action as executed. Execution itself is performed by the
   * client via the existing CRM mutations (human-in-the-loop); the backend never
   * writes autonomously — it only records that the approved action was carried out.
   */
  async markExecuted(id: string, dto: ExecutedActionDto, user: AuthenticatedUser): Promise<AiActionDocument> {
    const action = await this.getActionOrThrow(id, user);
    if (action.status !== AiActionStatus.APPROVED) {
      throw new BusinessException(
        `Only an APPROVED action can be marked executed (is ${action.status})`,
        'INVALID_ACTION_STATE',
      );
    }
    const updated = await this.repo.updateAction(
      id,
      {
        status: dto.success === false ? AiActionStatus.FAILED : AiActionStatus.EXECUTED,
        executedAt: new Date(),
        executionResult: dto.result,
      },
      this.orgId(user),
    );
    await this.audit.recordForActor(user, undefined, {
      action: 'ai.action.executed',
      entity: 'AiAction',
      entityId: id,
      newValue: { success: dto.success !== false, result: dto.result },
    });
    return updated ?? action;
  }
}
