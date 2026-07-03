import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import { AiSession, AiSessionDocument } from './schemas/ai-session.schema';
import { AiMessage, AiMessageDocument } from './schemas/ai-message.schema';
import { AiAction, AiActionDocument } from './schemas/ai-action.schema';
import { AiApproval, AiApprovalDocument } from './schemas/ai-approval.schema';

@Injectable()
export class AiCopilotRepository {
  constructor(
    @InjectModel(AiSession.name) private readonly sessions: Model<AiSessionDocument>,
    @InjectModel(AiMessage.name) private readonly messages: Model<AiMessageDocument>,
    @InjectModel(AiAction.name) private readonly actions: Model<AiActionDocument>,
    @InjectModel(AiApproval.name) private readonly approvals: Model<AiApprovalDocument>,
  ) {}

  // ── Sessions ─────────────────────────────────────────────────────────────
  createSession(data: Partial<AiSession>): Promise<AiSessionDocument> {
    return this.sessions.create(data);
  }

  findSession(id: string, organizationId: Types.ObjectId): Promise<AiSessionDocument | null> {
    return this.sessions.findOne({ _id: id, organizationId, isDeleted: { $ne: true } }).exec();
  }

  listSessions(filter: FilterQuery<AiSessionDocument>): Promise<AiSessionDocument[]> {
    return this.sessions
      .find({ ...filter, isDeleted: { $ne: true } })
      .sort({ lastMessageAt: -1, createdAt: -1 })
      .limit(100)
      .exec();
  }

  touchSession(id: string, organizationId: Types.ObjectId): Promise<AiSessionDocument | null> {
    return this.sessions
      .findOneAndUpdate({ _id: id, organizationId }, { lastMessageAt: new Date() }, { new: true })
      .exec();
  }

  // ── Messages ─────────────────────────────────────────────────────────────
  createMessage(data: Partial<AiMessage>): Promise<AiMessageDocument> {
    return this.messages.create(data);
  }

  listMessages(
    sessionId: Types.ObjectId,
    organizationId: Types.ObjectId,
  ): Promise<AiMessageDocument[]> {
    return this.messages.find({ sessionId, organizationId }).sort({ createdAt: 1 }).exec();
  }

  // ── Actions ──────────────────────────────────────────────────────────────
  createAction(data: Partial<AiAction>): Promise<AiActionDocument> {
    return this.actions.create(data);
  }

  findAction(id: string, organizationId: Types.ObjectId): Promise<AiActionDocument | null> {
    return this.actions.findOne({ _id: id, organizationId, isDeleted: { $ne: true } }).exec();
  }

  listActions(filter: FilterQuery<AiActionDocument>): Promise<AiActionDocument[]> {
    return this.actions
      .find({ ...filter, isDeleted: { $ne: true } })
      .sort({ createdAt: -1 })
      .limit(100)
      .exec();
  }

  updateAction(
    id: string,
    data: Partial<AiAction>,
    organizationId: Types.ObjectId,
  ): Promise<AiActionDocument | null> {
    return this.actions
      .findOneAndUpdate({ _id: id, organizationId, isDeleted: { $ne: true } }, data, { new: true })
      .exec();
  }

  // ── Approvals ────────────────────────────────────────────────────────────
  createApproval(data: Partial<AiApproval>): Promise<AiApprovalDocument> {
    return this.approvals.create(data);
  }
}
