import { Injectable, Logger } from '@nestjs/common';
import { FilterQuery, SortOrder, Types } from 'mongoose';
import type { Request } from 'express';
import { PaginatedResponse } from '../../common/dto/paginated-response.dto';
import { tenantFilter } from '../../common/tenant/tenant-scope';
import type { AuthenticatedUser } from '../auth/auth.types';
import { AuditRepository } from './audit.repository';
import { AuditLog, AuditLogDocument } from './schemas/audit-log.schema';
import { QueryAuditDto } from './dto/query-audit.dto';

export interface AuditEntry {
  action: string;
  entity: string;
  entityId?: string;
  organizationId?: string | Types.ObjectId | null;
  userId?: string | Types.ObjectId | null;
  userEmail?: string;
  oldValue?: Record<string, unknown>;
  newValue?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  ip?: string;
  userAgent?: string;
}

/**
 * Central audit trail. `record()` is intentionally fire-and-forget safe: an audit
 * failure is logged but never propagates, so it can never break a business write.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly repo: AuditRepository) {}

  /** Persist an audit record. Swallows errors (audit must not break the caller). */
  async record(entry: AuditEntry): Promise<void> {
    try {
      await this.repo.create({
        action: entry.action,
        entity: entry.entity,
        entityId: entry.entityId,
        organizationId: this.toObjectId(entry.organizationId),
        userId: this.toObjectId(entry.userId),
        userEmail: entry.userEmail,
        oldValue: entry.oldValue,
        newValue: entry.newValue,
        metadata: entry.metadata,
        ip: entry.ip,
        userAgent: entry.userAgent,
      });
    } catch (error) {
      this.logger.error(`Failed to write audit log for "${entry.action}"`, error as Error);
    }
  }

  /** Convenience: record an action performed by an authenticated principal. */
  async recordForActor(
    actor: AuthenticatedUser | undefined,
    req: Request | undefined,
    entry: Omit<AuditEntry, 'userId' | 'userEmail' | 'organizationId' | 'ip' | 'userAgent'> &
      Partial<Pick<AuditEntry, 'organizationId'>>,
  ): Promise<void> {
    await this.record({
      ...entry,
      organizationId: entry.organizationId ?? actor?.organizationId ?? null,
      userId: actor?.id ?? null,
      userEmail: actor?.email,
      ip: this.ipOf(req),
      userAgent: req?.headers['user-agent'],
    });
  }

  async findAll(
    query: QueryAuditDto,
    actor: AuthenticatedUser,
  ): Promise<PaginatedResponse<AuditLogDocument>> {
    // Tenant isolation: super-admins see the platform-wide trail; every other
    // principal is hard-scoped to their organization (and a non-super principal
    // with no organization is rejected — it can never see cross-tenant logs).
    const filter: FilterQuery<AuditLogDocument> = { ...tenantFilter<AuditLogDocument>(actor) };
    if (query.action) filter.action = query.action;
    if (query.entity) filter.entity = query.entity;
    if (query.entityId) filter.entityId = query.entityId;
    if (query.userId && Types.ObjectId.isValid(query.userId)) {
      filter.userId = new Types.ObjectId(query.userId);
    }

    const sort: Record<string, SortOrder> = { [query.sortBy ?? 'createdAt']: query.sortOrder };
    const { items, total } = await this.repo.paginate(filter, {
      skip: query.skip,
      limit: query.limit,
      sort,
    });
    return new PaginatedResponse(items, total, query.page, query.limit);
  }

  private ipOf(req?: Request): string | undefined {
    if (!req) return undefined;
    const fwd = req.headers['x-forwarded-for'];
    if (typeof fwd === 'string' && fwd.length > 0) return fwd.split(',')[0].trim();
    return req.ip;
  }

  private toObjectId(
    value: string | Types.ObjectId | null | undefined,
  ): Types.ObjectId | null {
    if (!value) return null;
    if (value instanceof Types.ObjectId) return value;
    return Types.ObjectId.isValid(value) ? new Types.ObjectId(value) : null;
  }

  /** Exposes the schema name for typed model wiring. */
  static readonly entityName = AuditLog.name;
}
