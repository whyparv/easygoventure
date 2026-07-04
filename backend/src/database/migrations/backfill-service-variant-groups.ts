import 'reflect-metadata';
import 'dotenv/config';
import mongoose from 'mongoose';
import { Service, ServiceSchema } from '../../modules/service-catalog/schemas/service.schema';

/**
 * Backfill Service.variantGroup for existing catalog services:
 *   `npm run migrate:service-variant-groups`
 *
 * Groups obvious variants under a generic requirement label so a generic inquiry
 * requirement (e.g. "Airport Transfer") resolves to its variants. Inference:
 *   VISA                                   → "UAE Visa"
 *   TRANSFER + name ~ "airport transfer"   → "Airport Transfer"
 *   MEAL                                   → "Meal Plan"
 *
 * Idempotent — only services WITHOUT a variantGroup are touched; nothing else is
 * changed, and standalone services (activities, sightseeing, etc.) are left alone.
 */

interface Rule {
  filter: Record<string, unknown>;
  group: string;
}

const RULES: Rule[] = [
  { filter: { categoryCode: 'VISA' }, group: 'UAE Visa' },
  { filter: { categoryCode: 'TRANSFER', name: { $regex: 'airport transfer', $options: 'i' } }, group: 'Airport Transfer' },
  { filter: { categoryCode: 'MEAL' }, group: 'Meal Plan' },
];

async function main(): Promise<void> {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not set');
  await mongoose.connect(uri, { dbName: process.env.MONGODB_DB_NAME ?? 'dmc_crm' });

  const Services = mongoose.model(Service.name, ServiceSchema);

  try {
    let total = 0;
    for (const rule of RULES) {
      const res = await Services.updateMany(
        {
          ...rule.filter,
          isDeleted: { $ne: true },
          $or: [{ variantGroup: { $exists: false } }, { variantGroup: null }, { variantGroup: '' }],
        },
        { $set: { variantGroup: rule.group } },
      );
      if (res.modifiedCount > 0) console.log(`  → "${rule.group}": ${res.modifiedCount}`);
      total += res.modifiedCount;
    }
    console.log(total === 0 ? 'Nothing to backfill (already grouped).' : `\nGrouped ${total} service(s).`);
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
