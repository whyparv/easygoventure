import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { SKIP_API_KEY } from '../decorators/skip-api-key.decorator';

/**
 * Minimal API-key gate for MVP/demo/staging.
 *
 * Requires the `x-api-key` header to match `API_KEY` on every route, except
 * routes marked with `@SkipApiKey()` (health) and the Swagger UI (which is
 * served outside the Nest router, so guards never see it).
 *
 * When `API_KEY` is unset the gate is disabled so local development is friction-free.
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  private readonly logger = new Logger(ApiKeyGuard.name);
  private readonly apiKey?: string;

  constructor(
    private readonly reflector: Reflector,
    config: ConfigService,
  ) {
    this.apiKey = config.get<string>('API_KEY') || undefined;
    if (!this.apiKey) {
      this.logger.warn('API_KEY is not set — the API-key gate is DISABLED (development mode).');
    }
  }

  canActivate(context: ExecutionContext): boolean {
    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_API_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skip || !this.apiKey) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const provided = request.headers['x-api-key'];

    if (typeof provided === 'string' && provided === this.apiKey) {
      return true;
    }
    throw new UnauthorizedException('Invalid or missing API key');
  }
}
