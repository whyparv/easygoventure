import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';

import { AppConfigModule } from './config/config.module';
import { CommonModule } from './common/common.module';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';

import { AuditModule } from './modules/audit/audit.module';
import { AuthModule } from './modules/auth/auth.module';
import { OrganizationsModule } from './modules/organizations/organizations.module';
import { DepartmentsModule } from './modules/departments/departments.module';
import { PermissionsModule } from './modules/permissions/permissions.module';
import { RolesModule } from './modules/roles/roles.module';
import { UsersModule } from './modules/users/users.module';
import { ServiceCatalogModule } from './modules/service-catalog/service-catalog.module';
import { VendorsModule } from './modules/vendors/vendors.module';
import { HotelsModule } from './modules/hotels/hotels.module';
import { InquiriesModule } from './modules/inquiries/inquiries.module';
import { PackagesModule } from './modules/packages/packages.module';
import { QuotationsModule } from './modules/quotations/quotations.module';
import { AiContextModule } from './modules/ai-context/ai-context.module';
import { ReportingModule } from './modules/reporting/reporting.module';
import { LeadsModule } from './modules/leads/leads.module';
import { ProposalsModule } from './modules/proposals/proposals.module';
import { OperationsModule } from './modules/operations/operations.module';
import { FulfillmentsModule } from './modules/fulfillments/fulfillments.module';
import { FollowupsModule } from './modules/followups/followups.module';
import { AiModule } from './modules/ai/ai.module';

@Module({
  imports: [
    // Infrastructure
    AppConfigModule,
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const app = config.get('app') as {
          env: string;
          logLevel: string;
        };
        return {
          pinoHttp: {
            level: app.logLevel,
            transport:
              app.env === 'development'
                ? { target: 'pino-pretty', options: { singleLine: true } }
                : undefined,
            redact: ['req.headers.authorization', 'req.headers.cookie'],
            autoLogging: true,
          },
        };
      },
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const t = config.get('throttle') as {
          ttl: number;
          limit: number;
        };
        return { throttlers: [{ ttl: t.ttl * 1000, limit: t.limit }] };
      },
    }),
    CommonModule,
    DatabaseModule,
    HealthModule,
    AuditModule,

    // Platform foundations (Phase 1) — tenancy, RBAC, identity
    AuthModule,
    OrganizationsModule,
    DepartmentsModule,
    PermissionsModule,
    RolesModule,
    UsersModule,

    // Catalog, vendors & inquiry domain
    ServiceCatalogModule,
    VendorsModule,
    HotelsModule,
    InquiriesModule,

    // Commercial engine (Phase 2 / 2.1): packages, pricing, quotations, conversion, reporting, AI context
    PackagesModule,
    QuotationsModule,
    ReportingModule,
    AiContextModule,

    // Existing MVP workflow (lead → proposal → fulfillment, with follow-ups + AI)
    LeadsModule,
    ProposalsModule,

    // Operations engine (Phase 3): travelers, bookings, timeline, dashboard, risk, documents
    OperationsModule,

    FulfillmentsModule,
    FollowupsModule,
    AiModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
