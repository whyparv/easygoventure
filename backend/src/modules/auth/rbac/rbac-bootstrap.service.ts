import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Permission, PermissionDocument } from '../../permissions/schemas/permission.schema';
import { Role, RoleDocument } from '../../roles/schemas/role.schema';
import { User, UserDocument } from '../../users/schemas/user.schema';
import { AuditService } from '../../audit/audit.service';
import { PERMISSION_CATALOG } from './permissions';
import { ROLE_DEFINITIONS } from './system-roles';
import { reconcileRolelessOwners } from './rbac-reconcile';

/**
 * RbacBootstrapService
 * --------------------
 * Idempotently ensures the permission catalog and system-role templates exist in
 * the database on every boot. This guarantees that a brand-new / never-seeded
 * database is immediately usable: a self-service signup can assign the
 * ORGANIZATION_OWNER role and the new owner receives the full permission set —
 * no manual `npm run seed:catalog` required.
 *
 * Only shared system data (permissions + `organizationId: null` role templates)
 * is touched; organization data is never modified. Disable with RBAC_AUTOSEED=false.
 */
@Injectable()
export class RbacBootstrapService implements OnApplicationBootstrap {
  private readonly logger = new Logger(RbacBootstrapService.name);

  constructor(
    @InjectModel(Permission.name) private readonly permissions: Model<PermissionDocument>,
    @InjectModel(Role.name) private readonly roles: Model<RoleDocument>,
    @InjectModel(User.name) private readonly users: Model<UserDocument>,
    private readonly audit: AuditService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    if (process.env.RBAC_AUTOSEED === 'false') {
      this.logger.log('RBAC auto-seed disabled (RBAC_AUTOSEED=false)');
      return;
    }
    try {
      await this.permissions.bulkWrite(
        PERMISSION_CATALOG.map((p) => ({
          updateOne: {
            filter: { key: p.key },
            update: {
              $set: {
                key: p.key,
                group: p.group,
                description: p.description,
                defaultScope: p.defaultScope,
              },
            },
            upsert: true,
          },
        })),
        { ordered: false },
      );

      await this.roles.bulkWrite(
        ROLE_DEFINITIONS.map((r) => ({
          updateOne: {
            filter: { organizationId: null, code: r.code },
            update: {
              $set: {
                organizationId: null,
                code: r.code,
                name: r.name,
                description: r.description,
                permissions: r.permissions,
                isSystem: r.isSystem,
                isActive: true,
              },
            },
            upsert: true,
          },
        })),
        { ordered: false },
      );

      this.logger.log(
        `RBAC ready: ${PERMISSION_CATALOG.length} permissions, ${ROLE_DEFINITIONS.length} system roles ensured.`,
      );
    } catch (error) {
      // Never block boot on this — but make the failure loud (signup would 403 without it).
      this.logger.error(
        `RBAC auto-seed failed — new signups may lack permissions until seeded: ${
          (error as Error).message
        }`,
      );
      return;
    }

    // Self-heal: repair any pre-existing roleless workspace owners (the users
    // created before roles existed). Runs after seeding so the owner role exists.
    if (process.env.RBAC_SELFHEAL === 'false') {
      this.logger.log('RBAC self-heal disabled (RBAC_SELFHEAL=false)');
      return;
    }
    try {
      const report = await reconcileRolelessOwners(this.users, this.roles, (r) =>
        this.audit.record({
          action: 'user.role_repaired',
          entity: 'User',
          entityId: r.userId,
          organizationId: r.organizationId,
          userEmail: r.email,
          newValue: { roleAssigned: r.roleAssigned, permissionCount: r.permissionCount },
          metadata: { source: 'rbac-selfheal', before: r.before, after: r.after },
        }),
      );
      if (report.repaired.length > 0) {
        this.logger.warn(
          `RBAC self-heal: promoted ${report.repaired.length} roleless owner(s) to ORGANIZATION_OWNER ` +
            `(${report.skippedOwnedOrg} member(s) left for manual assignment).`,
        );
      } else {
        this.logger.log(
          `RBAC self-heal: no roleless owners to repair (${report.skippedOwnedOrg} member(s) skipped).`,
        );
      }
    } catch (error) {
      this.logger.error(`RBAC self-heal failed: ${(error as Error).message}`);
    }
  }
}
