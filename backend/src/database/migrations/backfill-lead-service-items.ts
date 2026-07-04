import 'reflect-metadata';
import 'dotenv/config';
import mongoose from 'mongoose';
import { Lead, LeadSchema } from '../../modules/leads/schemas/lead.schema';
import { Service, ServiceSchema } from '../../modules/service-catalog/schemas/service.schema';

/**
 * Backfill lead.serviceItems from the legacy `services: string[]`:
 *   `npm run migrate:lead-services`
 *
 * For each lead that still has string services but no serviceItems, this maps the
 * legacy labels to the organization's catalog services (by mapped/exact name),
 * snapshotting cost/sell/supplier. Labels with no catalog match become a name-only
 * snapshot so NO lead data is lost. Idempotent — leads that already have
 * serviceItems are skipped.
 */

// Legacy short labels → canonical catalog service names (Dubai seed).
const LEGACY_TO_CATALOG: Record<string, string> = {
  visa: '96hr UAE Visa',
  'uae visa': '96hr UAE Visa',
  'airport transfer': 'Shared Airport Transfer',
  'private airport transfer': 'Private Airport Transfer',
  'desert safari': 'Desert Safari with Dinner',
  'desert safari with dinner': 'Desert Safari with Dinner',
  'dolphin show': 'Dolphin Show at Dubai Dolphinarium',
  'city tour': 'Dubai City Tour',
  'daily breakfast': 'Daily Breakfast',
  accommodation: 'Accommodation',
};

interface CatalogSvc {
  _id: mongoose.Types.ObjectId;
  name: string;
  categoryCode: string;
  supplier?: string;
  currency?: string;
  costPrice?: number;
  defaultSellPrice?: number;
}

async function main(): Promise<void> {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not set');
  await mongoose.connect(uri, { dbName: process.env.MONGODB_DB_NAME ?? 'dmc_crm' });

  const Leads = mongoose.model(Lead.name, LeadSchema);
  const Services = mongoose.model(Service.name, ServiceSchema);

  try {
    // Leads with legacy services but no snapshots yet.
    const leads = await Leads.find({
      isDeleted: { $ne: true },
      services: { $exists: true, $ne: [] },
      $or: [{ serviceItems: { $exists: false } }, { serviceItems: { $size: 0 } }],
    })
      .select('_id organizationId services')
      .lean<Array<{ _id: mongoose.Types.ObjectId; organizationId: mongoose.Types.ObjectId; services: string[] }>>();

    if (leads.length === 0) {
      console.log('Nothing to backfill — every lead already has serviceItems.');
      return;
    }

    // Per-organization catalog cache (services are tenant-scoped).
    const catalogByOrg = new Map<string, Map<string, CatalogSvc>>();
    const loadCatalog = async (orgId: mongoose.Types.ObjectId): Promise<Map<string, CatalogSvc>> => {
      const key = orgId.toString();
      const cached = catalogByOrg.get(key);
      if (cached) return cached;
      const svcs = await Services.find({ organizationId: orgId, isDeleted: { $ne: true } })
        .select('_id name categoryCode supplier currency costPrice defaultSellPrice')
        .lean<CatalogSvc[]>();
      const map = new Map(svcs.map((s) => [s.name.toLowerCase(), s]));
      catalogByOrg.set(key, map);
      return map;
    };

    let updated = 0;
    let matched = 0;
    let custom = 0;
    const now = new Date();

    for (const lead of leads) {
      const byName = await loadCatalog(lead.organizationId);
      const serviceItems = (lead.services ?? []).map((label) => {
        const canonical = LEGACY_TO_CATALOG[label.trim().toLowerCase()] ?? label;
        const svc = byName.get(canonical.toLowerCase());
        if (svc) {
          matched++;
          return {
            serviceId: String(svc._id),
            serviceName: svc.name,
            categoryCode: svc.categoryCode,
            supplier: svc.supplier,
            currency: svc.currency ?? 'USD',
            costPrice: svc.costPrice,
            sellPrice: svc.defaultSellPrice,
            snapshotDate: now,
          };
        }
        custom++;
        return { serviceName: label, snapshotDate: now };
      });

      await Leads.updateOne(
        { _id: lead._id },
        { $set: { serviceItems, services: serviceItems.map((s) => s.serviceName) } },
      );
      updated++;
    }

    console.log(`Backfilled ${updated} lead(s): ${matched} catalog-matched, ${custom} kept as custom.`);
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
