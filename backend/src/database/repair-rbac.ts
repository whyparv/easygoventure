import 'reflect-metadata';
import 'dotenv/config';
import mongoose from 'mongoose';
import { Role, RoleSchema, type RoleDocument } from '../modules/roles/schemas/role.schema';
import { User, UserSchema, type UserDocument } from '../modules/users/schemas/user.schema';
import { reconcileRolelessOwners } from '../modules/auth/rbac/rbac-reconcile';

/**
 * Repair roleless workspace owners: `npm run repair:rbac`.
 *
 * Finds users with `organizationId` set but empty `roleIds` and, for any
 * organization that has no owner, promotes the founder to ORGANIZATION_OWNER.
 * Idempotent and safe — see reconcileRolelessOwners for the exact rule.
 * Requires roles to be seeded (run `npm run seed:catalog` or just boot the app).
 */
async function main(): Promise<void> {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not set');
  await mongoose.connect(uri, { dbName: process.env.MONGODB_DB_NAME ?? 'dmc_crm' });

  const Users = mongoose.model(User.name, UserSchema) as unknown as mongoose.Model<UserDocument>;
  const Roles = mongoose.model(Role.name, RoleSchema) as unknown as mongoose.Model<RoleDocument>;

  try {
    const before = await Users.countDocuments({
      organizationId: { $ne: null },
      isDeleted: { $ne: true },
      $or: [{ roleIds: { $size: 0 } }, { roleIds: { $exists: false } }],
    });
    console.log(`\nBEFORE: ${before} roleless user(s) with an organization.\n`);

    const report = await reconcileRolelessOwners(Users, Roles);

    if (report.repaired.length === 0) {
      console.log('Nothing to repair — every organization already has an owner.');
    } else {
      for (const r of report.repaired) {
        console.log(`Repaired ${r.email}`);
        console.log(`  organization : ${r.organizationId}`);
        console.log(`  roleIds      : [] -> [${r.after.join(', ')}]`);
        console.log(`  role assigned: ${r.roleAssigned}`);
        console.log(`  permissions  : ${r.permissionCount}\n`);
      }
    }

    console.log('SUMMARY');
    console.log(`  scanned roleless : ${report.scannedRoleless}`);
    console.log(`  repaired (owners): ${report.repaired.length}`);
    console.log(`  skipped (member of an already-owned org): ${report.skippedOwnedOrg}`);

    const after = await Users.countDocuments({
      organizationId: { $ne: null },
      isDeleted: { $ne: true },
      $or: [{ roleIds: { $size: 0 } }, { roleIds: { $exists: false } }],
    });
    console.log(`\nAFTER: ${after} roleless user(s) remaining (members awaiting explicit role assignment).`);
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
