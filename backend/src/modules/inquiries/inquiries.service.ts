import { Injectable } from '@nestjs/common';
import { FilterQuery, SortOrder, Types } from 'mongoose';
import { PaginatedResponse } from '../../common/dto/paginated-response.dto';
import {
  BusinessException,
  NotFoundException,
  ValidationException,
} from '../../common/exceptions/app.exceptions';
import { escapeRegExp } from '../../common/utils/regex.util';
import { AuditService } from '../audit/audit.service';
import { LeadsService } from '../leads/leads.service';
import { CreateLeadDto } from '../leads/dto/create-lead.dto';
import { InquiryType, LeadSource } from '../leads/schemas/lead.schema';
import type { AuthenticatedUser } from '../auth/auth.types';
import { InquiriesRepository } from './inquiries.repository';
import { InquiryReferenceService } from './inquiry-reference.service';
import { Inquiry, InquiryDocument, InquirySource, InquiryStatus } from './schemas/inquiry.schema';
import { CreateInquiryDto } from './dto/create-inquiry.dto';
import { UpdateInquiryDto } from './dto/update-inquiry.dto';
import { QueryInquiryDto } from './dto/query-inquiry.dto';
import { TransitionInquiryDto } from './dto/transition-inquiry.dto';

/** Allowed status transitions for the inquiry lifecycle. */
const TRANSITIONS: Record<InquiryStatus, InquiryStatus[]> = {
  [InquiryStatus.DRAFT]: [InquiryStatus.COLLECTING_INFORMATION, InquiryStatus.READY_FOR_PRICING, InquiryStatus.CANCELLED],
  [InquiryStatus.COLLECTING_INFORMATION]: [InquiryStatus.READY_FOR_PRICING, InquiryStatus.DRAFT, InquiryStatus.CANCELLED],
  [InquiryStatus.READY_FOR_PRICING]: [InquiryStatus.QUOTED, InquiryStatus.COLLECTING_INFORMATION, InquiryStatus.CANCELLED],
  [InquiryStatus.QUOTED]: [InquiryStatus.READY_FOR_PRICING, InquiryStatus.CANCELLED],
  [InquiryStatus.CONVERTED]: [],
  [InquiryStatus.CANCELLED]: [],
};

const MAX_REFERENCE_ATTEMPTS = 5;

@Injectable()
export class InquiriesService {
  constructor(
    private readonly inquiries: InquiriesRepository,
    private readonly references: InquiryReferenceService,
    private readonly leadsService: LeadsService,
    private readonly audit: AuditService,
  ) {}

  private orgId(user: AuthenticatedUser): Types.ObjectId {
    if (!user.organizationId) {
      throw new BusinessException('An organization context is required', 'ORGANIZATION_REQUIRED');
    }
    return new Types.ObjectId(user.organizationId);
  }

  /** Query-level tenant scope for the caller's organization. */
  private scope(user: AuthenticatedUser): FilterQuery<InquiryDocument> {
    return { organizationId: this.orgId(user) };
  }

  async create(dto: CreateInquiryDto, user: AuthenticatedUser): Promise<InquiryDocument> {
    const organizationId = this.orgId(user);
    const base: Partial<Inquiry> = {
      organizationId,
      source: dto.source ?? InquirySource.MANUAL,
      status: InquiryStatus.DRAFT,
      customerName: dto.customerName,
      customerPhone: dto.customerPhone,
      customerEmail: dto.customerEmail,
      companyName: dto.companyName,
      destination: dto.destination,
      serviceCategoryCode: dto.serviceCategoryCode,
      travelers: dto.travelers,
      travelDate: dto.travelDate ? new Date(dto.travelDate) : undefined,
      budget: dto.budget,
      rawInquiry: dto.rawInquiry,
      notes: dto.notes,
      assignedToUserId: dto.assignedToUserId ? new Types.ObjectId(dto.assignedToUserId) : null,
    };

    const created = await this.createWithUniqueReference(base);
    await this.audit.recordForActor(user, undefined, {
      action: 'inquiry.created',
      entity: 'Inquiry',
      entityId: created.id as string,
      newValue: { referenceNo: created.referenceNo, customerName: created.customerName },
    });
    return created;
  }

  async findAll(query: QueryInquiryDto, user: AuthenticatedUser): Promise<PaginatedResponse<InquiryDocument>> {
    const filter: FilterQuery<InquiryDocument> = {};
    if (query.status) filter.status = query.status;
    if (query.source) filter.source = query.source;
    if (query.serviceCategoryCode) filter.serviceCategoryCode = query.serviceCategoryCode.toUpperCase();
    if (query.search) {
      const term = escapeRegExp(query.search);
      filter.$or = [
        { customerName: { $regex: term, $options: 'i' } },
        { customerPhone: { $regex: term, $options: 'i' } },
        { companyName: { $regex: term, $options: 'i' } },
        { referenceNo: { $regex: term, $options: 'i' } },
      ];
    }

    const sort: Record<string, SortOrder> = { [query.sortBy ?? 'createdAt']: query.sortOrder };
    const { items, total } = await this.inquiries.paginateScoped(this.scope(user), filter, {
      skip: query.skip,
      limit: query.limit,
      sort,
    });
    return new PaginatedResponse(items, total, query.page, query.limit);
  }

  async findByIdOrThrow(id: string, user: AuthenticatedUser): Promise<InquiryDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new ValidationException(`"${id}" is not a valid id`, 'INVALID_ID');
    }
    const inquiry = await this.inquiries.findByIdScoped(id, this.scope(user));
    if (!inquiry) throw new NotFoundException(`Inquiry "${id}" not found`, 'INQUIRY_NOT_FOUND');
    return inquiry;
  }

  async update(id: string, dto: UpdateInquiryDto, user: AuthenticatedUser): Promise<InquiryDocument> {
    const inquiry = await this.findByIdOrThrow(id, user);
    if (this.isTerminal(inquiry.status)) {
      throw new BusinessException(
        `A ${inquiry.status} inquiry cannot be edited`,
        'INQUIRY_LOCKED',
      );
    }
    const data: Partial<Inquiry> = {
      customerName: dto.customerName,
      customerPhone: dto.customerPhone,
      customerEmail: dto.customerEmail,
      companyName: dto.companyName,
      destination: dto.destination,
      serviceCategoryCode: dto.serviceCategoryCode,
      travelers: dto.travelers,
      travelDate: dto.travelDate ? new Date(dto.travelDate) : undefined,
      budget: dto.budget,
      rawInquiry: dto.rawInquiry,
      notes: dto.notes,
    };
    if (dto.assignedToUserId !== undefined) {
      data.assignedToUserId = dto.assignedToUserId ? new Types.ObjectId(dto.assignedToUserId) : null;
    }
    const updated = await this.inquiries.updateScoped(id, data, this.scope(user));
    if (!updated) throw new NotFoundException(`Inquiry "${id}" not found`, 'INQUIRY_NOT_FOUND');
    return updated;
  }

  /** Move an inquiry along its lifecycle (excluding CONVERTED, which uses convert()). */
  async transition(
    id: string,
    dto: TransitionInquiryDto,
    user: AuthenticatedUser,
  ): Promise<InquiryDocument> {
    const inquiry = await this.findByIdOrThrow(id, user);
    if (dto.status === InquiryStatus.CONVERTED) {
      throw new BusinessException('Use the convert endpoint to convert an inquiry', 'USE_CONVERT');
    }
    this.assertTransition(inquiry.status, dto.status);

    const updated = await this.inquiries.updateScoped(id, { status: dto.status }, this.scope(user));
    if (!updated) throw new NotFoundException(`Inquiry "${id}" not found`, 'INQUIRY_NOT_FOUND');
    await this.audit.recordForActor(user, undefined, {
      action: 'inquiry.status_changed',
      entity: 'Inquiry',
      entityId: id,
      oldValue: { status: inquiry.status },
      newValue: { status: dto.status },
    });
    return updated;
  }

  /**
   * Convert an inquiry into a downstream Lead (the sales artifact). Allowed from
   * READY_FOR_PRICING or QUOTED. The inquiry becomes CONVERTED and links the lead.
   */
  async convert(
    id: string,
    user: AuthenticatedUser,
  ): Promise<{ inquiry: InquiryDocument; leadId: string }> {
    const inquiry = await this.findByIdOrThrow(id, user);
    if (inquiry.status !== InquiryStatus.QUOTED && inquiry.status !== InquiryStatus.READY_FOR_PRICING) {
      throw new BusinessException(
        `An inquiry must be READY_FOR_PRICING or QUOTED to convert (is ${inquiry.status})`,
        'INVALID_CONVERSION_STATE',
      );
    }
    if (!inquiry.customerPhone) {
      throw new BusinessException(
        'A customer phone number is required to convert to a lead',
        'PHONE_REQUIRED',
      );
    }

    const leadInput: CreateLeadDto = {
      name: inquiry.customerName,
      phone: inquiry.customerPhone,
      email: inquiry.customerEmail,
      companyName: inquiry.companyName,
      source: this.mapSource(inquiry.source),
      inquiryType: this.mapType(inquiry.serviceCategoryCode),
      notes: inquiry.notes,
      rawInquiry: inquiry.rawInquiry,
    };
    const lead = await this.leadsService.create(leadInput, user);

    const updated = await this.inquiries.updateScoped(
      id,
      {
        status: InquiryStatus.CONVERTED,
        convertedLeadId: new Types.ObjectId(lead.id as string),
      },
      this.scope(user),
    );
    await this.audit.recordForActor(user, undefined, {
      action: 'inquiry.converted',
      entity: 'Inquiry',
      entityId: id,
      newValue: { leadId: lead.id as string },
    });
    return { inquiry: updated ?? inquiry, leadId: lead.id as string };
  }

  async remove(id: string, user: AuthenticatedUser): Promise<void> {
    await this.findByIdOrThrow(id, user);
    await this.inquiries.softDeleteScoped(id, this.scope(user));
    await this.audit.recordForActor(user, undefined, {
      action: 'inquiry.deleted',
      entity: 'Inquiry',
      entityId: id,
    });
  }

  // ── Helpers ────────────────────────────────────────────────────────────

  private assertTransition(from: InquiryStatus, to: InquiryStatus): void {
    if (!TRANSITIONS[from].includes(to)) {
      throw new BusinessException(
        `Cannot move an inquiry from ${from} to ${to}`,
        'INVALID_INQUIRY_TRANSITION',
      );
    }
  }

  private isTerminal(status: InquiryStatus): boolean {
    return status === InquiryStatus.CONVERTED || status === InquiryStatus.CANCELLED;
  }

  private async createWithUniqueReference(base: Partial<Inquiry>): Promise<InquiryDocument> {
    for (let attempt = 0; attempt < MAX_REFERENCE_ATTEMPTS; attempt += 1) {
      try {
        return await this.inquiries.create({ ...base, referenceNo: this.references.generate() });
      } catch (error) {
        if (this.isDuplicateKeyError(error) && attempt < MAX_REFERENCE_ATTEMPTS - 1) continue;
        throw error;
      }
    }
    throw new BusinessException('Could not allocate a unique inquiry reference', 'REFERENCE_ALLOCATION');
  }

  private isDuplicateKeyError(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: number }).code === 11000
    );
  }

  private mapSource(source: InquirySource): LeadSource {
    switch (source) {
      case InquirySource.WHATSAPP:
        return LeadSource.WHATSAPP;
      case InquirySource.EMAIL:
        return LeadSource.EMAIL;
      default:
        return LeadSource.MANUAL;
    }
  }

  private mapType(categoryCode?: string): InquiryType {
    switch ((categoryCode ?? '').toUpperCase()) {
      case 'VISA':
        return InquiryType.VISA;
      case 'HOTEL':
        return InquiryType.HOTEL;
      case 'TRANSFER':
        return InquiryType.TRANSFER;
      case 'PACKAGE':
      case 'ACTIVITY':
        return InquiryType.TRAVEL_PACKAGE;
      default:
        return InquiryType.CUSTOM;
    }
  }
}
