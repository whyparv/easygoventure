import { ForbiddenException, Injectable } from '@nestjs/common';
import { FilterQuery, SortOrder, Types } from 'mongoose';
import { PaginatedResponse } from '../../common/dto/paginated-response.dto';
import { EntityConflictException } from '../../common/exceptions/domain.exception';
import {
  BusinessException,
  NotFoundException,
  ValidationException,
} from '../../common/exceptions/app.exceptions';
import { hashPassword } from '../../common/crypto/password.util';
import { tenantFilter } from '../../common/tenant/tenant-scope';
import { AuditService } from '../audit/audit.service';
import { RolesService } from '../roles/roles.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import { UsersRepository } from './users.repository';
import { User, UserDocument, UserStatus } from './schemas/user.schema';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { QueryUserDto } from './dto/query-user.dto';
import { AssignRolesDto } from './dto/assign-roles.dto';

export interface CreateUserInput {
  organizationId: string | null;
  departmentId?: string | null;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  roleIds?: string[];
  directPermissions?: string[];
  status?: UserStatus;
  mustChangePassword?: boolean;
}

@Injectable()
export class UsersService {
  constructor(
    private readonly users: UsersRepository,
    private readonly roles: RolesService,
    private readonly audit: AuditService,
  ) {}

  // ── Authentication support ─────────────────────────────────────────────

  findByEmailWithSecrets(email: string): Promise<UserDocument | null> {
    return this.users.findByEmailWithSecrets(email);
  }

  /**
   * Build the request principal (resolved roles + effective permissions) for a
   * user. Called by the JWT strategy on every request, so role/permission
   * changes and deactivations take effect immediately.
   */
  async buildPrincipal(user: UserDocument): Promise<AuthenticatedUser> {
    const authority = await this.roles.resolveAuthority(user.roleIds);
    const permissions = authority.isSuperAdmin
      ? authority.permissions
      : [...new Set([...authority.permissions, ...user.directPermissions])];
    return {
      id: user.id as string,
      email: user.email,
      organizationId: user.organizationId ? user.organizationId.toString() : null,
      departmentId: user.departmentId ? user.departmentId.toString() : null,
      roles: authority.roleCodes,
      permissions,
      isSuperAdmin: authority.isSuperAdmin,
    };
  }

  /** The authenticated user's own profile document (for /auth/me). */
  getProfile(id: string): Promise<UserDocument | null> {
    return this.users.findById(id);
  }

  /** Resolve a principal by id, or null if the account is gone/inactive. */
  async getAuthenticatedUserById(id: string): Promise<AuthenticatedUser | null> {
    if (!Types.ObjectId.isValid(id)) return null;
    const user = await this.users.findById(id);
    if (!user || user.status !== UserStatus.ACTIVE) return null;
    return this.buildPrincipal(user);
  }

  registerSuccessfulLogin(id: string): Promise<UserDocument | null> {
    // Identity write for the authenticating user (no tenant dimension).
    return this.users.updateScoped(id, {
      $set: { lastLoginAt: new Date(), failedLoginAttempts: 0, lockedUntil: null },
    });
  }

  /** Increment failed logins; lock the account when the threshold is reached. */
  async registerFailedLogin(
    user: UserDocument,
    maxAttempts: number,
    lockMs: number,
  ): Promise<{ locked: boolean }> {
    const attempts = (user.failedLoginAttempts ?? 0) + 1;
    const shouldLock = attempts >= maxAttempts;
    await this.users.updateScoped(user.id as string, {
      $set: {
        failedLoginAttempts: attempts,
        lockedUntil: shouldLock ? new Date(Date.now() + lockMs) : user.lockedUntil ?? null,
      },
    });
    return { locked: shouldLock };
  }

  setPassword(id: string, passwordHash: string): Promise<UserDocument | null> {
    // Identity write for a token-verified / self user (no tenant dimension).
    return this.users.updateScoped(id, {
      $set: { passwordHash, mustChangePassword: false, failedLoginAttempts: 0, lockedUntil: null },
    });
  }

  // ── CRUD / administration ──────────────────────────────────────────────

  async createUser(input: CreateUserInput, actor?: AuthenticatedUser): Promise<UserDocument> {
    const existing = await this.users.findByEmail(input.email);
    if (existing) throw new EntityConflictException(`Email "${input.email}" is already in use`);

    const roleIds = this.toObjectIds(input.roleIds);
    const created = await this.users.create({
      organizationId: input.organizationId ? new Types.ObjectId(input.organizationId) : null,
      departmentId: input.departmentId ? new Types.ObjectId(input.departmentId) : null,
      email: input.email.toLowerCase(),
      passwordHash: hashPassword(input.password),
      firstName: input.firstName,
      lastName: input.lastName,
      phone: input.phone,
      roleIds,
      directPermissions: input.directPermissions ?? [],
      status: input.status ?? UserStatus.ACTIVE,
      mustChangePassword: input.mustChangePassword ?? false,
    });

    if (actor) {
      await this.audit.recordForActor(actor, undefined, {
        action: 'user.created',
        entity: 'User',
        entityId: created.id as string,
        newValue: { email: created.email, roleIds: input.roleIds ?? [] },
      });
    }
    return created;
  }

  async create(dto: CreateUserDto, actor: AuthenticatedUser): Promise<UserDocument> {
    // Org admins create users inside their own org; only super-admins may target
    // another organization explicitly.
    const organizationId =
      actor.isSuperAdmin && dto.organizationId ? dto.organizationId : actor.organizationId;
    if (!organizationId) {
      throw new BusinessException('An organization context is required', 'ORGANIZATION_REQUIRED');
    }
    if (dto.roleIds?.length) await this.assertRolesVisible(dto.roleIds, actor);

    return this.createUser(
      {
        organizationId,
        departmentId: dto.departmentId,
        email: dto.email,
        password: dto.password,
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
        roleIds: dto.roleIds,
        status: dto.status,
        mustChangePassword: dto.mustChangePassword,
      },
      actor,
    );
  }

  async findAll(query: QueryUserDto, actor: AuthenticatedUser): Promise<PaginatedResponse<UserDocument>> {
    // super-admin → cross-org; everyone else → hard-scoped to their organization.
    const scope = tenantFilter<UserDocument>(actor);
    const filter: FilterQuery<UserDocument> = {};
    if (query.status) filter.status = query.status;
    if (query.departmentId && Types.ObjectId.isValid(query.departmentId)) {
      filter.departmentId = new Types.ObjectId(query.departmentId);
    }
    if (query.search) {
      filter.$or = [
        { email: { $regex: query.search, $options: 'i' } },
        { firstName: { $regex: query.search, $options: 'i' } },
        { lastName: { $regex: query.search, $options: 'i' } },
      ];
    }

    const sort: Record<string, SortOrder> = { [query.sortBy ?? 'createdAt']: query.sortOrder };
    const { items, total } = await this.users.paginateScoped(scope, filter, {
      skip: query.skip,
      limit: query.limit,
      sort,
    });
    return new PaginatedResponse(items, total, query.page, query.limit);
  }

  async findByIdOrThrow(id: string, actor: AuthenticatedUser): Promise<UserDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new ValidationException(`"${id}" is not a valid id`, 'INVALID_ID');
    }
    // Tenant isolation enforced in the query: a user outside the actor's scope is
    // never fetched (super-admin sees all; everyone else only their own org).
    const user = await this.users.findByIdScoped(id, tenantFilter<UserDocument>(actor));
    if (!user) {
      throw new NotFoundException(`User "${id}" not found`, 'USER_NOT_FOUND');
    }
    return user;
  }

  async update(id: string, dto: UpdateUserDto, actor: AuthenticatedUser): Promise<UserDocument> {
    await this.findByIdOrThrow(id, actor);
    const data: Partial<User> = {
      firstName: dto.firstName,
      lastName: dto.lastName,
      phone: dto.phone,
      status: dto.status,
    };
    if (dto.departmentId !== undefined) {
      data.departmentId = dto.departmentId ? new Types.ObjectId(dto.departmentId) : null;
    }
    const updated = await this.users.updateScoped(id, { $set: data }, tenantFilter<UserDocument>(actor));
    if (!updated) throw new NotFoundException(`User "${id}" not found`, 'USER_NOT_FOUND');
    await this.audit.recordForActor(actor, undefined, {
      action: 'user.updated',
      entity: 'User',
      entityId: id,
      newValue: { status: updated.status },
    });
    return updated;
  }

  async assignRoles(id: string, dto: AssignRolesDto, actor: AuthenticatedUser): Promise<UserDocument> {
    const user = await this.findByIdOrThrow(id, actor);
    await this.assertRolesVisible(dto.roleIds, actor);
    const updated = await this.users.updateScoped(
      id,
      { $set: { roleIds: this.toObjectIds(dto.roleIds) } },
      tenantFilter<UserDocument>(actor),
    );
    if (!updated) throw new NotFoundException(`User "${id}" not found`, 'USER_NOT_FOUND');
    await this.audit.recordForActor(actor, undefined, {
      action: 'role.assign',
      entity: 'User',
      entityId: id,
      oldValue: { roleIds: user.roleIds.map((r) => r.toString()) },
      newValue: { roleIds: dto.roleIds },
    });
    return updated;
  }

  async remove(id: string, actor: AuthenticatedUser): Promise<void> {
    if (id === actor.id) {
      throw new BusinessException('You cannot delete your own account', 'CANNOT_DELETE_SELF');
    }
    await this.findByIdOrThrow(id, actor);
    await this.users.softDeleteScoped(id, tenantFilter<UserDocument>(actor));
    await this.audit.recordForActor(actor, undefined, {
      action: 'user.deleted',
      entity: 'User',
      entityId: id,
    });
  }

  // ── Helpers ────────────────────────────────────────────────────────────

  private async assertRolesVisible(roleIds: string[], actor: AuthenticatedUser): Promise<void> {
    for (const roleId of roleIds) {
      // Throws NotFound if a role is not a system template or in the actor's org.
      await this.roles.findByIdOrThrow(roleId, actor);
    }
    if (!actor.isSuperAdmin) {
      // Prevent privilege escalation: a non-super actor cannot grant a role that
      // carries the platform wildcard (defensive — sanitized at role creation).
      const authority = await this.roles.resolveAuthority(this.toObjectIds(roleIds));
      if (authority.isSuperAdmin) {
        throw new ForbiddenException('You cannot assign a super-admin role');
      }
    }
  }

  private toObjectIds(ids: string[] | undefined): Types.ObjectId[] {
    return (ids ?? []).filter((id) => Types.ObjectId.isValid(id)).map((id) => new Types.ObjectId(id));
  }
}
