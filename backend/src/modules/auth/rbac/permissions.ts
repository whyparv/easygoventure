/**
 * Permission catalog - the single source of truth for authority in the platform.
 *
 * Authorization is PERMISSION-DRIVEN, not role-driven: guards check permission
 * keys, and roles are merely named bundles of these keys (see system-roles.ts).
 * A permission is `<resource>.<action>`. The wildcard `*` is reserved for the
 * platform SUPER_ADMIN and grants everything.
 */

/** Scope at which a permission is evaluated. */
export enum PermissionScope {
  /** Platform-wide, across all organizations (SUPER_ADMIN only). */
  GLOBAL = 'GLOBAL',
  /** Within the actor's own organization (the default for business permissions). */
  ORGANIZATION = 'ORGANIZATION',
  /** Restricted to the actor's own department. */
  DEPARTMENT = 'DEPARTMENT',
  /** Restricted to records the actor owns/created. */
  RECORD = 'RECORD',
}

export const WILDCARD_PERMISSION = '*';

/** Flat, strongly-typed list of every permission key. */
export const PERMISSIONS = {
  // Platform / organization
  ORGANIZATION_READ: 'organization.read',
  ORGANIZATION_MANAGE: 'organization.manage',

  // Departments
  DEPARTMENT_READ: 'department.read',
  DEPARTMENT_CREATE: 'department.create',
  DEPARTMENT_UPDATE: 'department.update',
  DEPARTMENT_DELETE: 'department.delete',

  // Users
  USER_READ: 'user.read',
  USER_CREATE: 'user.create',
  USER_UPDATE: 'user.update',
  USER_DELETE: 'user.delete',

  // Roles & permissions
  ROLE_READ: 'role.read',
  ROLE_CREATE: 'role.create',
  ROLE_UPDATE: 'role.update',
  ROLE_DELETE: 'role.delete',
  ROLE_ASSIGN: 'role.assign',
  PERMISSION_READ: 'permission.read',

  // Inquiry (new first-class aggregate)
  INQUIRY_READ: 'inquiry.read',
  INQUIRY_CREATE: 'inquiry.create',
  INQUIRY_UPDATE: 'inquiry.update',
  INQUIRY_DELETE: 'inquiry.delete',
  INQUIRY_CONVERT: 'inquiry.convert',

  // Lead (downstream sales artifact)
  LEAD_READ: 'lead.read',
  LEAD_CREATE: 'lead.create',
  LEAD_UPDATE: 'lead.update',
  LEAD_DELETE: 'lead.delete',

  // Proposal
  PROPOSAL_READ: 'proposal.read',
  PROPOSAL_CREATE: 'proposal.create',
  PROPOSAL_UPDATE: 'proposal.update',
  PROPOSAL_SEND: 'proposal.send',
  PROPOSAL_ACCEPT: 'proposal.accept',
  PROPOSAL_REJECT: 'proposal.reject',

  // Follow-ups
  FOLLOWUP_READ: 'followup.read',
  FOLLOWUP_CREATE: 'followup.create',
  FOLLOWUP_UPDATE: 'followup.update',
  FOLLOWUP_DELETE: 'followup.delete',

  // Fulfillments / arrangement
  FULFILLMENT_READ: 'fulfillment.read',
  FULFILLMENT_CREATE: 'fulfillment.create',
  FULFILLMENT_UPDATE: 'fulfillment.update',

  // Service catalog
  SERVICE_READ: 'service.read',
  SERVICE_CREATE: 'service.create',
  SERVICE_UPDATE: 'service.update',
  SERVICE_DELETE: 'service.delete',
  SERVICE_CATEGORY_MANAGE: 'service_category.manage',

  // Hotel reference catalog
  HOTEL_READ: 'hotel.read',
  HOTEL_MANAGE: 'hotel.manage',

  // Agencies (travel agency directory)
  AGENCY_READ: 'agency.read',
  AGENCY_CREATE: 'agency.create',
  AGENCY_UPDATE: 'agency.update',
  AGENCY_DELETE: 'agency.delete',

  // Vendors & rates
  VENDOR_READ: 'vendor.read',
  VENDOR_CREATE: 'vendor.create',
  VENDOR_UPDATE: 'vendor.update',
  VENDOR_DELETE: 'vendor.delete',
  VENDOR_RATE_READ: 'vendor_rate.read',
  VENDOR_RATE_CREATE: 'vendor_rate.create',
  VENDOR_RATE_UPDATE: 'vendor_rate.update',
  VENDOR_RATE_DELETE: 'vendor_rate.delete',

  // Packages (internal costing workspace)
  PACKAGE_READ: 'package.read',
  PACKAGE_CREATE: 'package.create',
  PACKAGE_UPDATE: 'package.update',
  PACKAGE_DELETE: 'package.delete',

  // Quotations (customer-facing commercial document)
  QUOTATION_READ: 'quotation.read',
  QUOTATION_CREATE: 'quotation.create',
  QUOTATION_SEND: 'quotation.send',
  QUOTATION_ACCEPT: 'quotation.accept',
  QUOTATION_REJECT: 'quotation.reject',

  // AI copilot
  AI_USE: 'ai.use',
  AI_APPROVE_ACTION: 'ai.approve_action',

  // Reporting
  REPORT_READ: 'report.read',

  // Travel operations (Phase 3): travelers, supplier bookings, timeline, documents
  TRAVELER_READ: 'traveler.read',
  TRAVELER_CREATE: 'traveler.create',
  TRAVELER_UPDATE: 'traveler.update',
  TRAVELER_DELETE: 'traveler.delete',

  BOOKING_READ: 'booking.read',
  BOOKING_CREATE: 'booking.create',
  BOOKING_UPDATE: 'booking.update',
  BOOKING_CONFIRM: 'booking.confirm',

  OPERATIONS_READ: 'operations.read',
  DOCUMENT_GENERATE: 'document.generate',

  // Audit
  AUDIT_READ: 'audit.read',
} as const;

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

/** Metadata for each permission, used by the seeder and the permission API. */
export interface PermissionDefinition {
  key: PermissionKey;
  group: string;
  description: string;
  /** The highest scope at which this permission is normally granted. */
  defaultScope: PermissionScope;
}

const G = PermissionScope.GLOBAL;
const O = PermissionScope.ORGANIZATION;

export const PERMISSION_CATALOG: PermissionDefinition[] = [
  { key: PERMISSIONS.ORGANIZATION_READ, group: 'Organization', description: 'View organization profile & settings', defaultScope: O },
  { key: PERMISSIONS.ORGANIZATION_MANAGE, group: 'Organization', description: 'Manage organization profile, settings & lifecycle', defaultScope: O },

  { key: PERMISSIONS.DEPARTMENT_READ, group: 'Departments', description: 'View departments', defaultScope: O },
  { key: PERMISSIONS.DEPARTMENT_CREATE, group: 'Departments', description: 'Create departments', defaultScope: O },
  { key: PERMISSIONS.DEPARTMENT_UPDATE, group: 'Departments', description: 'Update departments', defaultScope: O },
  { key: PERMISSIONS.DEPARTMENT_DELETE, group: 'Departments', description: 'Delete departments', defaultScope: O },

  { key: PERMISSIONS.USER_READ, group: 'Users', description: 'View users', defaultScope: O },
  { key: PERMISSIONS.USER_CREATE, group: 'Users', description: 'Create/invite users', defaultScope: O },
  { key: PERMISSIONS.USER_UPDATE, group: 'Users', description: 'Update users', defaultScope: O },
  { key: PERMISSIONS.USER_DELETE, group: 'Users', description: 'Deactivate/delete users', defaultScope: O },

  { key: PERMISSIONS.ROLE_READ, group: 'Roles', description: 'View roles', defaultScope: O },
  { key: PERMISSIONS.ROLE_CREATE, group: 'Roles', description: 'Create roles', defaultScope: O },
  { key: PERMISSIONS.ROLE_UPDATE, group: 'Roles', description: 'Update roles & their permissions', defaultScope: O },
  { key: PERMISSIONS.ROLE_DELETE, group: 'Roles', description: 'Delete roles', defaultScope: O },
  { key: PERMISSIONS.ROLE_ASSIGN, group: 'Roles', description: 'Assign roles to users', defaultScope: O },
  { key: PERMISSIONS.PERMISSION_READ, group: 'Roles', description: 'View the permission catalog', defaultScope: O },

  { key: PERMISSIONS.INQUIRY_READ, group: 'Inquiry', description: 'View inquiries', defaultScope: O },
  { key: PERMISSIONS.INQUIRY_CREATE, group: 'Inquiry', description: 'Create inquiries', defaultScope: O },
  { key: PERMISSIONS.INQUIRY_UPDATE, group: 'Inquiry', description: 'Update inquiries', defaultScope: O },
  { key: PERMISSIONS.INQUIRY_DELETE, group: 'Inquiry', description: 'Delete inquiries', defaultScope: O },
  { key: PERMISSIONS.INQUIRY_CONVERT, group: 'Inquiry', description: 'Convert an inquiry to a lead/quote', defaultScope: O },

  { key: PERMISSIONS.LEAD_READ, group: 'Leads', description: 'View leads', defaultScope: O },
  { key: PERMISSIONS.LEAD_CREATE, group: 'Leads', description: 'Create leads', defaultScope: O },
  { key: PERMISSIONS.LEAD_UPDATE, group: 'Leads', description: 'Update leads', defaultScope: O },
  { key: PERMISSIONS.LEAD_DELETE, group: 'Leads', description: 'Delete leads', defaultScope: O },

  { key: PERMISSIONS.PROPOSAL_READ, group: 'Proposals', description: 'View proposals', defaultScope: O },
  { key: PERMISSIONS.PROPOSAL_CREATE, group: 'Proposals', description: 'Create proposals', defaultScope: O },
  { key: PERMISSIONS.PROPOSAL_UPDATE, group: 'Proposals', description: 'Update proposals', defaultScope: O },
  { key: PERMISSIONS.PROPOSAL_SEND, group: 'Proposals', description: 'Send proposals', defaultScope: O },
  { key: PERMISSIONS.PROPOSAL_ACCEPT, group: 'Proposals', description: 'Accept proposals', defaultScope: O },
  { key: PERMISSIONS.PROPOSAL_REJECT, group: 'Proposals', description: 'Reject proposals', defaultScope: O },

  { key: PERMISSIONS.FOLLOWUP_READ, group: 'Follow-ups', description: 'View follow-ups', defaultScope: O },
  { key: PERMISSIONS.FOLLOWUP_CREATE, group: 'Follow-ups', description: 'Create follow-ups', defaultScope: O },
  { key: PERMISSIONS.FOLLOWUP_UPDATE, group: 'Follow-ups', description: 'Update follow-ups', defaultScope: O },
  { key: PERMISSIONS.FOLLOWUP_DELETE, group: 'Follow-ups', description: 'Delete follow-ups', defaultScope: O },

  { key: PERMISSIONS.FULFILLMENT_READ, group: 'Fulfillments', description: 'View fulfillments', defaultScope: O },
  { key: PERMISSIONS.FULFILLMENT_CREATE, group: 'Fulfillments', description: 'Create fulfillments', defaultScope: O },
  { key: PERMISSIONS.FULFILLMENT_UPDATE, group: 'Fulfillments', description: 'Update fulfillments', defaultScope: O },

  { key: PERMISSIONS.SERVICE_READ, group: 'Service Catalog', description: 'View services', defaultScope: O },
  { key: PERMISSIONS.SERVICE_CREATE, group: 'Service Catalog', description: 'Create services', defaultScope: O },
  { key: PERMISSIONS.SERVICE_UPDATE, group: 'Service Catalog', description: 'Update services', defaultScope: O },
  { key: PERMISSIONS.SERVICE_DELETE, group: 'Service Catalog', description: 'Delete services', defaultScope: O },
  { key: PERMISSIONS.SERVICE_CATEGORY_MANAGE, group: 'Service Catalog', description: 'Manage service categories', defaultScope: O },

  { key: PERMISSIONS.HOTEL_READ, group: 'Hotel Catalog', description: 'View the hotel reference catalog', defaultScope: G },
  { key: PERMISSIONS.HOTEL_MANAGE, group: 'Hotel Catalog', description: 'Manage the hotel reference catalog', defaultScope: G },

  { key: PERMISSIONS.AGENCY_READ, group: 'Agencies', description: 'View agencies', defaultScope: O },
  { key: PERMISSIONS.AGENCY_CREATE, group: 'Agencies', description: 'Create agencies', defaultScope: O },
  { key: PERMISSIONS.AGENCY_UPDATE, group: 'Agencies', description: 'Update agencies', defaultScope: O },
  { key: PERMISSIONS.AGENCY_DELETE, group: 'Agencies', description: 'Delete agencies', defaultScope: O },

  { key: PERMISSIONS.VENDOR_READ, group: 'Vendors', description: 'View vendors', defaultScope: O },
  { key: PERMISSIONS.VENDOR_CREATE, group: 'Vendors', description: 'Create vendors', defaultScope: O },
  { key: PERMISSIONS.VENDOR_UPDATE, group: 'Vendors', description: 'Update vendors', defaultScope: O },
  { key: PERMISSIONS.VENDOR_DELETE, group: 'Vendors', description: 'Delete vendors', defaultScope: O },
  { key: PERMISSIONS.VENDOR_RATE_READ, group: 'Vendors', description: 'View vendor rates', defaultScope: O },
  { key: PERMISSIONS.VENDOR_RATE_CREATE, group: 'Vendors', description: 'Create vendor rates', defaultScope: O },
  { key: PERMISSIONS.VENDOR_RATE_UPDATE, group: 'Vendors', description: 'Update vendor rates', defaultScope: O },
  { key: PERMISSIONS.VENDOR_RATE_DELETE, group: 'Vendors', description: 'Delete vendor rates', defaultScope: O },

  { key: PERMISSIONS.PACKAGE_READ, group: 'Packages', description: 'View packages (internal costing)', defaultScope: O },
  { key: PERMISSIONS.PACKAGE_CREATE, group: 'Packages', description: 'Create packages & items', defaultScope: O },
  { key: PERMISSIONS.PACKAGE_UPDATE, group: 'Packages', description: 'Update packages & items', defaultScope: O },
  { key: PERMISSIONS.PACKAGE_DELETE, group: 'Packages', description: 'Delete packages & items', defaultScope: O },

  { key: PERMISSIONS.QUOTATION_READ, group: 'Quotations', description: 'View quotations', defaultScope: O },
  { key: PERMISSIONS.QUOTATION_CREATE, group: 'Quotations', description: 'Generate quotations from packages', defaultScope: O },
  { key: PERMISSIONS.QUOTATION_SEND, group: 'Quotations', description: 'Send quotations to customers', defaultScope: O },
  { key: PERMISSIONS.QUOTATION_ACCEPT, group: 'Quotations', description: 'Mark quotations accepted', defaultScope: O },
  { key: PERMISSIONS.QUOTATION_REJECT, group: 'Quotations', description: 'Mark quotations rejected', defaultScope: O },

  { key: PERMISSIONS.AI_USE, group: 'AI Copilot', description: 'Use the AI copilot (chat, next-action)', defaultScope: O },
  { key: PERMISSIONS.AI_APPROVE_ACTION, group: 'AI Copilot', description: 'Approve & execute AI-recommended actions', defaultScope: O },

  { key: PERMISSIONS.REPORT_READ, group: 'Reporting', description: 'View revenue pipeline & analytics', defaultScope: O },

  { key: PERMISSIONS.TRAVELER_READ, group: 'Travel Operations', description: 'View travelers on a proposal', defaultScope: O },
  { key: PERMISSIONS.TRAVELER_CREATE, group: 'Travel Operations', description: 'Add travelers to a proposal', defaultScope: O },
  { key: PERMISSIONS.TRAVELER_UPDATE, group: 'Travel Operations', description: 'Update traveler details', defaultScope: O },
  { key: PERMISSIONS.TRAVELER_DELETE, group: 'Travel Operations', description: 'Remove/cancel a traveler', defaultScope: O },
  { key: PERMISSIONS.BOOKING_READ, group: 'Travel Operations', description: 'View supplier bookings', defaultScope: O },
  { key: PERMISSIONS.BOOKING_CREATE, group: 'Travel Operations', description: 'Create supplier bookings', defaultScope: O },
  { key: PERMISSIONS.BOOKING_UPDATE, group: 'Travel Operations', description: 'Update supplier bookings & operational details', defaultScope: O },
  { key: PERMISSIONS.BOOKING_CONFIRM, group: 'Travel Operations', description: 'Confirm/fail supplier bookings', defaultScope: O },
  { key: PERMISSIONS.OPERATIONS_READ, group: 'Travel Operations', description: 'View timeline, dashboard & operational risk', defaultScope: O },
  { key: PERMISSIONS.DOCUMENT_GENERATE, group: 'Travel Operations', description: 'Generate travel documents (voucher, itinerary, manifest…)', defaultScope: O },

  { key: PERMISSIONS.AUDIT_READ, group: 'Audit', description: 'View audit logs', defaultScope: O },
];

/** Every non-wildcard permission key (the full authority an org owner holds). */
export const ALL_PERMISSION_KEYS: PermissionKey[] = PERMISSION_CATALOG.map((p) => p.key);
