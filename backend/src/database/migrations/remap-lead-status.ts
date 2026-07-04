import 'reflect-metadata';
import 'dotenv/config';
import mongoose from 'mongoose';
import { Lead, LeadSchema } from '../../modules/leads/schemas/lead.schema';

/**
 * EasyGo pipeline migration: `npm run migrate:lead-status`.
 *
 * The lead pipeline was refocused onto the EasyGo travel-inquiry workflow, which
 * renamed several statuses. This remaps existing lead documents from the old
 * enum to the new one:
 *
 *   PROPOSAL_SENT     → QUOTE_SENT
 *   AWAITING_RESPONSE → FOLLOW_UP
 *   ACCEPTED          → CONFIRMED
 *
 * NEW / FOLLOW_UP / REJECTED / COMPLETED are unchanged. The two brand-new stages
 * (ARRANGEMENTS, VOUCHER_SENT) have no legacy equivalent, so nothing maps to them.
 *
 * Idempotent: only documents still holding an old value are touched.
 */

const STATUS_MAP: Record<string, string> = {
  PROPOSAL_SENT: 'QUOTE_SENT',
  AWAITING_RESPONSE: 'FOLLOW_UP',
  ACCEPTED: 'CONFIRMED',
};

async function main(): Promise<void> {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not set');
  await mongoose.connect(uri, { dbName: process.env.MONGODB_DB_NAME ?? 'dmc_crm' });

  const Leads = mongoose.model(Lead.name, LeadSchema);

  try {
    console.log('Remapping legacy lead statuses...');
    let total = 0;
    for (const [oldStatus, newStatus] of Object.entries(STATUS_MAP)) {
      const res = await Leads.updateMany(
        { status: oldStatus },
        { $set: { status: newStatus } },
      );
      if (res.modifiedCount > 0) {
        console.log(`  ${oldStatus} → ${newStatus}: ${res.modifiedCount}`);
      }
      total += res.modifiedCount;
    }
    console.log(total === 0 ? 'Nothing to remap (already migrated).' : `\nRemapped ${total} lead(s).`);
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
