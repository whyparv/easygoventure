import { Controller, Get, Param } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiResponse } from '../../common/dto/api-response.dto';
import { ApiStandardErrors } from '../../common/decorators/api-standard-errors.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { PERMISSIONS } from '../auth/rbac/permissions';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CommercialContextService } from './commercial-context.service';
import { SalesContextService } from './sales-context.service';
import { OperationsContextService } from '../operations/operations-context.service';

/**
 * Read-only commercial context for AI grounding. Returns structured context +
 * a compact summary the client can pass to the existing /ai/chat as `context`.
 * No pricing, writes, or approvals — infrastructure only.
 */
@ApiTags('ai-context')
@ApiStandardErrors()
@Controller('ai-context')
export class CommercialContextController {
  constructor(
    private readonly context: CommercialContextService,
    private readonly salesContext: SalesContextService,
    private readonly operationsContext: OperationsContextService,
  ) {}

  @Get('inquiry/:id')
  @RequirePermissions(PERMISSIONS.AI_USE, PERMISSIONS.INQUIRY_READ)
  @ApiOperation({ summary: 'Assemble AI context for an inquiry' })
  async forInquiry(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return new ApiResponse(await this.context.forInquiry(id, user));
  }

  @Get('package/:id')
  @RequirePermissions(PERMISSIONS.AI_USE, PERMISSIONS.PACKAGE_READ)
  @ApiOperation({ summary: 'Assemble AI context for a package (costing + margin)' })
  async forPackage(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return new ApiResponse(await this.context.forPackage(id, user));
  }

  @Get('quotation/:id')
  @RequirePermissions(PERMISSIONS.AI_USE, PERMISSIONS.QUOTATION_READ)
  @ApiOperation({ summary: 'Assemble AI context for a quotation (frozen snapshot)' })
  async forQuotation(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return new ApiResponse(await this.context.forQuotation(id, user));
  }

  @Get('proposal/:id')
  @RequirePermissions(PERMISSIONS.AI_USE, PERMISSIONS.PROPOSAL_READ)
  @ApiOperation({ summary: 'Assemble AI sales context for a proposal (acceptance, readiness, fulfillment, lineage)' })
  async forProposal(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return new ApiResponse(await this.salesContext.forProposal(id, user));
  }

  @Get('operations/:id')
  @RequirePermissions(PERMISSIONS.AI_USE, PERMISSIONS.OPERATIONS_READ)
  @ApiOperation({ summary: 'Assemble AI operations context for a proposal (travelers, bookings, timeline, risk)' })
  async forOperations(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return new ApiResponse(await this.operationsContext.forProposal(id, user));
  }
}
