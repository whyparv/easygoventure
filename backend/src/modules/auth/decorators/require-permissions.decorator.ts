import { applyDecorators, SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'requiredPermissions';
export const PERMISSIONS_MODE_KEY = 'requiredPermissionsMode';

export type PermissionMode = 'all' | 'any';

/**
 * Require the caller to hold permission(s) to access a route. Enforced by
 * {@link PermissionsGuard}. By default ALL listed permissions are required.
 *
 *   @RequirePermissions('lead.create')
 *   @RequirePermissions('proposal.accept', 'proposal.reject')       // needs both
 *   @RequireAnyPermission('vendor.read', 'vendor_rate.read')        // needs either
 */
export const RequirePermissions = (...permissions: string[]) =>
  applyDecorators(
    SetMetadata(PERMISSIONS_KEY, permissions),
    SetMetadata(PERMISSIONS_MODE_KEY, 'all' satisfies PermissionMode),
  );

export const RequireAnyPermission = (...permissions: string[]) =>
  applyDecorators(
    SetMetadata(PERMISSIONS_KEY, permissions),
    SetMetadata(PERMISSIONS_MODE_KEY, 'any' satisfies PermissionMode),
  );
