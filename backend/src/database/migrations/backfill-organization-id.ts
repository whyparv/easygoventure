import 'reflect-metadata';
import 'dotenv/config';
import mongoose, { Model } from 'mongoose';
import { Organization, OrganizationSchema } from '../../modules/organizations/schemas/organization.schema';
import { Lead, LeadSchema } from '../../modules/leads/schemas/lead.schema';
import { LeadActivity, LeadActivitySchema } from '../../modules/leads/schemas/lead-activity.schema';
import { Proposal, ProposalSchema } from '../../modules/proposals/schemas/proposal.schema';
import { FollowUp, FollowUpSchema } from '../../modules/followups/schemas/followup.schema';
import { Fulfillment, FulfillmentSchema } from '../../modules/fulfillments/schemas/fulfillment.schema';

/**
 * Phase 1.5 tenant-isolation migration: `npm run migrate:tenant`.
 *
 * 1. Backfills `organizationId` on every legacy record that predates the field
 *    (Lead, LeadActivity, Proposal, FollowUp, Fulfillment) → the target org.
 * 2. Builds the new tenant indexes.
 *
 * Idempotent: only documents WITHOUT an `organizationId` are touched, so re-runs
 * are no-ops. The target org is resolved from BACKFILL_ORG_ID, else the
 * SEED_ORG_SLUG org, else the single existing org (erroring if ambiguous).
 */

const env = process.env;

 
async function resolveTargetOrgId(
  Orgs: Model<mongoose.Document & { slug: string }>,
): Promise<mongoose.Types.ObjectId> {
  if (env.BACKFILL_ORG_ID && mongoose.Types.ObjectId.isValid(env.BACKFILL_ORG_ID)) {
    return new mongoose.Types.ObjectId(env.BACKFILL_ORG_ID);
  }
  const slug = env.SEED_ORG_SLUG ?? 'default-dmc';
  const bySlug = await Orgs.findOne({ slug }).lean<{ _id: mongoose.Types.ObjectId }>();
  if (bySlug) return bySlug._id;

  const all = await Orgs.find().limit(2).lean<{ _id: mongoose.Types.ObjectId }[]>();
  if (all.length === 1) return all[0]._id;
  throw new Error(
    'Could not resolve a target organization. Set BACKFILL_ORG_ID or run "npm run seed:catalog" first.',
  );
}

async function backfill(
  label: string,
  model: Model<mongoose.Document>,
  orgId: mongoose.Types.ObjectId,
): Promise<void> {
  const filter = { $or: [{ organizationId: { $exists: false } }, { organizationId: null }] };
  const missing = await model.countDocuments(filter);
  if (missing > 0) {
    const res = await model.updateMany(filter, { $set: { organizationId: orgId } });
    console.log(`  ${label}: backfilled ${res.modifiedCount}/${missing}`);
  } else {
    console.log(`  ${label}: nothing to backfill (already tenant-scoped)`);
  }
  await model.createIndexes();
}

async function main(): Promise<void> {
  const uri = env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not set');
  await mongoose.connect(uri, { dbName: env.MONGODB_DB_NAME ?? 'dmc_crm' });

  const Orgs = mongoose.model(Organization.name, OrganizationSchema);
  const Leads = mongoose.model(Lead.name, LeadSchema);
  const Activities = mongoose.model(LeadActivity.name, LeadActivitySchema);
  const Proposals = mongoose.model(Proposal.name, ProposalSchema);
  const FollowUps = mongoose.model(FollowUp.name, FollowUpSchema);
  const Fulfillments = mongoose.model(Fulfillment.name, FulfillmentSchema);

  try {
    const orgId = await resolveTargetOrgId(Orgs as unknown as Model<mongoose.Document & { slug: string }>);
    console.log(`Target organization: ${orgId.toString()}`);
    console.log('Backfilling organizationId + building indexes...');

    await backfill('leads', Leads as unknown as Model<mongoose.Document>, orgId);
    await backfill('lead_activities', Activities as unknown as Model<mongoose.Document>, orgId);
    await backfill('proposals', Proposals as unknown as Model<mongoose.Document>, orgId);
    await backfill('followups', FollowUps as unknown as Model<mongoose.Document>, orgId);
    await backfill('fulfillments', Fulfillments as unknown as Model<mongoose.Document>, orgId);

    console.log('\nTenant backfill complete.');
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
 
