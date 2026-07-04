import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection, FilterQuery, SortOrder, Types } from 'mongoose';
import { PaginatedResponse } from '../../common/dto/paginated-response.dto';
import {
  BusinessException,
  NotFoundException,
  ValidationException,
} from '../../common/exceptions/app.exceptions';
import { escapeRegExp } from '../../common/utils/regex.util';
import { tenantFilter } from '../../common/tenant/tenant-scope';
import { AuditService } from '../audit/audit.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import { LeadsService } from '../leads/leads.service';
import { LeadActivityType } from '../leads/schemas/lead-activity.schema';
import { LeadStatus } from '../leads/schemas/lead.schema';
import { FulfillmentsService } from '../fulfillments/fulfillments.service';
import { FulfillmentDocument } from '../fulfillments/schemas/fulfillment.schema';
import { ProposalsRepository } from './proposals.repository';
import { ProposalTokenService } from './proposal-token.service';
import { CreateProposalDto } from './dto/create-proposal.dto';
import { UpdateProposalDto } from './dto/update-proposal.dto';
import { QueryProposalDto } from './dto/query-proposal.dto';
import { RejectProposalDto } from './dto/reject-proposal.dto';
import { Proposal, ProposalDocument, ProposalStatus } from './schemas/proposal.schema';

const MAX_TOKEN_ATTEMPTS = 5;

@Injectable()
export class ProposalsService {
  constructor(
    @InjectConnection() private readonly connection: Connection,
    private readonly proposals: ProposalsRepository,
    private readonly tokens: ProposalTokenService,
    private readonly leadsService: LeadsService,
    private readonly fulfillmentsService: FulfillmentsService,
    private readonly audit: AuditService,
  ) {}

  async create(dto: CreateProposalDto, actor: AuthenticatedUser): Promise<ProposalDocument> {
    // Scoped: only a lead in the actor's organization can be proposed against.
    const lead = await this.leadsService.findByIdOrThrow(dto.leadId, actor);
    const organizationId = lead.organizationId;

    const base: Partial<Proposal> = {
      organizationId,
      leadId: new Types.ObjectId(dto.leadId),
      title: dto.title,
      description: dto.description,
      proposalType: dto.proposalType,
      amount: dto.amount ?? 0,
      currency: dto.currency,
      notes: dto.notes,
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
      status: ProposalStatus.DRAFT,
    };

    const proposal = await this.createWithUniqueToken(base);

    await this.leadsService.appendActivity(
      dto.leadId,
      LeadActivityType.PROPOSAL_CREATED,
      `Proposal "${proposal.title}" created (${proposal.generatedToken})`,
      organizationId,
      { proposalId: proposal.id as string, token: proposal.generatedToken },
    );
    await this.audit.recordForActor(actor, undefined, {
      action: 'proposal.created',
      entity: 'Proposal',
      entityId: proposal.id as string,
      newValue: { title: proposal.title, token: proposal.generatedToken },
    });
    return proposal;
  }

  async findAll(query: QueryProposalDto, actor: AuthenticatedUser): Promise<PaginatedResponse<ProposalDocument>> {
    const filter: FilterQuery<ProposalDocument> = { ...tenantFilter<ProposalDocument>(actor) };
    if (query.leadId) filter.leadId = new Types.ObjectId(query.leadId);
    if (query.status) filter.status = query.status;
    if (query.proposalType) filter.proposalType = query.proposalType;
    if (query.search) filter.title = { $regex: escapeRegExp(query.search), $options: 'i' };

    const sort: Record<string, SortOrder> = {
      [query.sortBy ?? 'createdAt']: query.sortOrder,
    };

    const { items, total } = await this.proposals.paginate(filter, {
      skip: query.skip,
      limit: query.limit,
      sort,
    });
    return new PaginatedResponse(items, total, query.page, query.limit);
  }

  async findByIdOrThrow(id: string, actor: AuthenticatedUser): Promise<ProposalDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new ValidationException(`"${id}" is not a valid id`, 'INVALID_ID');
    }
    const proposal = await this.proposals.findById(id, tenantFilter<ProposalDocument>(actor));
    if (!proposal) {
      throw new NotFoundException(`Proposal "${id}" not found`, 'PROPOSAL_NOT_FOUND');
    }
    return proposal;
  }

  async update(id: string, dto: UpdateProposalDto, actor: AuthenticatedUser): Promise<ProposalDocument> {
    const proposal = await this.findByIdOrThrow(id, actor);
    if (proposal.status === ProposalStatus.ACCEPTED) {
      throw new BusinessException('An accepted proposal cannot be edited', 'PROPOSAL_LOCKED');
    }
    const data: Partial<Proposal> = {
      ...dto,
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
    };
    const updated = await this.proposals.update(id, data, tenantFilter<ProposalDocument>(actor));
    if (!updated) {
      throw new NotFoundException(`Proposal "${id}" not found`, 'PROPOSAL_NOT_FOUND');
    }
    return updated;
  }

  async send(id: string, actor: AuthenticatedUser): Promise<ProposalDocument> {
    const proposal = await this.findByIdOrThrow(id, actor);
    const updated = await this.transitionOrThrow(
      id,
      [ProposalStatus.DRAFT, ProposalStatus.SENT],
      ProposalStatus.SENT,
      proposal.status,
      tenantFilter<ProposalDocument>(actor),
    );

    const leadId = this.leadId(updated);
    await this.leadsService.setStatus(leadId, LeadStatus.QUOTE_SENT, updated.organizationId);
    await this.leadsService.appendActivity(
      leadId,
      LeadActivityType.PROPOSAL_SENT,
      `Proposal ${updated.generatedToken} sent to client`,
      updated.organizationId,
    );
    await this.audit.recordForActor(actor, undefined, {
      action: 'proposal.sent',
      entity: 'Proposal',
      entityId: id,
    });
    return updated;
  }

  /**
   * Accept a proposal. The status flip is atomic (only one concurrent request
   * can win), and the lead/activity/fulfillment writes run inside a single Mongo
   * transaction so a mid-flow failure rolls everything back.
   */
  async accept(
    id: string,
    actor: AuthenticatedUser,
  ): Promise<{ proposal: ProposalDocument; fulfillment: FulfillmentDocument }> {
    const proposal = await this.findByIdOrThrow(id, actor);
    const tenant = tenantFilter<ProposalDocument>(actor);
    const session = await this.connection.startSession();
    try {
      let result: { proposal: ProposalDocument; fulfillment: FulfillmentDocument } | undefined;

      await session.withTransaction(async () => {
        const accepted = await this.proposals.transitionStatus(
          id,
          [ProposalStatus.SENT, ProposalStatus.VIEWED],
          ProposalStatus.ACCEPTED,
          session,
          tenant,
        );
        if (!accepted) {
          // Lost the race or wrong state — abort the transaction.
          throw new BusinessException(
            `Cannot accept proposal while it is ${proposal.status}`,
            'INVALID_PROPOSAL_TRANSITION',
          );
        }

        const leadId = this.leadId(accepted);
        const organizationId = accepted.organizationId;
        await this.leadsService.setStatus(leadId, LeadStatus.CONFIRMED, organizationId, session);
        await this.leadsService.appendActivity(
          leadId,
          LeadActivityType.PROPOSAL_ACCEPTED,
          `Proposal ${accepted.generatedToken} accepted by client`,
          organizationId,
          undefined,
          session,
        );

        const fulfillment = await this.fulfillmentsService.createFromAcceptedProposal(
          {
            organizationId,
            leadId,
            proposalId: accepted.id as string,
            proposalType: accepted.proposalType,
          },
          session,
        );
        result = { proposal: accepted, fulfillment };
      });

      // withTransaction only resolves on commit, so result is always set here.
      const settled = result as { proposal: ProposalDocument; fulfillment: FulfillmentDocument };
      await this.audit.recordForActor(actor, undefined, {
        action: 'proposal.accepted',
        entity: 'Proposal',
        entityId: id,
        newValue: { fulfillmentId: settled.fulfillment.id as string },
      });
      return settled;
    } finally {
      await session.endSession();
    }
  }

  async reject(id: string, dto: RejectProposalDto, actor: AuthenticatedUser): Promise<ProposalDocument> {
    const proposal = await this.findByIdOrThrow(id, actor);
    const updated = await this.transitionOrThrow(
      id,
      [ProposalStatus.DRAFT, ProposalStatus.SENT, ProposalStatus.VIEWED],
      ProposalStatus.REJECTED,
      proposal.status,
      tenantFilter<ProposalDocument>(actor),
    );

    const leadId = this.leadId(updated);
    await this.leadsService.setStatus(leadId, LeadStatus.REJECTED, updated.organizationId);
    await this.leadsService.appendActivity(
      leadId,
      LeadActivityType.PROPOSAL_REJECTED,
      `Proposal ${updated.generatedToken} rejected${dto.reason ? `: ${dto.reason}` : ''}`,
      updated.organizationId,
    );
    await this.audit.recordForActor(actor, undefined, {
      action: 'proposal.rejected',
      entity: 'Proposal',
      entityId: id,
      newValue: { reason: dto.reason },
    });
    return updated;
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  private async createWithUniqueToken(base: Partial<Proposal>): Promise<ProposalDocument> {
    for (let attempt = 0; attempt < MAX_TOKEN_ATTEMPTS; attempt += 1) {
      try {
        return await this.proposals.create({ ...base, generatedToken: this.tokens.generate() });
      } catch (error) {
        if (this.isDuplicateKeyError(error) && attempt < MAX_TOKEN_ATTEMPTS - 1) continue;
        throw error;
      }
    }
    throw new BusinessException('Could not allocate a unique proposal token', 'TOKEN_ALLOCATION');
  }

  /**
   * Atomic conditional status transition; throws a business error if the proposal
   * was not in an allowed source state (covers both wrong-state and lost-race).
   */
  private async transitionOrThrow(
    id: string,
    from: ProposalStatus[],
    to: ProposalStatus,
    currentStatus: ProposalStatus,
    tenant: FilterQuery<ProposalDocument>,
  ): Promise<ProposalDocument> {
    const updated = await this.proposals.transitionStatus(id, from, to, undefined, tenant);
    if (!updated) {
      throw new BusinessException(
        `Cannot perform this action while proposal is ${currentStatus}`,
        'INVALID_PROPOSAL_TRANSITION',
      );
    }
    return updated;
  }

  private leadId(proposal: ProposalDocument): string {
    // Legacy lead-based transitions always have a lead; commercial proposals never
    // reach these paths (they are created already-ACCEPTED).
    if (!proposal.leadId) {
      throw new BusinessException('This proposal is not linked to a lead', 'PROPOSAL_NO_LEAD');
    }
    return proposal.leadId.toString();
  }

  private isDuplicateKeyError(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: number }).code === 11000
    );
  }
}
