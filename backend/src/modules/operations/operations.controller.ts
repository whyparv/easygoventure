import { Body, Controller, Get, Param, ParseEnumPipe, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiResponse } from '../../common/dto/api-response.dto';
import { ApiStandardErrors } from '../../common/decorators/api-standard-errors.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { PERMISSIONS } from '../auth/rbac/permissions';
import type { AuthenticatedUser } from '../auth/auth.types';
import { TravelTimelineService } from './travel-timeline.service';
import { OperationsDashboardService } from './operations-dashboard.service';
import { OperationalRiskService } from './operational-risk.service';
import { DocumentGenerationService } from './document-generation.service';
import { DocumentType } from './schemas/generated-document.schema';
import { GenerateDocumentDto } from './dto/booking-details.dto';

@ApiTags('operations')
@ApiStandardErrors()
@Controller()
export class OperationsController {
  constructor(
    private readonly timeline: TravelTimelineService,
    private readonly dashboard: OperationsDashboardService,
    private readonly risk: OperationalRiskService,
    private readonly documents: DocumentGenerationService,
  ) {}

  @Get('proposals/:id/timeline')
  @RequirePermissions(PERMISSIONS.OPERATIONS_READ)
  @ApiOperation({ summary: 'Derived chronological trip timeline for a proposal' })
  async getTimeline(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return new ApiResponse(await this.timeline.forProposal(id, user));
  }

  @Get('proposals/:id/risk')
  @RequirePermissions(PERMISSIONS.OPERATIONS_READ)
  @ApiOperation({ summary: 'Operational risk assessment (LOW / MEDIUM / HIGH) for a proposal' })
  async getRisk(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return new ApiResponse(await this.risk.assess(id, user));
  }

  @Get('operations/dashboard')
  @RequirePermissions(PERMISSIONS.OPERATIONS_READ)
  @ApiOperation({ summary: 'Tenant-scoped operations dashboard metrics' })
  async getDashboard(@CurrentUser() user: AuthenticatedUser) {
    return new ApiResponse(await this.dashboard.getDashboard(user));
  }

  @Get('proposals/:id/documents')
  @RequirePermissions(PERMISSIONS.OPERATIONS_READ)
  @ApiOperation({ summary: 'List generated-document metadata for a proposal' })
  async listDocuments(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return new ApiResponse(await this.documents.list(id, user));
  }

  @Post('proposals/:id/documents/:type')
  @RequirePermissions(PERMISSIONS.DOCUMENT_GENERATE)
  @ApiOperation({
    summary: 'Generate a travel document (voucher, itinerary, manifest, summary, brief)',
  })
  async generateDocument(
    @Param('id') id: string,
    @Param('type', new ParseEnumPipe(DocumentType)) type: DocumentType,
    @Body() dto: GenerateDocumentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return new ApiResponse(await this.documents.generate(id, type, dto, user), 'Document generated');
  }
}
