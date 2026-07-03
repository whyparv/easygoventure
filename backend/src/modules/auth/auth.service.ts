import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import type { Request } from 'express';
import { Model, Types } from 'mongoose';
import { DomainException } from '../../common/exceptions/domain.exception';
import { hashPassword, verifyPassword } from '../../common/crypto/password.util';
import { generateToken, hashToken } from '../../common/crypto/token.util';
import { AuditService } from '../audit/audit.service';
import { UsersService } from '../users/users.service';
import { UserStatus, UserDocument } from '../users/schemas/user.schema';
import { Organization, OrganizationDocument } from '../organizations/schemas/organization.schema';
import { Role, RoleDocument } from '../roles/schemas/role.schema';
import { ROLE_DEFINITIONS, SystemRole } from './rbac/system-roles';
import type { AuthenticatedUser, JwtPayload } from './auth.types';
import { SessionsRepository, PasswordResetsRepository } from './auth.repository';
import {
  ChangePasswordDto,
  ForgotPasswordDto,
  LoginDto,
  LogoutDto,
  RefreshTokenDto,
  RegisterDto,
  ResetPasswordDto,
} from './dto/auth.dto';

interface JwtSettings {
  accessSecret: string;
  accessTtl: string;
  refreshSecret: string;
  refreshTtl: string;
}
interface AuthPolicy {
  maxFailedLogins: number;
  lockoutMinutes: number;
  refreshTtlDays: number;
  resetTokenTtlMinutes: number;
}

export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  user: AuthenticatedUser;
}

@Injectable()
export class AuthService {
  private readonly jwt: JwtSettings;
  private readonly policy: AuthPolicy;

  constructor(
    private readonly config: ConfigService,
    private readonly jwtService: JwtService,
    private readonly users: UsersService,
    private readonly sessions: SessionsRepository,
    private readonly resets: PasswordResetsRepository,
    private readonly audit: AuditService,
    @InjectModel(Organization.name) private readonly orgModel: Model<OrganizationDocument>,
    @InjectModel(Role.name) private readonly roleModel: Model<RoleDocument>,
  ) {
    this.jwt = this.config.get<JwtSettings>('jwt')!;
    this.policy = this.config.get<AuthPolicy>('auth')!;
  }

  /**
   * Self-service signup: provisions a brand-new organization + its owner user
   * (ORGANIZATION_OWNER role), then logs them straight in. Public endpoint.
   */
  async register(dto: RegisterDto, req: Request): Promise<AuthResult> {
    const email = dto.email.toLowerCase().trim();
    if (await this.users.findByEmailWithSecrets(email)) {
      throw new DomainException(
        'An account with that email already exists',
        'EMAIL_IN_USE',
        HttpStatus.CONFLICT,
      );
    }

    const slug = await this.uniqueSlug(dto.organizationName);
    const org = await this.orgModel.create({
      name: dto.organizationName.trim(),
      slug,
      isActive: true,
    });

    // GUARANTEE: an owner is never created without the owner role. Provision the
    // system role on the fly if it is somehow absent, rather than ever creating a
    // permissionless owner (the roleIds:[] bug this fixes).
    const ownerRoleId = await this.ensureOwnerRoleId();

    const user = await this.users.createUser({
      organizationId: String(org._id),
      email,
      password: dto.password,
      firstName: dto.firstName.trim(),
      lastName: dto.lastName.trim(),
      roleIds: [String(ownerRoleId)],
      status: UserStatus.ACTIVE,
    });

    const result = await this.issueTokens(user, req);
    await this.audit.record({
      action: 'user.registered',
      entity: 'User',
      entityId: user.id as string,
      organizationId: org._id,
      userId: user.id as string,
      userEmail: email,
      ip: this.ipOf(req),
      userAgent: req.headers['user-agent'],
      metadata: { organizationName: org.name, slug },
    });
    return result;
  }

  /**
   * Return the ORGANIZATION_OWNER role id, upserting the system role from its
   * definition if it does not yet exist. Ensures signup always has a role to
   * assign — a new owner can never end up with `roleIds: []`.
   */
  private async ensureOwnerRoleId(): Promise<Types.ObjectId> {
    const def = ROLE_DEFINITIONS.find((r) => r.code === SystemRole.ORGANIZATION_OWNER);
    if (!def) {
      throw new DomainException(
        'Owner role definition unavailable',
        'OWNER_ROLE_UNAVAILABLE',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
    await this.roleModel.updateOne(
      { organizationId: null, code: def.code },
      {
        $set: {
          organizationId: null,
          code: def.code,
          name: def.name,
          description: def.description,
          permissions: def.permissions,
          isSystem: def.isSystem,
          isActive: true,
        },
      },
      { upsert: true },
    );
    const role = await this.roleModel
      .findOne({ organizationId: null, code: def.code })
      .lean<{ _id: Types.ObjectId }>();
    if (!role) {
      throw new DomainException(
        'Failed to provision the owner role',
        'OWNER_ROLE_UNAVAILABLE',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
    return role._id;
  }

  /** A unique, URL-safe org slug derived from the agency name (name, name-2, …). */
  private async uniqueSlug(name: string): Promise<string> {
    const base =
      name
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9-]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'org';
    let slug = base;
    let n = 1;
    while (await this.orgModel.exists({ slug })) {
      n += 1;
      slug = `${base}-${n}`;
    }
    return slug;
  }

  async login(dto: LoginDto, req: Request): Promise<AuthResult> {
    const user = await this.users.findByEmailWithSecrets(dto.email);
    if (!user) throw this.invalidCredentials();

    if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
      throw new DomainException(
        'Account is temporarily locked due to failed login attempts',
        'ACCOUNT_LOCKED',
        HttpStatus.UNAUTHORIZED,
      );
    }
    if (user.status !== UserStatus.ACTIVE) {
      throw new DomainException('Account is not active', 'ACCOUNT_INACTIVE', HttpStatus.FORBIDDEN);
    }

    if (!verifyPassword(dto.password, user.passwordHash)) {
      const { locked } = await this.users.registerFailedLogin(
        user,
        this.policy.maxFailedLogins,
        this.policy.lockoutMinutes * 60_000,
      );
      await this.audit.record({
        action: 'user.login_failed',
        entity: 'User',
        entityId: user.id as string,
        organizationId: user.organizationId,
        userEmail: user.email,
        ip: this.ipOf(req),
        userAgent: req.headers['user-agent'],
        metadata: { locked },
      });
      throw this.invalidCredentials();
    }

    await this.users.registerSuccessfulLogin(user.id as string);
    const result = await this.issueTokens(user, req);
    await this.audit.record({
      action: 'user.login',
      entity: 'User',
      entityId: user.id as string,
      organizationId: user.organizationId,
      userId: user.id as string,
      userEmail: user.email,
      ip: this.ipOf(req),
      userAgent: req.headers['user-agent'],
    });
    return result;
  }

  async refresh(dto: RefreshTokenDto, req: Request): Promise<AuthResult> {
    const payload = this.verifyRefresh(dto.refreshToken);
    const session = await this.sessions.findActiveByHash(hashToken(dto.refreshToken));
    if (!session || session.userId.toString() !== payload.sub) {
      throw new DomainException(
        'Invalid or expired refresh token',
        'INVALID_REFRESH_TOKEN',
        HttpStatus.UNAUTHORIZED,
      );
    }

    const user = await this.users.findByEmailWithSecrets(payload.email);
    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new DomainException('Account is not active', 'ACCOUNT_INACTIVE', HttpStatus.FORBIDDEN);
    }

    // Rotate: revoke the presented session, issue a fresh pair.
    await this.sessions.revokeById(session.id as string);
    return this.issueTokens(user, req);
  }

  async logout(user: AuthenticatedUser, dto: LogoutDto): Promise<void> {
    if (dto.allDevices) {
      await this.sessions.revokeAllForUser(new Types.ObjectId(user.id));
    } else if (dto.refreshToken) {
      await this.sessions.revokeByHash(hashToken(dto.refreshToken));
    }
    await this.audit.record({
      action: 'user.logout',
      entity: 'User',
      entityId: user.id,
      organizationId: user.organizationId,
      userId: user.id,
      userEmail: user.email,
    });
  }

  async forgotPassword(dto: ForgotPasswordDto): Promise<{ message: string; resetToken?: string }> {
    const user = await this.users.findByEmailWithSecrets(dto.email);
    // Always return the same message to avoid user enumeration.
    const message = 'If an account exists for that email, a reset link has been issued.';
    if (!user) return { message };

    const token = generateToken(32);
    await this.resets.invalidateAllForUser(new Types.ObjectId(user.id as string));
    await this.resets.create({
      userId: new Types.ObjectId(user.id as string),
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + this.policy.resetTokenTtlMinutes * 60_000),
    });
    await this.audit.record({
      action: 'user.password_reset_requested',
      entity: 'User',
      entityId: user.id as string,
      organizationId: user.organizationId,
      userEmail: user.email,
    });

    // Email delivery is a later phase; expose the token off-production so the
    // flow is usable end-to-end without a mailer.
    const isProd = this.config.get<{ env: string }>('app')?.env === 'production';
    return isProd ? { message } : { message, resetToken: token };
  }

  async resetPassword(dto: ResetPasswordDto): Promise<void> {
    const record = await this.resets.findValidByHash(hashToken(dto.token));
    if (!record) {
      throw new DomainException(
        'Invalid or expired reset token',
        'INVALID_RESET_TOKEN',
        HttpStatus.BAD_REQUEST,
      );
    }
    const userId = record.userId.toString();
    await this.users.setPassword(userId, hashPassword(dto.newPassword));
    await this.resets.markUsed(record.id as string);
    await this.sessions.revokeAllForUser(record.userId);
    await this.audit.record({
      action: 'user.password_reset',
      entity: 'User',
      entityId: userId,
      userId,
    });
  }

  async changePassword(actor: AuthenticatedUser, dto: ChangePasswordDto): Promise<void> {
    const user = await this.users.findByEmailWithSecrets(actor.email);
    if (!user || !verifyPassword(dto.currentPassword, user.passwordHash)) {
      throw new DomainException(
        'Current password is incorrect',
        'INVALID_CREDENTIALS',
        HttpStatus.BAD_REQUEST,
      );
    }
    await this.users.setPassword(user.id as string, hashPassword(dto.newPassword));
    await this.sessions.revokeAllForUser(new Types.ObjectId(user.id as string));
    await this.audit.record({
      action: 'user.password_changed',
      entity: 'User',
      entityId: user.id as string,
      organizationId: user.organizationId,
      userId: user.id as string,
      userEmail: user.email,
    });
  }

  // ── Helpers ────────────────────────────────────────────────────────────

  private async issueTokens(user: UserDocument, req: Request): Promise<AuthResult> {
    // Signable payload omits the reserved `iat`/`exp` claims (set via expiresIn).
    // A random `jti` guarantees every issued token is byte-unique — otherwise two
    // logins in the same second produce identical tokens and collide on the
    // session's unique refreshTokenHash index.
    const base: Omit<JwtPayload, 'iat' | 'exp' | 'type'> = {
      sub: user.id as string,
      email: user.email,
      organizationId: user.organizationId ? user.organizationId.toString() : null,
      jti: generateToken(12),
    };
    // accessTtl/refreshTtl are duration strings like "15m"; @nestjs/jwt brands
    // the expiresIn type, so cast as the existing JwtModule wiring does.
    const accessToken = this.jwtService.sign(
      { ...base, type: 'access' },
      { secret: this.jwt.accessSecret, expiresIn: this.jwt.accessTtl as unknown as number },
    );
    const refreshToken = this.jwtService.sign(
      { ...base, type: 'refresh', jti: generateToken(12) },
      { secret: this.jwt.refreshSecret, expiresIn: this.jwt.refreshTtl as unknown as number },
    );

    await this.sessions.create({
      userId: new Types.ObjectId(user.id as string),
      organizationId: user.organizationId,
      refreshTokenHash: hashToken(refreshToken),
      userAgent: req.headers['user-agent'],
      ip: this.ipOf(req),
      expiresAt: new Date(Date.now() + this.policy.refreshTtlDays * 86_400_000),
    });

    const principal = await this.users.buildPrincipal(user);
    return { accessToken, refreshToken, tokenType: 'Bearer', user: principal };
  }

  private verifyRefresh(token: string): JwtPayload {
    try {
      const payload = this.jwtService.verify<JwtPayload>(token, {
        secret: this.jwt.refreshSecret,
      });
      if (payload.type !== 'refresh') throw new Error('wrong token type');
      return payload;
    } catch {
      throw new DomainException(
        'Invalid or expired refresh token',
        'INVALID_REFRESH_TOKEN',
        HttpStatus.UNAUTHORIZED,
      );
    }
  }

  private invalidCredentials(): DomainException {
    return new DomainException(
      'Invalid email or password',
      'INVALID_CREDENTIALS',
      HttpStatus.UNAUTHORIZED,
    );
  }

  private ipOf(req: Request): string | undefined {
    const fwd = req.headers['x-forwarded-for'];
    if (typeof fwd === 'string' && fwd.length > 0) return fwd.split(',')[0].trim();
    return req.ip;
  }
}
