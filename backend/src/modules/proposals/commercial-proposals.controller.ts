import { Body, Controller, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiResponse } from '../../common/dto/api-response.dto';
import { ApiStandardResponse } from '../../common/decorators/api-standard-response.decorator';
import { ApiStandardErrors } from '../../common/decorators/api-standard-errors.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { PERMISSIONS } from '../auth/rbac/permissions';
import type { AuthenticatedUser } from '../auth/auth.types';
import { QuotationConversionService } from './quotation-conversion.service';
import { CommercialProposalsService } from './commercial-proposals.service';
import {
  FulfillmentItemResponseDto,
  ProposalLineageResponseDto,
  ReadinessResponseDto,
  UpdateFulfillmentItemDto,
} from './dto/commercial-proposal.dto';
import { ProposalResponseDto } from './dto/proposal-response.dto';

/**
 * Phase 2.1 commercial proposal endpoints — conversion, booking readiness,
 * fulfillment and lineage. Shares the `/proposals` path with the legacy controller.
 */
@ApiTags('proposals-commercial')
@ApiStandardErrors()
@Controller('proposals')
export class CommercialProposalsController {
  constructor(
    private readonly conversion: QuotationConversionService,
    private readonly commercial: CommercialProposalsService,
  ) {}

  @Post('convert/:quotationId')
  @RequirePermissions(PERMISSIONS.PROPOSAL_CREATE)
  @ApiOperation({ summary: 'Convert an ACCEPTED quotation into an executable proposal' })
  @ApiStandardResponse(ProposalResponseDto, { status: 201 })
  async convert(
    @Param('quotationId') quotationId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return new ApiResponse(
      await this.conversion.convertAcceptedQuotation(quotationId, user),
      'Quotation converted to proposal',
    );
  }

  @Post(':id/check-readiness')
  @HttpCode(200)
  @RequirePermissions(PERMISSIONS.PROPOSAL_UPDATE)
  @ApiOperation({ summary: 'Validate booking readiness (advances to READY_FOR_BOOKING)' })
  @ApiStandardResponse(ReadinessResponseDto)
  async checkReadiness(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return new ApiResponse(await this.commercial.checkReadiness(id, user));
  }

  @Post(':id/book')
  @HttpCode(200)
  @RequirePermissions(PERMISSIONS.PROPOSAL_UPDATE)
  @ApiOperation({ summary: 'Book a ready proposal (generates fulfillment items)' })
  async book(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return new ApiResponse(await this.commercial.book(id, user), 'Proposal booked');
  }

  @Get(':id/fulfillment-items')
  @RequirePermissions(PERMISSIONS.FULFILLMENT_READ)
  @ApiOperation({ summary: 'List a proposal’s fulfillment items' })
  @ApiStandardResponse(FulfillmentItemResponseDto, { array: true })
  async listItems(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return new ApiResponse(await this.commercial.listFulfillmentItems(id, user));
  }

  @Patch(':id/fulfillment-items/:itemId')
  @RequirePermissions(PERMISSIONS.FULFILLMENT_UPDATE)
  @ApiOperation({ summary: 'Update a fulfillment item status (derives proposal progress)' })
  @ApiStandardResponse(FulfillmentItemResponseDto)
  async updateItem(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateFulfillmentItemDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return new ApiResponse(await this.commercial.updateFulfillmentItem(id, itemId, dto, user), 'Item updated');
  }

  @Get(':id/lineage')
  @RequirePermissions(PERMISSIONS.PROPOSAL_READ)
  @ApiOperation({ summary: 'Full sales lineage: lead → inquiry → package → quotation → proposal' })
  @ApiStandardResponse(ProposalLineageResponseDto)
  async lineage(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return new ApiResponse(await this.commercial.getLineage(id, user));
  }
}
