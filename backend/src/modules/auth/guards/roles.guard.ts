import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { ROLES_KEY } from '../decorators/roles.decorator';
import type { AuthenticatedUser } from '../auth.types';

/**
 * Enforces `@Roles(...)` metadata against the authenticated user's role.
 * Runs after JwtAuthGuard, so `request.user` is guaranteed to be present.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) return true;

    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthenticatedUser }>();
    const user = request.user;

    // Authorization is permission-driven (see PermissionsGuard); this role gate
    // is retained for the rare cases where a coarse role check is clearer.
    const hasRole = !!user && (user.isSuperAdmin || user.roles.some((r) => requiredRoles.includes(r)));
    if (!hasRole) {
      throw new ForbiddenException('Insufficient role permissions');
    }
    return true;
  }
}
