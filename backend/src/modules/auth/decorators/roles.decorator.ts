import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

/**
 * Restricts a route to the given role names. Enforced by RolesGuard.
 * Usage: `@Roles('ADMIN', 'MANAGER')`
 */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
