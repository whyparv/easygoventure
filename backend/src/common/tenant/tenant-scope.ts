import { FilterQuery, Types } from 'mongoose';
import { BusinessException } from '../exceptions/app.exceptions';

/**
 * The minimal principal shape needed to scope a query to a tenant. Satisfied by
 * `AuthenticatedUser` (which carries `organizationId` + `isSuperAdmin`).
 */
export interface TenantActor {
  organizationId: string | null;
  isSuperAdmin: boolean;
}

/**
 * Mongo filter fragment that scopes a query to the actor's organization.
 *
 * - Super-admins get an empty (cross-organization) fragment.
 * - Any other actor without an organization is REJECTED — a non-super principal
 *   can never run an unscoped query, which is the core tenant-isolation guarantee.
 */
export function tenantFilter<T>(actor: TenantActor): FilterQuery<T> {
  if (actor.isSuperAdmin) return {};
  return { organizationId: requireOrganizationId(actor) };
}

/**
 * The actor's organization id as an ObjectId, for stamping newly-created records.
 * Rejects any actor (including a super-admin) that has no organization context.
 */
export function requireOrganizationId(actor: TenantActor): Types.ObjectId {
  if (!actor.organizationId) {
    throw new BusinessException('An organization context is required', 'ORGANIZATION_REQUIRED');
  }
  return new Types.ObjectId(actor.organizationId);
}
