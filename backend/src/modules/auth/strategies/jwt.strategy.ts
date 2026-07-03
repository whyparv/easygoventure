import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UsersService } from '../../users/users.service';
import type { AuthenticatedUser, JwtPayload } from '../auth.types';

/**
 * Validates access tokens and resolves the request principal.
 *
 * The token stays small (identity + tenant); the effective roles/permissions are
 * re-resolved from the database on every request, so role changes, lockouts and
 * deactivations take effect immediately without waiting for token expiry.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: ConfigService,
    private readonly users: UsersService,
  ) {
    const jwt = config.get('jwt') as { accessSecret: string };
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwt.accessSecret,
    });
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    if (payload.type !== 'access') {
      throw new UnauthorizedException('Invalid token type');
    }
    const principal = await this.users.getAuthenticatedUserById(payload.sub);
    if (!principal) {
      throw new UnauthorizedException('Account is no longer active');
    }
    return principal;
  }
}
