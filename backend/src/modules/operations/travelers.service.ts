import { Injectable } from '@nestjs/common';
import { Types } from 'mongoose';
import { NotFoundException, ValidationException } from '../../common/exceptions/app.exceptions';
import { requireOrganizationId, tenantFilter } from '../../common/tenant/tenant-scope';
import type { AuthenticatedUser } from '../auth/auth.types';
import { AuditService } from '../audit/audit.service';
import { ProposalsRepository } from '../proposals/proposals.repository';
import { ProposalDocument } from '../proposals/schemas/proposal.schema';
import { TravelersRepository } from './travelers.repository';
import { Traveler, TravelerDocument, TravelerStatus } from './schemas/traveler.schema';
import { CreateTravelerDto, UpdateTravelerDto } from './dto/traveler.dto';

@Injectable()
export class TravelersService {
  constructor(
    private readonly travelers: TravelersRepository,
    private readonly proposals: ProposalsRepository,
    private readonly audit: AuditService,
  ) {}

  async create(
    proposalId: string,
    dto: CreateTravelerDto,
    user: AuthenticatedUser,
  ): Promise<TravelerDocument> {
    const proposal = await this.ensureProposal(proposalId, user);
    const data: Partial<Traveler> = {
      organizationId: requireOrganizationId(user),
      proposalId: new Types.ObjectId(proposal.id as string),
      firstName: dto.firstName,
      lastName: dto.lastName,
      gender: dto.gender,
      dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
      nationality: dto.nationality,
      passportNumber: dto.passportNumber,
      passportExpiry: dto.passportExpiry ? new Date(dto.passportExpiry) : undefined,
      email: dto.email,
      phone: dto.phone,
      notes: dto.notes,
      status: TravelerStatus.ACTIVE,
    };
    const traveler = await this.travelers.create(data);
    await this.audit.recordForActor(user, undefined, {
      action: 'traveler.created',
      entity: 'Traveler',
      entityId: traveler.id as string,
      metadata: { proposalId },
    });
    return traveler;
  }

  async list(proposalId: string, user: AuthenticatedUser): Promise<TravelerDocument[]> {
    const proposal = await this.ensureProposal(proposalId, user);
    return this.travelers.findByProposal(tenantFilter(user), new Types.ObjectId(proposal.id as string));
  }

  async getOrThrow(id: string, user: AuthenticatedUser): Promise<TravelerDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new ValidationException(`"${id}" is not a valid id`, 'INVALID_ID');
    }
    const traveler = await this.travelers.findByIdScoped(id, tenantFilter(user));
    if (!traveler) throw new NotFoundException(`Traveler "${id}" not found`, 'TRAVELER_NOT_FOUND');
    return traveler;
  }

  async update(
    id: string,
    dto: UpdateTravelerDto,
    user: AuthenticatedUser,
  ): Promise<TravelerDocument> {
    await this.getOrThrow(id, user);
    const data: Partial<Traveler> = {};
    if (dto.firstName !== undefined) data.firstName = dto.firstName;
    if (dto.lastName !== undefined) data.lastName = dto.lastName;
    if (dto.gender !== undefined) data.gender = dto.gender;
    if (dto.dateOfBirth !== undefined) data.dateOfBirth = new Date(dto.dateOfBirth);
    if (dto.nationality !== undefined) data.nationality = dto.nationality;
    if (dto.passportNumber !== undefined) data.passportNumber = dto.passportNumber;
    if (dto.passportExpiry !== undefined) data.passportExpiry = new Date(dto.passportExpiry);
    if (dto.email !== undefined) data.email = dto.email;
    if (dto.phone !== undefined) data.phone = dto.phone;
    if (dto.notes !== undefined) data.notes = dto.notes;
    if (dto.status !== undefined) data.status = dto.status;

    const updated = await this.travelers.updateScoped(id, data, tenantFilter(user));
    if (!updated) throw new NotFoundException(`Traveler "${id}" not found`, 'TRAVELER_NOT_FOUND');
    await this.audit.recordForActor(user, undefined, {
      action: 'traveler.updated',
      entity: 'Traveler',
      entityId: id,
      newValue: { status: updated.status },
    });
    return updated;
  }

  /** Soft-delete a traveler (records are retained for manifest/audit history). */
  async remove(id: string, user: AuthenticatedUser): Promise<TravelerDocument> {
    await this.getOrThrow(id, user);
    const removed = await this.travelers.softDeleteScoped(id, tenantFilter(user));
    if (!removed) throw new NotFoundException(`Traveler "${id}" not found`, 'TRAVELER_NOT_FOUND');
    await this.audit.recordForActor(user, undefined, {
      action: 'traveler.updated',
      entity: 'Traveler',
      entityId: id,
      metadata: { removed: true },
    });
    return removed;
  }

  private async ensureProposal(
    proposalId: string,
    user: AuthenticatedUser,
  ): Promise<ProposalDocument> {
    if (!Types.ObjectId.isValid(proposalId)) {
      throw new ValidationException(`"${proposalId}" is not a valid id`, 'INVALID_ID');
    }
    const proposal = await this.proposals.findById(proposalId, tenantFilter(user));
    if (!proposal) throw new NotFoundException(`Proposal "${proposalId}" not found`, 'PROPOSAL_NOT_FOUND');
    return proposal;
  }
}
