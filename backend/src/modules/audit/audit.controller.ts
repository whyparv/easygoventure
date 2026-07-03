import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiStandardResponse } from '../../common/decorators/api-standard-response.decorator';
import { ApiStandardErrors } from '../../common/decorators/api-standard-errors.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { PERMISSIONS } from '../auth/rbac/permissions';
import type { AuthenticatedUser } from '../auth/auth.types';
import { AuditService } from './audit.service';
import { QueryAuditDto } from './dto/query-audit.dto';
import { AuditLogResponseDto } from './dto/audit-log-response.dto';

@ApiTags('audit')
@ApiStandardErrors()
@Controller('audit-logs')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.AUDIT_READ)
  @ApiOperation({ summary: 'List audit logs (scoped to your organization)' })
  @ApiStandardResponse(AuditLogResponseDto, { paginated: true })
  findAll(@Query() query: QueryAuditDto, @CurrentUser() user: AuthenticatedUser) {
    // SUPER_ADMIN sees the platform-wide trail; everyone else is hard-scoped to
    // their own organization by the service (via the shared tenant filter).
    return this.auditService.findAll(query, user);
  }
}
