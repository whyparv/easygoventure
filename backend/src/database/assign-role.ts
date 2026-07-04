import 'reflect-metadata';
import 'dotenv/config';
import mongoose from 'mongoose';
import { Role, RoleSchema } from '../modules/roles/schemas/role.schema';
import { User, UserSchema } from '../modules/users/schemas/user.schema';
import { SystemRole } from '../modules/auth/rbac/system-roles';

/**
 * Grant a system role to an existing user by email: `npm run assign:role`.
 *
 * Non-destructive — it never touches the password or any other field; it only
 * adjusts `roleIds`. Use it to promote an account (e.g. to SUPER_ADMIN so it gains
 * cross-organization visibility) without forcing a password reset.
 *
 *   ROLE_EMAIL=you@example.com ROLE_CODE=SUPER_ADMIN npm run assign:role
 *
 * Env:
 *   ROLE_EMAIL   (required) the user to modify
 *   ROLE_CODE    system role code to grant (default SUPER_ADMIN)
 *   ROLE_MODE    "add" (default — union with existing roles) | "replace"
 *
 * SUPER_ADMIN carries the '*' wildcard, which sets `isSuperAdmin` on the principal
 * and makes tenant-scoped queries cross-organization (see common/tenant/tenant-scope).
 */

const env = process.env;

async function main(): Promise<void> {
  const email = (env.ROLE_EMAIL ?? '').toLowerCase().trim();
  const roleCode = (env.ROLE_CODE ?? SystemRole.SUPER_ADMIN) as SystemRole;
  const mode = (env.ROLE_MODE ?? 'add').toLowerCase();

  if (!email) throw new Error('ROLE_EMAIL is required');
  if (!Object.values(SystemRole).includes(roleCode)) {
    throw new Error(`ROLE_CODE "${roleCode}" is not a known system role`);
  }
  if (mode !== 'add' && mode !== 'replace') {
    throw new Error('ROLE_MODE must be "add" or "replace"');
  }

  const uri = env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not set');
  await mongoose.connect(uri, { dbName: env.MONGODB_DB_NAME ?? 'dmc_crm' });

  const Roles = mongoose.model(Role.name, RoleSchema);
  const Users = mongoose.model(User.name, UserSchema);

  try {
    const role = await Roles.findOne({ organizationId: null, code: roleCode }).lean<{
      _id: mongoose.Types.ObjectId;
    }>();
    if (!role) {
      throw new Error(`System role "${roleCode}" not found. Run "npm run seed:catalog" first.`);
    }

    const user = await Users.findOne({ email }).lean<{
      _id: mongoose.Types.ObjectId;
      roleIds?: mongoose.Types.ObjectId[];
    }>();
    if (!user) throw new Error(`User "${email}" not found`);

    const current = (user.roleIds ?? []).map((id) => id.toString());
    const nextIds =
      mode === 'replace'
        ? [role._id]
        : current.includes(role._id.toString())
          ? user.roleIds ?? []
          : [...(user.roleIds ?? []), role._id];

    await Users.updateOne({ _id: user._id }, { $set: { roleIds: nextIds } });

    const finalRoles = await Roles.find({ _id: { $in: nextIds } }).lean<{ code: string }[]>();
    console.log(`\n✓ Roles updated for ${email}`);
    console.log(`  Mode  : ${mode}`);
    console.log(`  Roles : ${finalRoles.map((r) => r.code).join(', ')}`);
    console.log(
      roleCode === SystemRole.SUPER_ADMIN
        ? '  → Account is now SUPER_ADMIN: cross-organization visibility on the next request (refresh — no re-login needed).'
        : '  → Change takes effect on the next request.',
    );
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
