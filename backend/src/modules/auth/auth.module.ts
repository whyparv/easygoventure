import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { JwtModule, type JwtModuleOptions } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { SessionsRepository, PasswordResetsRepository } from './auth.repository';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { PermissionsGuard } from './guards/permissions.guard';
import { RolesGuard } from './guards/roles.guard';
import { Session, SessionSchema } from './schemas/session.schema';
import { PasswordReset, PasswordResetSchema } from './schemas/password-reset.schema';
import { Organization, OrganizationSchema } from '../organizations/schemas/organization.schema';
import { Role, RoleSchema } from '../roles/schemas/role.schema';
import { Permission, PermissionSchema } from '../permissions/schemas/permission.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { RbacBootstrapService } from './rbac/rbac-bootstrap.service';

/**
 * Authentication & authorization.
 *
 * Registers the JWT strategy and the global guard chain — in order:
 *   1. JwtAuthGuard      (authN; honours @Public())
 *   2. PermissionsGuard  (authZ; honours @RequirePermissions())
 *   3. RolesGuard        (coarse @Roles() gate, retained for compatibility)
 *
 * Every route is protected by default; opt out with @Public().
 */
@Module({
  imports: [
    UsersModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService): JwtModuleOptions => {
        const jwt = config.get('jwt') as { accessSecret: string; accessTtl: string };
        return {
          secret: jwt.accessSecret,
          signOptions: { expiresIn: jwt.accessTtl as unknown as number },
        };
      },
    }),
    MongooseModule.forFeature([
      { name: Session.name, schema: SessionSchema },
      { name: PasswordReset.name, schema: PasswordResetSchema },
      { name: Organization.name, schema: OrganizationSchema },
      { name: Role.name, schema: RoleSchema },
      { name: Permission.name, schema: PermissionSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    RbacBootstrapService,
    SessionsRepository,
    PasswordResetsRepository,
    JwtStrategy,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
  exports: [JwtModule, PassportModule, AuthService],
})
export class AuthModule {}
