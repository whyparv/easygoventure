import 'reflect-metadata';
import 'dotenv/config';
import mongoose from 'mongoose';
import { PERMISSION_CATALOG } from '../modules/auth/rbac/permissions';
import { ROLE_DEFINITIONS, SEED_DEPARTMENTS, SystemRole } from '../modules/auth/rbac/system-roles';
import { hashPassword } from '../common/crypto/password.util';
import { Permission, PermissionSchema } from '../modules/permissions/schemas/permission.schema';
import { Role, RoleSchema } from '../modules/roles/schemas/role.schema';
import {
  Organization,
  OrganizationSchema,
} from '../modules/organizations/schemas/organization.schema';
import { Department, DepartmentSchema } from '../modules/departments/schemas/department.schema';
import { User, UserSchema, UserStatus } from '../modules/users/schemas/user.schema';
import {
  ServiceCategory,
  ServiceCategorySchema,
} from '../modules/service-catalog/schemas/service-category.schema';
import { HotelCatalog, HotelCatalogSchema } from '../modules/hotels/schemas/hotel-catalog.schema';
import { HotelCatalogSeeder } from './hotel-catalog/hotel-catalog.seeder';

/**
 * Master catalog seed: `npm run seed:catalog`.
 *
 * Idempotent end-to-end — safe to run repeatedly. Seeds, in order:
 *   1. Permissions (from the permission catalog)
 *   2. Roles (system templates: SUPER_ADMIN, ORGANIZATION_OWNER, business roles…)
 *   3. Service categories (Visa, Hotel, Transfer, Activity, Insurance, Package, Custom)
 *   4. A default organization + a SUPER_ADMIN and an ORGANIZATION_OWNER user
 *   5. Departments (under the default organization)
 *   6. The hotel catalog (from assets/catalog/hotels/dubai.hotels.json)
 */

const SERVICE_CATEGORIES = [
  { code: 'VISA', name: 'Visa', description: 'Tourist, business & transit visas', sortOrder: 1 },
  { code: 'HOTEL', name: 'Hotel', description: 'Hotels, resorts & apartments', sortOrder: 2 },
  { code: 'TRANSFER', name: 'Transfer', description: 'Airport transfers & chauffeur', sortOrder: 3 },
  { code: 'ACTIVITY', name: 'Activity', description: 'Tours, activities & attractions', sortOrder: 4 },
  { code: 'SIGHTSEEING', name: 'Sightseeing', description: 'City tours & sightseeing', sortOrder: 5 },
  { code: 'MEAL', name: 'Meal', description: 'Meal plans (breakfast, half/full board)', sortOrder: 6 },
  { code: 'ACCOMMODATION', name: 'Accommodation', description: 'Room nights & stays', sortOrder: 7 },
  { code: 'INSURANCE', name: 'Insurance', description: 'Travel insurance', sortOrder: 8 },
  { code: 'PACKAGE', name: 'Package', description: 'Holiday packages', sortOrder: 9 },
  { code: 'OTHER', name: 'Other', description: 'Other / custom services', sortOrder: 10 },
  { code: 'CUSTOM', name: 'Custom', description: 'Custom / other services (legacy)', sortOrder: 11 },
];

const env = process.env;
const SEED = {
  orgName: env.SEED_ORG_NAME ?? 'Default DMC',
  orgSlug: env.SEED_ORG_SLUG ?? 'default-dmc',
  superAdminEmail: env.SEED_SUPERADMIN_EMAIL ?? 'superadmin@dmc.local',
  superAdminPassword: env.SEED_SUPERADMIN_PASSWORD ?? 'ChangeMe123!',
  ownerEmail: env.SEED_OWNER_EMAIL ?? 'owner@dmc.local',
  ownerPassword: env.SEED_OWNER_PASSWORD ?? 'ChangeMe123!',
};

 
async function main(): Promise<void> {
  const uri = env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not set');
  await mongoose.connect(uri, { dbName: env.MONGODB_DB_NAME ?? 'dmc_crm' });

  const Permissions = mongoose.model(Permission.name, PermissionSchema);
  const Roles = mongoose.model(Role.name, RoleSchema);
  const Organizations = mongoose.model(Organization.name, OrganizationSchema);
  const Departments = mongoose.model(Department.name, DepartmentSchema);
  const Users = mongoose.model(User.name, UserSchema);
  const ServiceCategories = mongoose.model(ServiceCategory.name, ServiceCategorySchema);
  const Hotels = mongoose.model(HotelCatalog.name, HotelCatalogSchema);

  try {
    // 1. Permissions
    for (const p of PERMISSION_CATALOG) {
      await Permissions.updateOne(
        { key: p.key },
        { $set: { key: p.key, group: p.group, description: p.description, defaultScope: p.defaultScope } },
        { upsert: true },
      );
    }
    console.log(`✓ Permissions: ${PERMISSION_CATALOG.length}`);

    // 2. System roles
    for (const r of ROLE_DEFINITIONS) {
      await Roles.updateOne(
        { organizationId: null, code: r.code },
        {
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
        { upsert: true },
      );
    }
    console.log(`✓ Roles: ${ROLE_DEFINITIONS.length}`);

    // 3. Service categories
    for (const c of SERVICE_CATEGORIES) {
      await ServiceCategories.updateOne({ code: c.code }, { $set: c }, { upsert: true });
    }
    console.log(`✓ Service categories: ${SERVICE_CATEGORIES.length}`);

    // 4. Default organization
    await Organizations.updateOne(
      { slug: SEED.orgSlug },
      {
        $set: { name: SEED.orgName, isActive: true },
        $setOnInsert: {
          slug: SEED.orgSlug,
          timezone: 'Asia/Dubai',
          currency: 'USD',
          subscriptionPlan: 'FREE',
          settings: {},
        },
      },
      { upsert: true },
    );
    const org = await Organizations.findOne({ slug: SEED.orgSlug }).lean<{ _id: mongoose.Types.ObjectId }>();
    if (!org) throw new Error('Failed to bootstrap the default organization');
    console.log(`✓ Organization: ${SEED.orgName} (${SEED.orgSlug})`);

    // 4b. Bootstrap users (passwords only set on first insert)
    const superRole = await Roles.findOne({ organizationId: null, code: SystemRole.SUPER_ADMIN }).lean<{ _id: mongoose.Types.ObjectId }>();
    const ownerRole = await Roles.findOne({ organizationId: null, code: SystemRole.ORGANIZATION_OWNER }).lean<{ _id: mongoose.Types.ObjectId }>();

    await Users.updateOne(
      { email: SEED.superAdminEmail.toLowerCase() },
      {
        $set: {
          organizationId: null,
          firstName: 'Super',
          lastName: 'Admin',
          roleIds: superRole ? [superRole._id] : [],
          status: UserStatus.ACTIVE,
        },
        $setOnInsert: {
          email: SEED.superAdminEmail.toLowerCase(),
          passwordHash: hashPassword(SEED.superAdminPassword),
          directPermissions: [],
        },
      },
      { upsert: true },
    );
    await Users.updateOne(
      { email: SEED.ownerEmail.toLowerCase() },
      {
        $set: {
          organizationId: org._id,
          firstName: 'Org',
          lastName: 'Owner',
          roleIds: ownerRole ? [ownerRole._id] : [],
          status: UserStatus.ACTIVE,
        },
        $setOnInsert: {
          email: SEED.ownerEmail.toLowerCase(),
          passwordHash: hashPassword(SEED.ownerPassword),
          directPermissions: [],
        },
      },
      { upsert: true },
    );
    console.log(`✓ Users: ${SEED.superAdminEmail} (SUPER_ADMIN), ${SEED.ownerEmail} (ORGANIZATION_OWNER)`);

    // 5. Departments (under the default org)
    for (const d of SEED_DEPARTMENTS) {
      await Departments.updateOne(
        { organizationId: org._id, name: d.name },
        { $set: { organizationId: org._id, name: d.name, description: d.description, isActive: true } },
        { upsert: true },
      );
    }
    console.log(`✓ Departments: ${SEED_DEPARTMENTS.length}`);

    // 6. Hotel catalog (from the cleaned dataset)
    const hotelStats = await new HotelCatalogSeeder(Hotels).seed();
    console.log(
      `✓ Hotels: ${hotelStats.total} (${hotelStats.inserted} inserted, ` +
        `${hotelStats.updated} updated, ${hotelStats.unchanged} unchanged)`,
    );

    console.log('\nCatalog seed complete.');
    console.log(
      `\n⚠  Default seed passwords are "${SEED.superAdminPassword}". ` +
        'Change them immediately (env SEED_SUPERADMIN_PASSWORD / SEED_OWNER_PASSWORD or via the API).',
    );
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
 
