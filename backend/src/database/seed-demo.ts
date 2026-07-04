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
import { Lead, LeadSchema } from '../modules/leads/schemas/lead.schema';
import {
  LeadActivity,
  LeadActivitySchema,
  LeadActivityType,
} from '../modules/leads/schemas/lead-activity.schema';
import { Service, ServiceSchema } from '../modules/service-catalog/schemas/service.schema';
import {
  ServiceCategory,
  ServiceCategorySchema,
} from '../modules/service-catalog/schemas/service-category.schema';
import { SystemRole } from '../modules/auth/rbac/system-roles';

/**
 * Demo seed for the EasyGo Venture client demo: `npm run seed:demo`.
 *
 * Creates (idempotently) a production-shaped demo:
 *   1. Organization  "EasyGo Venture (Demo)"
 *   2. Staff user     John Doe  (SALES_EXECUTIVE — the enquiry-handling staff role),
 *      created the same way production users are (hashed password, seeded role,
 *      ACTIVE status) so it can log in immediately and "Prepared By" resolves to "John".
 *   3. Five realistic travel-agency leads with the full working brief
 *      (requirements note, requested vs selected services/hotels, quote values),
 *      each attached to the demo org and given a created-timeline entry.
 *
 * Idempotent: org + user are upserted by slug/email; existing demo leads are
 * soft-deleted and re-created so re-runs give a clean, consistent dataset.
 *
 * Roles must exist first — run `npm run seed:catalog`. Hotels: `npm run seed:hotels`.
 */

const env = process.env;

const DEMO = {
  orgName: 'EasyGo Venture (Demo)',
  orgSlug: env.DEMO_ORG_SLUG ?? 'easygo-venture-demo',
  email: (env.DEMO_EMAIL ?? 'client.travelenquiries@gmail.com').toLowerCase().trim(),
  password: env.DEMO_PASSWORD ?? 'EasyGo@2026',
  firstName: 'John',
  lastName: 'Doe',
  role: SystemRole.SALES_EXECUTIVE,
};

/** Global service categories (mirrors seed-catalog; upserted here so seed:demo is self-contained). */
const SERVICE_CATEGORIES = [
  { code: 'VISA', name: 'Visa', description: 'Tourist, business & transit visas', sortOrder: 1 },
  { code: 'TRANSFER', name: 'Transfer', description: 'Airport transfers & chauffeur', sortOrder: 3 },
  { code: 'ACTIVITY', name: 'Activity', description: 'Tours, activities & attractions', sortOrder: 4 },
  { code: 'SIGHTSEEING', name: 'Sightseeing', description: 'City tours & sightseeing', sortOrder: 5 },
  { code: 'MEAL', name: 'Meal', description: 'Meal plans (breakfast, half/full board)', sortOrder: 6 },
  { code: 'ACCOMMODATION', name: 'Accommodation', description: 'Room nights & stays', sortOrder: 7 },
  { code: 'INSURANCE', name: 'Insurance', description: 'Travel insurance', sortOrder: 8 },
  { code: 'OTHER', name: 'Other', description: 'Other / custom services', sortOrder: 10 },
];

interface SeedService {
  categoryCode: string;
  name: string;
  code: string;
  serviceType?: string;
  supplier?: string;
  costPrice: number;
  defaultSellPrice: number;
}

/** Realistic Dubai service catalog (currency USD, destination Dubai). */
const DUBAI_SERVICES: SeedService[] = [
  // Visa
  { categoryCode: 'VISA', name: '96hr UAE Visa', code: 'DXB-VISA-96H', serviceType: 'Tourist Visa', supplier: 'VFS Global', costPrice: 75, defaultSellPrice: 110 },
  { categoryCode: 'VISA', name: '14 Day UAE Visa', code: 'DXB-VISA-14D', serviceType: 'Tourist Visa', supplier: 'VFS Global', costPrice: 90, defaultSellPrice: 130 },
  { categoryCode: 'VISA', name: '30 Day UAE Visa', code: 'DXB-VISA-30D', serviceType: 'Tourist Visa', supplier: 'VFS Global', costPrice: 105, defaultSellPrice: 150 },
  { categoryCode: 'VISA', name: '60 Day UAE Visa', code: 'DXB-VISA-60D', serviceType: 'Tourist Visa', supplier: 'VFS Global', costPrice: 180, defaultSellPrice: 240 },
  { categoryCode: 'VISA', name: 'Express UAE Visa', code: 'DXB-VISA-EXP', serviceType: 'Express Visa', supplier: 'VFS Global', costPrice: 130, defaultSellPrice: 190 },
  // Transfers
  { categoryCode: 'TRANSFER', name: 'Shared Airport Transfer', code: 'DXB-TRF-SHARED', serviceType: 'Shared Transfer', supplier: 'Emirates Transport', costPrice: 15, defaultSellPrice: 30 },
  { categoryCode: 'TRANSFER', name: 'Private Airport Transfer', code: 'DXB-TRF-PVT', serviceType: 'Private Transfer', supplier: 'Emirates Transport', costPrice: 35, defaultSellPrice: 60 },
  { categoryCode: 'TRANSFER', name: 'Luxury Airport Transfer', code: 'DXB-TRF-LUX', serviceType: 'Luxury Transfer', supplier: 'Blacklane', costPrice: 70, defaultSellPrice: 120 },
  { categoryCode: 'TRANSFER', name: 'VIP Airport Transfer', code: 'DXB-TRF-VIP', serviceType: 'VIP Transfer', supplier: 'Blacklane', costPrice: 120, defaultSellPrice: 200 },
  // Activities
  { categoryCode: 'ACTIVITY', name: 'Desert Safari with Dinner', code: 'DXB-ACT-SAFARI', serviceType: 'Desert Safari', supplier: 'Arabian Adventures', costPrice: 35, defaultSellPrice: 65 },
  { categoryCode: 'ACTIVITY', name: 'Dolphin Show at Dubai Dolphinarium', code: 'DXB-ACT-DOLPHIN', serviceType: 'Show', supplier: 'Dubai Dolphinarium', costPrice: 20, defaultSellPrice: 40 },
  { categoryCode: 'ACTIVITY', name: 'Burj Khalifa At The Top', code: 'DXB-ACT-BURJ', serviceType: 'Attraction', supplier: 'Emaar', costPrice: 40, defaultSellPrice: 75 },
  { categoryCode: 'ACTIVITY', name: 'Dubai Frame', code: 'DXB-ACT-FRAME', serviceType: 'Attraction', supplier: 'Dubai Municipality', costPrice: 12, defaultSellPrice: 25 },
  { categoryCode: 'ACTIVITY', name: 'Museum of the Future', code: 'DXB-ACT-MOF', serviceType: 'Attraction', supplier: 'Museum of the Future', costPrice: 40, defaultSellPrice: 70 },
  { categoryCode: 'ACTIVITY', name: 'Miracle Garden', code: 'DXB-ACT-MIRACLE', serviceType: 'Attraction', supplier: 'Dubai Miracle Garden', costPrice: 15, defaultSellPrice: 30 },
  // Sightseeing
  { categoryCode: 'SIGHTSEEING', name: 'Dubai City Tour', code: 'DXB-SGT-DUBAI', serviceType: 'City Tour', supplier: 'Arabian Adventures', costPrice: 25, defaultSellPrice: 50 },
  { categoryCode: 'SIGHTSEEING', name: 'Abu Dhabi City Tour', code: 'DXB-SGT-AUH', serviceType: 'City Tour', supplier: 'Arabian Adventures', costPrice: 45, defaultSellPrice: 85 },
  { categoryCode: 'SIGHTSEEING', name: 'Sharjah Tour', code: 'DXB-SGT-SHJ', serviceType: 'City Tour', supplier: 'Arabian Adventures', costPrice: 30, defaultSellPrice: 55 },
  // Meals
  { categoryCode: 'MEAL', name: 'Daily Breakfast', code: 'DXB-MEAL-BB', serviceType: 'Breakfast', supplier: 'Hotel', costPrice: 8, defaultSellPrice: 15 },
  { categoryCode: 'MEAL', name: 'Half Board', code: 'DXB-MEAL-HB', serviceType: 'Half Board', supplier: 'Hotel', costPrice: 20, defaultSellPrice: 35 },
  { categoryCode: 'MEAL', name: 'Full Board', code: 'DXB-MEAL-FB', serviceType: 'Full Board', supplier: 'Hotel', costPrice: 32, defaultSellPrice: 55 },
  // Accommodation
  { categoryCode: 'ACCOMMODATION', name: 'Accommodation', code: 'DXB-ACC-STD', serviceType: 'Room Night', supplier: 'Hotel', costPrice: 0, defaultSellPrice: 0 },
];

/**
 * Maps the legacy short service labels stored on demo leads to their catalog
 * equivalents, so demo leads carry proper catalog snapshots (same mapping the
 * lead-services migration applies to real leads).
 */
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

interface Requirements {
  passenger: string;
  dates: string;
  hotels: string[];
  services: string[];
  note: string;
}

function requirementsNote(r: Requirements): string {
  const lines = ['CLIENT REQUIREMENTS', ''];
  lines.push('Passenger:', r.passenger || 'Not specified', '');
  lines.push('Travel Dates:', r.dates || 'Not specified', '');
  lines.push('Requested Hotels:');
  lines.push(...(r.hotels.length ? r.hotels.map((h) => `- ${h}`) : ['None specified']));
  lines.push('');
  lines.push('Requested Services:');
  lines.push(...(r.services.length ? r.services.map((s) => `✓ ${s}`) : ['None specified']));
  lines.push('', 'Notes:', r.note);
  return lines.join('\n');
}

interface DemoLead {
  requirements: Requirements;
  data: Record<string, unknown>;
}

const LEADS: DemoLead[] = [
  {
    requirements: {
      passenger: 'Chukwudi Emmanuel (Travel Connect)',
      dates: '15 Aug - 19 Aug',
      hotels: ['Al Khoory Sky Garden', 'Hilton Dubai Creek Residence'],
      services: ['Airport Transfer', 'UAE Visa', 'Daily Breakfast', 'Accommodation', 'Desert Safari with Dinner'],
      note: 'Client requested a Dubai package using the supplied hotel options and activities.',
    },
    data: {
      name: 'Chukwudi Emmanuel',
      companyName: 'Travel Connect',
      phone: '+2348031234567',
      email: 'ops@travelconnect.ng',
      source: 'WHATSAPP',
      inquiryType: 'TRAVEL_PACKAGE',
      status: 'QUOTE_SENT',
      destination: 'Dubai',
      travelDate: new Date('2026-08-15'),
      returnDate: new Date('2026-08-19'),
      adults: 2,
      children: 0,
      rooms: 1,
      nights: 4,
      preparedBy: 'Aisha',
      currency: 'USD',
      markup: 90,
      quoteValidityHours: 48,
      rawInquiry:
        'Hi, please design a Dubai package for 2 adults, 15-19 Aug.\n' +
        'Hotels: Al Khoory Sky Garden or Hilton Dubai Creek Residence.\n' +
        'Include Airport Transfer, Visa, Daily Breakfast, Accommodation and Desert Safari with dinner.',
      requestedServices: ['Airport Transfer', 'UAE Visa', 'Daily Breakfast', 'Accommodation', 'Desert Safari with Dinner'],
      requestedHotels: ['Al Khoory Sky Garden', 'Hilton Dubai Creek Residence'],
      services: ['Visa', 'Airport Transfer', 'Desert Safari'],
      hotelOptions: [
        { name: 'Al Khoory Sky Garden', starRating: 4, location: 'Al Qusais, Dubai', roomType: 'Classic Room', pricePerPerson: 365, recommended: false },
        { name: 'Hilton Dubai Creek Residence', starRating: 5, location: 'Deira, Dubai', roomType: 'Deluxe Room', pricePerPerson: 450, recommended: true },
      ],
    },
  },
  {
    requirements: {
      passenger: 'Priya Nair (Skyline Travels)',
      dates: '10 Sep - 17 Sep',
      hotels: [],
      services: ['Airport Transfer', 'Daily Breakfast', 'Phi Phi Islands Tour', 'Accommodation'],
      note: 'Honeymoon couple; awaiting decision after the first quote — follow up on hotel preference.',
    },
    data: {
      name: 'Priya Nair',
      companyName: 'Skyline Travels',
      phone: '+2347025557788',
      email: 'bookings@skylinetravels.ng',
      source: 'WHATSAPP',
      inquiryType: 'TRAVEL_PACKAGE',
      status: 'FOLLOW_UP',
      destination: 'Thailand',
      travelDate: new Date('2026-09-10'),
      returnDate: new Date('2026-09-17'),
      adults: 2,
      children: 0,
      rooms: 1,
      nights: 7,
      preparedBy: 'Bilal',
      currency: 'USD',
      markup: 150,
      quoteValidityHours: 72,
      rawInquiry:
        'Honeymoon couple looking for a 7-night Thailand package (Phuket + Bangkok) in September.\n' +
        'Please include airport transfers, daily breakfast, and a Phi Phi islands tour. Budget is flexible.',
      requestedServices: ['Airport Transfer', 'Daily Breakfast', 'Phi Phi Islands Tour', 'Accommodation'],
      requestedHotels: [],
      services: ['Airport Transfer', 'City Tour'],
      hotelOptions: [
        { name: 'Novotel Phuket Resort', starRating: 4, location: 'Patong, Phuket', roomType: 'Deluxe Ocean View', pricePerPerson: 620, recommended: true },
      ],
    },
  },
  {
    requirements: {
      passenger: '3 passengers (Royal Wings Travel)',
      dates: '28 Jul (30-day visa)',
      hotels: [],
      services: ['30-day UAE Tourist Visa x3'],
      note: 'Visa-only request; confirmed and moving to processing.',
    },
    data: {
      name: 'Fatima Bello',
      companyName: 'Royal Wings Travel',
      phone: '+2348099001122',
      email: 'visa@royalwings.ng',
      source: 'EMAIL',
      inquiryType: 'VISA',
      status: 'CONFIRMED',
      destination: 'Dubai',
      travelDate: new Date('2026-07-28'),
      adults: 3,
      children: 0,
      rooms: 0,
      nights: 0,
      preparedBy: 'Fatima',
      currency: 'USD',
      markup: 40,
      quoteValidityHours: 48,
      rawInquiry:
        'Need 30-day UAE tourist visas for 3 passengers travelling end of July. Passports ready. Please advise processing time and cost.',
      requestedServices: ['UAE Visa'],
      requestedHotels: [],
      services: ['Visa'],
      hotelOptions: [],
    },
  },
  {
    requirements: {
      passenger: 'Okoro family — 2 adults + 2 children (Globe Trek Agency)',
      dates: '2 Aug - 8 Aug',
      hotels: ['Citymax Bur Dubai'],
      services: ['Visa', 'Airport Transfer', 'Daily Breakfast', 'Desert Safari', 'Dolphin Show'],
      note: 'Family package confirmed; arranging bookings and vouchers now.',
    },
    data: {
      name: 'Daniel Okoro',
      companyName: 'Globe Trek Agency',
      phone: '+2347066554433',
      email: 'trips@globetrek.ng',
      source: 'WHATSAPP',
      inquiryType: 'TRAVEL_PACKAGE',
      status: 'ARRANGEMENTS',
      destination: 'Dubai',
      travelDate: new Date('2026-08-02'),
      returnDate: new Date('2026-08-08'),
      adults: 2,
      children: 2,
      rooms: 2,
      nights: 6,
      preparedBy: 'Omar',
      currency: 'USD',
      markup: 120,
      quoteValidityHours: 48,
      rawInquiry:
        'Family of 4 (2 adults, 2 kids) for a 6-night Dubai holiday early August. 2 rooms.\n' +
        'Want Visa, airport transfers, breakfast, a desert safari and the Dolphin show. Kid-friendly hotel please.',
      requestedServices: ['Visa', 'Airport Transfer', 'Daily Breakfast', 'Desert Safari', 'Dolphin Show'],
      requestedHotels: ['Citymax Bur Dubai'],
      services: ['Visa', 'Airport Transfer', 'Desert Safari', 'Dolphin Show'],
      hotelOptions: [
        { name: 'Citymax Bur Dubai', starRating: 3, location: 'Bur Dubai, Dubai', roomType: 'Family Room', pricePerPerson: 280, recommended: true },
        { name: 'Millennium Place Dubai Marina', starRating: 4, location: 'Dubai Marina, Dubai', roomType: 'Two Bedroom', pricePerPerson: 410, recommended: false },
      ],
    },
  },
  {
    requirements: {
      passenger: 'VIP couple (Elite Travel Hub)',
      dates: '12 Jun - 17 Jun',
      hotels: ['Pullman Dubai Creek City Centre'],
      services: ['Private Airport Transfer', 'Visa', 'Daily Breakfast', 'Premium Desert Safari', 'Yacht Cruise'],
      note: 'Luxury package delivered and completed — repeat VIP client.',
    },
    data: {
      name: 'Sophia Adeyemi',
      companyName: 'Elite Travel Hub',
      phone: '+2348122334455',
      email: 'luxury@elitetravelhub.ng',
      source: 'WHATSAPP',
      inquiryType: 'TRAVEL_PACKAGE',
      status: 'COMPLETED',
      destination: 'Dubai',
      travelDate: new Date('2026-06-12'),
      returnDate: new Date('2026-06-17'),
      adults: 2,
      children: 0,
      rooms: 1,
      nights: 5,
      preparedBy: 'Zara',
      currency: 'USD',
      markup: 260,
      quoteValidityHours: 48,
      rawInquiry:
        'VIP couple wanting a luxury 5-night Dubai experience in June. 5-star only.\n' +
        'Private airport transfer, visa, daily breakfast, desert safari (premium), and a yacht cruise. Budget premium.',
      requestedServices: ['Private Airport Transfer', 'Visa', 'Daily Breakfast', 'Premium Desert Safari', 'Yacht Cruise'],
      requestedHotels: ['Pullman Dubai Creek City Centre'],
      services: ['Visa', 'Airport Transfer', 'Desert Safari', 'City Tour'],
      hotelOptions: [
        { name: 'Pullman Dubai Creek City Centre', starRating: 5, location: 'Deira, Dubai', roomType: 'Executive Suite', pricePerPerson: 890, recommended: true },
      ],
    },
  },
];

async function main(): Promise<void> {
  const uri = env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not set');
  await mongoose.connect(uri, { dbName: env.MONGODB_DB_NAME ?? 'dmc_crm' });

  const Roles = mongoose.model(Role.name, RoleSchema);
  const Users = mongoose.model(User.name, UserSchema);
  const Organizations = mongoose.model(Organization.name, OrganizationSchema);
  const Leads = mongoose.model(Lead.name, LeadSchema);
  const Activities = mongoose.model(LeadActivity.name, LeadActivitySchema);
  const Services = mongoose.model(Service.name, ServiceSchema);
  const ServiceCategories = mongoose.model(ServiceCategory.name, ServiceCategorySchema);

  try {
    // 1. Organization ------------------------------------------------------
    await Organizations.updateOne(
      { slug: DEMO.orgSlug },
      { $set: { name: DEMO.orgName }, $setOnInsert: { slug: DEMO.orgSlug } },
      { upsert: true },
    );
    const org = await Organizations.findOne({ slug: DEMO.orgSlug }).lean<{
      _id: mongoose.Types.ObjectId;
    }>();
    if (!org) throw new Error('Failed to upsert demo organization');
    const organizationId = org._id;
    console.log(`✓ Organization: ${DEMO.orgName} (${DEMO.orgSlug})`);

    // 2. Staff user (production flow: seeded role + hashed password) --------
    const role = await Roles.findOne({ organizationId: null, code: DEMO.role }).lean<{
      _id: mongoose.Types.ObjectId;
    }>();
    if (!role) {
      throw new Error(`System role "${DEMO.role}" not found. Run "npm run seed:catalog" first.`);
    }
    await Users.updateOne(
      { email: DEMO.email },
      {
        $set: {
          email: DEMO.email,
          organizationId,
          firstName: DEMO.firstName,
          lastName: DEMO.lastName,
          roleIds: [role._id],
          status: UserStatus.ACTIVE,
          passwordHash: hashPassword(DEMO.password),
          mustChangePassword: false,
          failedLoginAttempts: 0,
        },
        $unset: { lockedUntil: '' },
        $setOnInsert: { directPermissions: [], isDeleted: false },
      },
      { upsert: true },
    );
    console.log(`✓ Staff user: ${DEMO.firstName} ${DEMO.lastName} <${DEMO.email}> [${DEMO.role}]`);

    // 3. Service categories (global) + Dubai service catalog (org-scoped) ---
    for (const c of SERVICE_CATEGORIES) {
      await ServiceCategories.updateOne({ code: c.code }, { $set: { ...c, isActive: true } }, { upsert: true });
    }
    for (const s of DUBAI_SERVICES) {
      // Group variants under a generic requirement label.
      const variantGroup =
        s.categoryCode === 'VISA'
          ? 'UAE Visa'
          : s.categoryCode === 'TRANSFER' && /airport transfer/i.test(s.name)
            ? 'Airport Transfer'
            : s.categoryCode === 'MEAL'
              ? 'Meal Plan'
              : null;
      await Services.updateOne(
        { organizationId, name: s.name },
        {
          $set: {
            categoryCode: s.categoryCode,
            code: s.code,
            destination: 'Dubai',
            serviceType: s.serviceType,
            variantGroup,
            supplier: s.supplier,
            currency: 'USD',
            costPrice: s.costPrice,
            defaultSellPrice: s.defaultSellPrice,
            basePrice: s.defaultSellPrice,
            isActive: true,
            isDeleted: false,
          },
        },
        { upsert: true },
      );
    }
    // Build a name → service map for snapshotting onto leads.
    const catalog = await Services.find({ organizationId, isDeleted: false }).lean<
      Array<{
        _id: mongoose.Types.ObjectId;
        name: string;
        categoryCode: string;
        variantGroup?: string;
        supplier?: string;
        currency?: string;
        costPrice?: number;
        defaultSellPrice?: number;
      }>
    >();
    const byName = new Map(catalog.map((s) => [s.name.toLowerCase(), s]));
    console.log(`✓ Services: ${DUBAI_SERVICES.length} Dubai services in ${DEMO.orgName}`);

    /** Turn a lead's legacy service labels into catalog snapshots. */
    const snapshot = (labels: string[]) => {
      const now = new Date();
      return labels
        .map((label) => {
          const catalogName = LEGACY_TO_CATALOG[label.trim().toLowerCase()] ?? label;
          const svc = byName.get(catalogName.toLowerCase());
          if (svc) {
            return {
              serviceId: String(svc._id),
              serviceName: svc.name,
              categoryCode: svc.categoryCode,
              variantGroup: svc.variantGroup,
              supplier: svc.supplier,
              currency: svc.currency ?? 'USD',
              costPrice: svc.costPrice,
              sellPrice: svc.defaultSellPrice,
              snapshotDate: now,
            };
          }
          return { serviceName: label, snapshotDate: now };
        });
    };

    // 4. Leads (clean slate, then insert) ----------------------------------
    const existing = await Leads.find({ organizationId, isDeleted: false }).select('_id').lean();
    if (existing.length) {
      await Leads.updateMany(
        { organizationId, isDeleted: false },
        { $set: { isDeleted: true, deletedAt: new Date() } },
      );
      console.log(`  cleared ${existing.length} existing demo lead(s)`);
    }

    for (const { requirements, data } of LEADS) {
      const serviceItems = snapshot((data.services as string[]) ?? []);
      const lead = await Leads.create({
        ...data,
        organizationId,
        requirementsNote: requirementsNote(requirements),
        serviceItems,
        // Keep the legacy label list in sync with the catalog snapshot names.
        services: serviceItems.map((s) => s.serviceName),
      });
      await Activities.create({
        organizationId,
        leadId: lead._id,
        type: LeadActivityType.LEAD_CREATED,
        description: `Lead created from ${data.source} (${data.inquiryType})`,
      });
      console.log(`  ✓ ${data.companyName} — ${data.destination} (${data.status})`);
    }

    console.log(`\n✓ ${LEADS.length} demo leads seeded into ${DEMO.orgName}.`);
    console.log('\n──────────────── DEMO LOGIN ────────────────');
    console.log(`  Email    : ${DEMO.email}`);
    console.log(`  Password : ${DEMO.password}`);
    console.log(`  Role     : Staff (${DEMO.role})`);
    console.log('────────────────────────────────────────────');
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
