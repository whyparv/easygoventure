import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { AuthenticatedUser } from '../auth.types';

/**
 * Extracts the authenticated user (populated by JwtStrategy) from the request.
 * Optionally pluck a single property: `@CurrentUser('id') id: string`.
 */
export const CurrentUser = createParamDecorator(
  (data: keyof AuthenticatedUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
    const user = request.user;
    if (!user) return undefined;
    return data ? user[data] : user;
  },
);
