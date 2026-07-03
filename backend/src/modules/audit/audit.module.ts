import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuditController } from './audit.controller';
import { AuditService } from './audit.service';
import { AuditRepository } from './audit.repository';
import { AuditLog, AuditLogSchema } from './schemas/audit-log.schema';

/**
 * Audit framework. Marked @Global so any module can inject AuditService without
 * re-importing it — the audit trail is a cross-cutting concern.
 */
@Global()
@Module({
  imports: [MongooseModule.forFeature([{ name: AuditLog.name, schema: AuditLogSchema }])],
  controllers: [AuditController],
  providers: [AuditService, AuditRepository],
  exports: [AuditService],
})
export class AuditModule {}
