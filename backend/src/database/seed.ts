import 'dotenv/config';
import mongoose, { Schema } from 'mongoose';

/**
 * Idempotent baseline seed — RBAC roles only.
 * No demo/business data: this just guarantees the role documents the auth layer expects.
 *
 * Run with: `npm run seed`
 */
const ROLES = [
  { name: 'SUPER_ADMIN', description: 'Full platform access', permissions: ['*'] },
  { name: 'ADMIN', description: 'Tenant administration', permissions: [] as string[] },
  { name: 'MANAGER', description: 'Operations management', permissions: [] as string[] },
  { name: 'AGENT', description: 'Sales / operations agent', permissions: [] as string[] },
];

const roleSchema = new Schema(
  {
    name: { type: String, required: true, unique: true },
    description: String,
    permissions: { type: [String], default: [] },
  },
  { timestamps: true, collection: 'roles' },
);

async function main(): Promise<void> {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not set');

  await mongoose.connect(uri, { dbName: process.env.MONGODB_DB_NAME ?? 'dmc_crm' });
  const Role = mongoose.model('Role', roleSchema);

  for (const role of ROLES) {
    await Role.updateOne({ name: role.name }, { $set: role }, { upsert: true });
  }

   
  console.log(`Seeded ${ROLES.length} roles`);
  await mongoose.disconnect();
}

main().catch((error) => {
   
  console.error(error);
  process.exit(1);
});
