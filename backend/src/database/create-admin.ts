import 'reflect-metadata';
import 'dotenv/config';
import mongoose from 'mongoose';
import { hashPassword } from '../common/crypto/password.util';
import { Role, RoleSchema } from '../modules/roles/schemas/role.schema';
import { User, UserSchema, UserStatus } from '../modules/users/schemas/user.schema';
import {
  Organization,
  OrganizationSchema,
} from '../modules/organizations/schemas/organization.schema';
import { SystemRole } from '../modules/auth/rbac/system-roles';

/**
 * Create (or update) a platform administrator: `npm run create:admin`.
 *
 * Idempotent — keyed on email. Assigns a seeded system role and (optionally) an
 * organization context. A SUPER_ADMIN with an organization gets both cross-org
 * visibility AND the ability to create org-scoped records.
 *
 *   ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='Str0ng!' \
 *   ADMIN_ROLE=SUPER_ADMIN ADMIN_ORG_SLUG=default-dmc \
 *   ADMIN_FIRST=Sachin ADMIN_LAST=Kumar npm run create:admin
 *
 * Roles must already exist (run `npm run seed:catalog` first).
 */

const env = process.env;

async function main(): Promise<void> {
  const email = (env.ADMIN_EMAIL ?? '').toLowerCase().trim();
  const password = env.ADMIN_PASSWORD ?? '';
  const roleCode = (env.ADMIN_ROLE ?? SystemRole.SUPER_ADMIN) as SystemRole;
  const orgSlug = env.ADMIN_ORG_SLUG ?? 'default-dmc';
  const firstName = env.ADMIN_FIRST ?? 'Admin';
  const lastName = env.ADMIN_LAST ?? 'User';

  if (!email || !password) {
    throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD are required');
  }
  if (password.length < 8) {
    throw new Error('ADMIN_PASSWORD must be at least 8 characters');
  }
  if (!Object.values(SystemRole).includes(roleCode)) {
    throw new Error(`ADMIN_ROLE "${roleCode}" is not a known system role`);
  }

  const uri = env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not set');
  await mongoose.connect(uri, { dbName: env.MONGODB_DB_NAME ?? 'dmc_crm' });

  const Roles = mongoose.model(Role.name, RoleSchema);
  const Users = mongoose.model(User.name, UserSchema);
  const Organizations = mongoose.model(Organization.name, OrganizationSchema);

  try {
    const role = await Roles.findOne({ organizationId: null, code: roleCode }).lean<{
      _id: mongoose.Types.ObjectId;
    }>();
    if (!role) {
      throw new Error(
        `System role "${roleCode}" not found. Run "npm run seed:catalog" first to seed roles.`,
      );
    }

    // Org context: attach even for SUPER_ADMIN so the account can create org-scoped
    // records while still seeing across organizations.
    const org = await Organizations.findOne({ slug: orgSlug }).lean<{
      _id: mongoose.Types.ObjectId;
    }>();
    const organizationId = org?._id ?? null;

    const result = await Users.updateOne(
      { email },
      {
        $set: {
          email,
          organizationId,
          firstName,
          lastName,
          roleIds: [role._id],
          status: UserStatus.ACTIVE,
          passwordHash: hashPassword(password),
          mustChangePassword: false,
          failedLoginAttempts: 0,
        },
        $unset: { lockedUntil: '' },
        $setOnInsert: { directPermissions: [], isDeleted: false },
      },
      { upsert: true },
    );

    const created = result.upsertedCount > 0;
    console.log(`\n✓ Admin ${created ? 'created' : 'updated'}`);
    console.log(`  Email        : ${email}`);
    console.log(`  Password     : ${password}`);
    console.log(`  Role         : ${roleCode}`);
    console.log(`  Organization : ${org ? orgSlug : '(none — platform only)'}`);
    console.log('\nSign in at /login with the email + password above.');
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
