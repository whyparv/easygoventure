import type { Model } from 'mongoose';
import { Types } from 'mongoose';
import type { UserDocument } from '../../users/schemas/user.schema';
import type { RoleDocument } from '../../roles/schemas/role.schema';
import { SystemRole } from './system-roles';

export interface RepairedUser {
  userId: string;
  email: string;
  organizationId: string;
  roleAssigned: string;
  before: string[];
  after: string[];
  permissionCount: number;
}

export interface ReconcileReport {
  scannedRoleless: number;
  repaired: RepairedUser[];
  skippedOwnedOrg: number;
}

/**
 * Self-heal roleless workspace owners.
 *
 * A user with an `organizationId` but empty `roleIds` is permanently
 * permissionless (0 permissions → 403 everywhere). This reconciles the safe,
 * unambiguous case: an organization that has **no owner at all** — its founder
 * (the earliest-created roleless user) is promoted to ORGANIZATION_OWNER.
 *
 * Deliberately conservative: a roleless user in an org that ALREADY has an owner
 * is left untouched (they are a member awaiting explicit role assignment, not a
 * founder) — so this never silently over-privileges. Fully idempotent: a second
 * run finds no ownerless orgs and repairs nothing.
 */
export async function reconcileRolelessOwners(
  userModel: Model<UserDocument>,
  roleModel: Model<RoleDocument>,
  onRepair?: (repaired: RepairedUser) => Promise<void> | void,
): Promise<ReconcileReport> {
  const ownerRole = await roleModel
    .findOne({ organizationId: null, code: SystemRole.ORGANIZATION_OWNER })
    .lean<{ _id: Types.ObjectId; permissions?: string[] }>();
  if (!ownerRole) {
    throw new Error('ORGANIZATION_OWNER role not found — seed/bootstrap roles before reconciling');
  }
  const ownerRoleId = ownerRole._id;
  const permissionCount = ownerRole.permissions?.length ?? 0;

  // Organizations that already have at least one (non-deleted) owner.
  const ownedOrgIds = new Set(
    (
      await userModel.distinct('organizationId', {
        roleIds: ownerRoleId,
        isDeleted: { $ne: true },
      })
    ).map((id) => String(id)),
  );

  // Roleless users that belong to an organization, oldest first (the founder).
  const candidates = await userModel
    .find({
      organizationId: { $ne: null },
      isDeleted: { $ne: true },
      $or: [{ roleIds: { $size: 0 } }, { roleIds: { $exists: false } }],
    })
    .sort({ createdAt: 1 })
    .lean<Array<{ _id: Types.ObjectId; email: string; organizationId: Types.ObjectId }>>();

  const repaired: RepairedUser[] = [];
  let skippedOwnedOrg = 0;

  for (const user of candidates) {
    const org = String(user.organizationId);
    if (ownedOrgIds.has(org)) {
      skippedOwnedOrg += 1; // org already has an owner — leave this member alone
      continue;
    }
    await userModel.updateOne({ _id: user._id }, { $set: { roleIds: [ownerRoleId] } });
    ownedOrgIds.add(org);

    const record: RepairedUser = {
      userId: String(user._id),
      email: user.email,
      organizationId: org,
      roleAssigned: SystemRole.ORGANIZATION_OWNER,
      before: [],
      after: [String(ownerRoleId)],
      permissionCount,
    };
    repaired.push(record);
    if (onRepair) await onRepair(record);
  }

  return { scannedRoleless: candidates.length, repaired, skippedOwnedOrg };
}
