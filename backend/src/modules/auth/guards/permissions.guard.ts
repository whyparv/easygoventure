import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import {
  PERMISSIONS_KEY,
  PERMISSIONS_MODE_KEY,
  PermissionMode,
} from '../decorators/require-permissions.decorator';
import { WILDCARD_PERMISSION } from '../rbac/permissions';
import type { AuthenticatedUser } from '../auth.types';

/**
 * Permission-driven authorization guard.
 *
 * Runs after JwtAuthGuard (so `request.user` is populated). Routes without a
 * `@RequirePermissions()`/`@RequireAnyPermission()` annotation pass through —
 * authentication alone is sufficient for them. SUPER_ADMIN (wildcard `*`) bypasses
 * all permission checks.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const required = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const mode =
      this.reflector.getAllAndOverride<PermissionMode>(PERMISSIONS_MODE_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? 'all';

    const request = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
    const user = request.user;
    if (!user) {
      throw new ForbiddenException('Not authenticated');
    }

    const granted = new Set(user.permissions);
    if (granted.has(WILDCARD_PERMISSION)) return true;

    const has = (perm: string) => granted.has(perm);
    const ok = mode === 'any' ? required.some(has) : required.every(has);
    if (!ok) {
      throw new ForbiddenException(
        `Missing required permission${required.length > 1 ? 's' : ''}: ${required.join(', ')}`,
      );
    }
    return true;
  }
}
