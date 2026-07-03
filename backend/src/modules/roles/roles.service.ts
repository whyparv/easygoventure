import { Injectable } from '@nestjs/common';
import { Types } from 'mongoose';
import {
  BusinessException,
  NotFoundException,
  ValidationException,
} from '../../common/exceptions/app.exceptions';
import { tenantFilter } from '../../common/tenant/tenant-scope';
import { WILDCARD_PERMISSION } from '../auth/rbac/permissions';
import type { AuthenticatedUser } from '../auth/auth.types';
import { RolesRepository } from './roles.repository';
import { Role, RoleDocument } from './schemas/role.schema';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';

export interface ResolvedAuthority {
  roleCodes: string[];
  permissions: string[];
  isSuperAdmin: boolean;
}

@Injectable()
export class RolesService {
  constructor(private readonly roles: RolesRepository) {}

  /** System templates + the caller's own organization roles. */
  findAllForActor(user: AuthenticatedUser): Promise<RoleDocument[]> {
    const orgId = user.organizationId ? new Types.ObjectId(user.organizationId) : null;
    return this.roles.find({
      $or: [{ isSystem: true }, ...(orgId ? [{ organizationId: orgId }] : [])],
    });
  }

  async findByIdOrThrow(id: string, user: AuthenticatedUser): Promise<RoleDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new ValidationException(`"${id}" is not a valid id`, 'INVALID_ID');
    }
    const role = await this.roles.findById(id);
    if (!role || !this.isVisibleTo(role, user)) {
      throw new NotFoundException(`Role "${id}" not found`, 'ROLE_NOT_FOUND');
    }
    return role;
  }

  async create(dto: CreateRoleDto, user: AuthenticatedUser): Promise<RoleDocument> {
    if (!user.organizationId) {
      throw new BusinessException('An organization context is required', 'ORGANIZATION_REQUIRED');
    }
    const data: Partial<Role> = {
      organizationId: new Types.ObjectId(user.organizationId),
      code: dto.code.toUpperCase(),
      name: dto.name,
      description: dto.description,
      permissions: this.sanitizePermissions(dto.permissions),
      isSystem: false,
      isActive: true,
    };
    return this.roles.create(data);
  }

  async update(id: string, dto: UpdateRoleDto, user: AuthenticatedUser): Promise<RoleDocument> {
    const role = await this.findByIdOrThrow(id, user);
    if (role.isSystem) {
      throw new BusinessException('System roles cannot be modified', 'SYSTEM_ROLE_LOCKED');
    }
    const data: Partial<Role> = {
      name: dto.name,
      description: dto.description,
      isActive: dto.isActive,
    };
    if (dto.permissions) data.permissions = this.sanitizePermissions(dto.permissions);

    // Scoped write: a non-super actor can only ever hit a role in their own org
    // (a system role has organizationId null and never matches the scope).
    const updated = await this.roles.updateScoped(id, data, tenantFilter<RoleDocument>(user));
    if (!updated) throw new NotFoundException(`Role "${id}" not found`, 'ROLE_NOT_FOUND');
    return updated;
  }

  async remove(id: string, user: AuthenticatedUser): Promise<void> {
    const role = await this.findByIdOrThrow(id, user);
    if (role.isSystem) {
      throw new BusinessException('System roles cannot be deleted', 'SYSTEM_ROLE_LOCKED');
    }
    await this.roles.softDeleteScoped(id, tenantFilter<RoleDocument>(user));
  }

  /**
   * Resolve the effective authority for a set of role ids — the union of their
   * permissions. Used by the auth layer to build `request.user.permissions`.
   */
  async resolveAuthority(roleIds: Types.ObjectId[]): Promise<ResolvedAuthority> {
    if (roleIds.length === 0) return { roleCodes: [], permissions: [], isSuperAdmin: false };
    const roles = await this.roles.findByIds(roleIds);

    const permissions = new Set<string>();
    const roleCodes: string[] = [];
    for (const role of roles) {
      if (!role.isActive) continue;
      roleCodes.push(role.code);
      for (const p of role.permissions) permissions.add(p);
    }
    const isSuperAdmin = permissions.has(WILDCARD_PERMISSION);
    return {
      roleCodes,
      permissions: isSuperAdmin ? [WILDCARD_PERMISSION] : [...permissions],
      isSuperAdmin,
    };
  }

  private isVisibleTo(role: RoleDocument, user: AuthenticatedUser): boolean {
    if (user.isSuperAdmin || role.isSystem) return true;
    return (
      !!user.organizationId &&
      !!role.organizationId &&
      role.organizationId.toString() === user.organizationId
    );
  }

  private sanitizePermissions(permissions: string[] | undefined): string[] {
    // A non-super role may never grant the wildcard.
    return [...new Set(permissions ?? [])].filter((p) => p !== WILDCARD_PERMISSION);
  }
}
