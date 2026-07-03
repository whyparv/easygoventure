import { Injectable } from '@nestjs/common';
import { PermissionsRepository } from './permissions.repository';
import { PermissionDocument } from './schemas/permission.schema';

export interface PermissionGroupView {
  group: string;
  permissions: Array<{ key: string; description: string; defaultScope: string }>;
}

@Injectable()
export class PermissionsService {
  constructor(private readonly repo: PermissionsRepository) {}

  /** Flat list of the permission catalog. */
  findAll(): Promise<PermissionDocument[]> {
    return this.repo.findAll();
  }

  /** Catalog grouped by resource area — handy for rendering a permission matrix. */
  async findGrouped(): Promise<PermissionGroupView[]> {
    const all = await this.repo.findAll();
    const byGroup = new Map<string, PermissionGroupView>();
    for (const p of all) {
      const view = byGroup.get(p.group) ?? { group: p.group, permissions: [] };
      view.permissions.push({ key: p.key, description: p.description, defaultScope: p.defaultScope });
      byGroup.set(p.group, view);
    }
    return [...byGroup.values()];
  }
}
