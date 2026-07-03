import { Injectable } from '@nestjs/common';
import { FilterQuery, Types } from 'mongoose';
import { EntityConflictException } from '../../common/exceptions/domain.exception';
import {
  BusinessException,
  NotFoundException,
  ValidationException,
} from '../../common/exceptions/app.exceptions';
import { AuditService } from '../audit/audit.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import { DepartmentsRepository } from './departments.repository';
import { Department, DepartmentDocument } from './schemas/department.schema';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';

@Injectable()
export class DepartmentsService {
  constructor(
    private readonly departments: DepartmentsRepository,
    private readonly audit: AuditService,
  ) {}

  private orgId(user: AuthenticatedUser): Types.ObjectId {
    if (!user.organizationId) {
      throw new BusinessException('An organization context is required', 'ORGANIZATION_REQUIRED');
    }
    return new Types.ObjectId(user.organizationId);
  }

  /** Query-level tenant scope for the caller's organization. */
  private scope(user: AuthenticatedUser): FilterQuery<DepartmentDocument> {
    return { organizationId: this.orgId(user) };
  }

  async create(dto: CreateDepartmentDto, user: AuthenticatedUser): Promise<DepartmentDocument> {
    const organizationId = this.orgId(user);
    if (await this.departments.findByNameInOrg(organizationId, dto.name)) {
      throw new EntityConflictException(`Department "${dto.name}" already exists`);
    }
    const created = await this.departments.create({
      organizationId,
      name: dto.name,
      description: dto.description,
      isActive: dto.isActive ?? true,
    });
    await this.audit.recordForActor(user, undefined, {
      action: 'department.created',
      entity: 'Department',
      entityId: created.id as string,
      newValue: { name: created.name },
    });
    return created;
  }

  findAll(user: AuthenticatedUser): Promise<DepartmentDocument[]> {
    return this.departments.find({ organizationId: this.orgId(user) });
  }

  async findByIdOrThrow(id: string, user: AuthenticatedUser): Promise<DepartmentDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new ValidationException(`"${id}" is not a valid id`, 'INVALID_ID');
    }
    const dept = await this.departments.findByIdScoped(id, this.scope(user));
    if (!dept) throw new NotFoundException(`Department "${id}" not found`, 'DEPARTMENT_NOT_FOUND');
    return dept;
  }

  async update(
    id: string,
    dto: UpdateDepartmentDto,
    user: AuthenticatedUser,
  ): Promise<DepartmentDocument> {
    await this.findByIdOrThrow(id, user);
    const data: Partial<Department> = {
      name: dto.name,
      description: dto.description,
      isActive: dto.isActive,
    };
    const updated = await this.departments.updateScoped(id, data, this.scope(user));
    if (!updated) throw new NotFoundException(`Department "${id}" not found`, 'DEPARTMENT_NOT_FOUND');
    await this.audit.recordForActor(user, undefined, {
      action: 'department.updated',
      entity: 'Department',
      entityId: id,
      newValue: { name: updated.name, isActive: updated.isActive },
    });
    return updated;
  }

  async remove(id: string, user: AuthenticatedUser): Promise<void> {
    await this.findByIdOrThrow(id, user);
    await this.departments.softDeleteScoped(id, this.scope(user));
    await this.audit.recordForActor(user, undefined, {
      action: 'department.deleted',
      entity: 'Department',
      entityId: id,
    });
  }
}
