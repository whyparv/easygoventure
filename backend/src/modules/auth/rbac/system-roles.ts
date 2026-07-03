import { ALL_PERMISSION_KEYS, PERMISSIONS, PermissionKey, WILDCARD_PERMISSION } from './permissions';

/**
 * System & business role templates.
 *
 * Roles are bundles of permission keys. System roles are seeded once and shared;
 * an organization may later clone/extend them. SUPER_ADMIN holds the wildcard.
 */
export enum SystemRole {
  // Platform / organization authority
  SUPER_ADMIN = 'SUPER_ADMIN',
  ORGANIZATION_OWNER = 'ORGANIZATION_OWNER',
  ORGANIZATION_ADMIN = 'ORGANIZATION_ADMIN',

  // Sales & marketing
  SALES_MANAGER = 'SALES_MANAGER',
  SALES_EXECUTIVE = 'SALES_EXECUTIVE',
  MARKETING_EXECUTIVE = 'MARKETING_EXECUTIVE',
  LEAD_QUALIFICATION_EXECUTIVE = 'LEAD_QUALIFICATION_EXECUTIVE',

  // Operations
  OPERATIONS_MANAGER = 'OPERATIONS_MANAGER',
  OPERATIONS_EXECUTIVE = 'OPERATIONS_EXECUTIVE',
  TRAVEL_COORDINATOR = 'TRAVEL_COORDINATOR',

  // Visa
  VISA_MANAGER = 'VISA_MANAGER',
  VISA_EXECUTIVE = 'VISA_EXECUTIVE',

  // Hotels / suppliers
  HOTEL_BOOKING_EXECUTIVE = 'HOTEL_BOOKING_EXECUTIVE',
  SUPPLIER_COORDINATOR = 'SUPPLIER_COORDINATOR',

  // Transfers
  TRANSFER_COORDINATOR = 'TRANSFER_COORDINATOR',

  // Accounts / finance
  ACCOUNTS_MANAGER = 'ACCOUNTS_MANAGER',
  FINANCE_EXECUTIVE = 'FINANCE_EXECUTIVE',
  BILLING_EXECUTIVE = 'BILLING_EXECUTIVE',

  // Customer success / support
  CUSTOMER_SUCCESS_EXECUTIVE = 'CUSTOMER_SUCCESS_EXECUTIVE',
  SUPPORT_EXECUTIVE = 'SUPPORT_EXECUTIVE',

  // Cross-cutting read-only / auditor
  READ_ONLY = 'READ_ONLY',
}

const P = PERMISSIONS;

/** Common bundles reused across several roles. */
const SALES_CORE: PermissionKey[] = [
  P.INQUIRY_READ, P.INQUIRY_CREATE, P.INQUIRY_UPDATE, P.INQUIRY_CONVERT,
  P.LEAD_READ, P.LEAD_CREATE, P.LEAD_UPDATE,
  P.PROPOSAL_READ, P.PROPOSAL_CREATE, P.PROPOSAL_UPDATE, P.PROPOSAL_SEND,
  P.FOLLOWUP_READ, P.FOLLOWUP_CREATE, P.FOLLOWUP_UPDATE,
  P.SERVICE_READ, P.HOTEL_READ, P.VENDOR_READ, P.VENDOR_RATE_READ,
  P.PACKAGE_READ, P.PACKAGE_CREATE, P.PACKAGE_UPDATE,
  P.QUOTATION_READ, P.QUOTATION_CREATE, P.QUOTATION_SEND,
  P.AI_USE,
];

const OPS_CORE: PermissionKey[] = [
  P.INQUIRY_READ, P.LEAD_READ, P.PROPOSAL_READ,
  P.FULFILLMENT_READ, P.FULFILLMENT_UPDATE,
  P.SERVICE_READ, P.HOTEL_READ, P.VENDOR_READ, P.VENDOR_RATE_READ,
  P.PACKAGE_READ, P.QUOTATION_READ,
  // Phase 3 travel-operations read surface
  P.TRAVELER_READ, P.BOOKING_READ, P.OPERATIONS_READ,
  P.AI_USE,
];

/** Phase 3 execution authority: manage travelers, supplier bookings & documents. */
const OPS_EXECUTION: PermissionKey[] = [
  P.TRAVELER_CREATE, P.TRAVELER_UPDATE,
  P.BOOKING_CREATE, P.BOOKING_UPDATE, P.BOOKING_CONFIRM,
  P.DOCUMENT_GENERATE,
];

/** Every read/view permission — the full surface a read-only auditor may see. */
const READ_ONLY_BUNDLE: PermissionKey[] = [
  P.ORGANIZATION_READ, P.DEPARTMENT_READ, P.USER_READ, P.ROLE_READ, P.PERMISSION_READ,
  P.INQUIRY_READ, P.LEAD_READ, P.PROPOSAL_READ, P.FOLLOWUP_READ, P.FULFILLMENT_READ,
  P.SERVICE_READ, P.HOTEL_READ, P.VENDOR_READ, P.VENDOR_RATE_READ,
  P.PACKAGE_READ, P.QUOTATION_READ,
  P.TRAVELER_READ, P.BOOKING_READ, P.OPERATIONS_READ,
  P.REPORT_READ, P.AUDIT_READ, P.AI_USE,
];

export interface RoleDefinition {
  code: SystemRole;
  name: string;
  description: string;
  /** Permission keys, or the wildcard for SUPER_ADMIN. */
  permissions: string[];
  /** System roles are protected: they cannot be deleted and seed once. */
  isSystem: boolean;
}

/** The seeded role → permission matrix. */
export const ROLE_DEFINITIONS: RoleDefinition[] = [
  {
    code: SystemRole.SUPER_ADMIN,
    name: 'Super Admin',
    description: 'Platform owner — full access across every organization.',
    permissions: [WILDCARD_PERMISSION],
    isSystem: true,
  },
  {
    code: SystemRole.ORGANIZATION_OWNER,
    name: 'Organization Owner',
    description: 'DMC owner — full authority within the organization.',
    permissions: [...ALL_PERMISSION_KEYS],
    isSystem: true,
  },
  {
    code: SystemRole.ORGANIZATION_ADMIN,
    name: 'Organization Admin',
    description: 'Administrative authority within the organization (cannot delete the org).',
    permissions: ALL_PERMISSION_KEYS.filter((k) => k !== P.ORGANIZATION_MANAGE),
    isSystem: true,
  },

  {
    code: SystemRole.SALES_MANAGER,
    name: 'Sales Manager',
    description: 'Leads the sales team; can accept/reject proposals and approve AI actions.',
    permissions: [
      ...SALES_CORE,
      P.LEAD_DELETE, P.INQUIRY_DELETE,
      P.PROPOSAL_ACCEPT, P.PROPOSAL_REJECT,
      P.FOLLOWUP_DELETE,
      P.PACKAGE_DELETE, P.QUOTATION_ACCEPT, P.QUOTATION_REJECT,
      P.REPORT_READ, P.USER_READ, P.AI_APPROVE_ACTION,
      // Post-sale visibility into operations
      P.TRAVELER_READ, P.BOOKING_READ, P.OPERATIONS_READ,
    ],
    isSystem: true,
  },
  {
    code: SystemRole.SALES_EXECUTIVE,
    name: 'Sales Executive',
    description: 'Owns inquiries, leads, proposals and follow-ups for their book of business.',
    permissions: [...SALES_CORE],
    isSystem: true,
  },
  {
    code: SystemRole.MARKETING_EXECUTIVE,
    name: 'Marketing Executive',
    description: 'Reviews inbound demand and campaign performance.',
    permissions: [P.INQUIRY_READ, P.LEAD_READ, P.PROPOSAL_READ, P.SERVICE_READ, P.AI_USE],
    isSystem: true,
  },
  {
    code: SystemRole.LEAD_QUALIFICATION_EXECUTIVE,
    name: 'Lead Qualification Executive',
    description: 'Triages and qualifies inbound inquiries before hand-off to sales.',
    permissions: [
      P.INQUIRY_READ, P.INQUIRY_CREATE, P.INQUIRY_UPDATE, P.INQUIRY_CONVERT,
      P.LEAD_READ, P.LEAD_UPDATE,
      P.FOLLOWUP_READ, P.FOLLOWUP_CREATE, P.FOLLOWUP_UPDATE,
      P.SERVICE_READ, P.AI_USE,
    ],
    isSystem: true,
  },

  {
    code: SystemRole.OPERATIONS_MANAGER,
    name: 'Operations Manager',
    description: 'Owns the arrangement/fulfillment stage and vendor coordination.',
    permissions: [
      ...OPS_CORE,
      ...OPS_EXECUTION,
      P.TRAVELER_DELETE,
      P.FULFILLMENT_CREATE,
      P.VENDOR_CREATE, P.VENDOR_UPDATE, P.VENDOR_RATE_CREATE, P.VENDOR_RATE_UPDATE,
      P.SERVICE_CREATE, P.SERVICE_UPDATE,
      P.REPORT_READ, P.USER_READ, P.AI_APPROVE_ACTION,
    ],
    isSystem: true,
  },
  {
    code: SystemRole.OPERATIONS_EXECUTIVE,
    name: 'Operations Executive',
    description: 'Executes fulfillment tasks and supplier bookings.',
    permissions: [...OPS_CORE, ...OPS_EXECUTION],
    isSystem: true,
  },
  {
    code: SystemRole.TRAVEL_COORDINATOR,
    name: 'Travel Coordinator',
    description: 'Coordinates travel logistics and customer touchpoints during fulfillment.',
    permissions: [
      ...OPS_CORE,
      ...OPS_EXECUTION,
      P.FOLLOWUP_READ, P.FOLLOWUP_CREATE, P.FOLLOWUP_UPDATE,
    ],
    isSystem: true,
  },

  {
    code: SystemRole.VISA_MANAGER,
    name: 'Visa Manager',
    description: 'Owns visa services, requirements and visa fulfillment.',
    permissions: [
      ...OPS_CORE,
      ...OPS_EXECUTION,
      P.FULFILLMENT_CREATE,
      P.SERVICE_CREATE, P.SERVICE_UPDATE,
      P.VENDOR_CREATE, P.VENDOR_UPDATE,
      P.AI_APPROVE_ACTION,
    ],
    isSystem: true,
  },
  {
    code: SystemRole.VISA_EXECUTIVE,
    name: 'Visa Executive',
    description: 'Processes visa applications and document collection.',
    permissions: [...OPS_CORE, ...OPS_EXECUTION],
    isSystem: true,
  },

  {
    code: SystemRole.HOTEL_BOOKING_EXECUTIVE,
    name: 'Hotel Booking Executive',
    description: 'Sources and books hotels; reads the hotel & vendor catalogs.',
    permissions: [
      ...OPS_CORE,
      ...OPS_EXECUTION,
      P.HOTEL_MANAGE,
    ],
    isSystem: true,
  },
  {
    code: SystemRole.SUPPLIER_COORDINATOR,
    name: 'Supplier Coordinator',
    description: 'Maintains vendors and their rate cards.',
    permissions: [
      P.VENDOR_READ, P.VENDOR_CREATE, P.VENDOR_UPDATE,
      P.VENDOR_RATE_READ, P.VENDOR_RATE_CREATE, P.VENDOR_RATE_UPDATE, P.VENDOR_RATE_DELETE,
      P.SERVICE_READ, P.HOTEL_READ, P.AI_USE,
    ],
    isSystem: true,
  },

  {
    code: SystemRole.TRANSFER_COORDINATOR,
    name: 'Transfer Coordinator',
    description: 'Coordinates airport transfers and ground transport.',
    permissions: [...OPS_CORE, ...OPS_EXECUTION],
    isSystem: true,
  },

  {
    code: SystemRole.ACCOUNTS_MANAGER,
    name: 'Accounts Manager',
    description: 'Oversees financial closure (accounts module lands in a later phase).',
    permissions: [
      P.INQUIRY_READ, P.LEAD_READ, P.PROPOSAL_READ, P.FULFILLMENT_READ,
      P.VENDOR_READ, P.VENDOR_RATE_READ, P.AUDIT_READ, P.REPORT_READ, P.AI_USE,
    ],
    isSystem: true,
  },
  {
    code: SystemRole.FINANCE_EXECUTIVE,
    name: 'Finance Executive',
    description: 'Reviews deal economics (read-only in Phase 1).',
    permissions: [P.PROPOSAL_READ, P.FULFILLMENT_READ, P.VENDOR_READ, P.VENDOR_RATE_READ],
    isSystem: true,
  },
  {
    code: SystemRole.BILLING_EXECUTIVE,
    name: 'Billing Executive',
    description: 'Handles billing artifacts (read-only in Phase 1).',
    permissions: [P.PROPOSAL_READ, P.FULFILLMENT_READ],
    isSystem: true,
  },

  {
    code: SystemRole.CUSTOMER_SUCCESS_EXECUTIVE,
    name: 'Customer Success Executive',
    description: 'Owns post-sale relationship and follow-up cadence.',
    permissions: [
      P.INQUIRY_READ, P.LEAD_READ, P.PROPOSAL_READ, P.FULFILLMENT_READ,
      P.FOLLOWUP_READ, P.FOLLOWUP_CREATE, P.FOLLOWUP_UPDATE, P.AI_USE,
    ],
    isSystem: true,
  },
  {
    code: SystemRole.SUPPORT_EXECUTIVE,
    name: 'Support Executive',
    description: 'Front-line support; reads customer records and logs follow-ups.',
    permissions: [
      P.INQUIRY_READ, P.LEAD_READ, P.FOLLOWUP_READ, P.FOLLOWUP_CREATE, P.AI_USE,
    ],
    isSystem: true,
  },

  {
    code: SystemRole.READ_ONLY,
    name: 'Read Only',
    description: 'View-only access across the platform. Cannot create, update or delete anything.',
    permissions: [...READ_ONLY_BUNDLE],
    isSystem: true,
  },
];

/** Seed departments (per the Phase 1 brief). */
export const SEED_DEPARTMENTS: Array<{ name: string; description: string }> = [
  { name: 'Management', description: 'Executive leadership and cross-functional oversight.' },
  { name: 'Sales & Marketing', description: 'Demand generation, inquiries, leads and proposals.' },
  { name: 'Operations', description: 'Arrangement/fulfillment of booked services.' },
  { name: 'Visa', description: 'Visa processing and documentation.' },
  { name: 'Hotels', description: 'Hotel contracting and bookings.' },
  { name: 'Transfers', description: 'Airport transfers and ground transport.' },
  { name: 'Accounts', description: 'Finance, billing and reconciliation.' },
  { name: 'Customer Support', description: 'Post-sale support and customer success.' },
  { name: 'Administration', description: 'HR, IT and general administration.' },
];
