import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiResponse } from '../../common/dto/api-response.dto';
import { ApiStandardResponse } from '../../common/decorators/api-standard-response.decorator';
import { ApiStandardErrors } from '../../common/decorators/api-standard-errors.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { PERMISSIONS } from '../auth/rbac/permissions';
import type { AuthenticatedUser } from '../auth/auth.types';
import { QuotationsService } from './quotations.service';
import { GenerateQuotationDto } from './dto/generate-quotation.dto';
import { QueryQuotationDto } from './dto/query-quotation.dto';
import { QuotationResponseDto, RejectQuotationDto } from './dto/quotation-response.dto';

@ApiTags('quotations')
@ApiStandardErrors()
@Controller('quotations')
export class QuotationsController {
  constructor(private readonly quotationsService: QuotationsService) {}

  @Post('from-package/:packageId')
  @RequirePermissions(PERMISSIONS.QUOTATION_CREATE)
  @ApiOperation({ summary: 'Generate a quotation from a package (freezes an immutable snapshot)' })
  @ApiStandardResponse(QuotationResponseDto, { status: 201 })
  async generate(
    @Param('packageId') packageId: string,
    @Body() dto: GenerateQuotationDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return new ApiResponse(
      await this.quotationsService.generateFromPackage(packageId, dto, user),
      'Quotation generated',
    );
  }

  @Get()
  @RequirePermissions(PERMISSIONS.QUOTATION_READ)
  @ApiOperation({ summary: 'List quotations' })
  @ApiStandardResponse(QuotationResponseDto, { paginated: true })
  findAll(@Query() query: QueryQuotationDto, @CurrentUser() user: AuthenticatedUser) {
    return this.quotationsService.findAll(query, user);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.QUOTATION_READ)
  @ApiOperation({ summary: 'Get a quotation by id (with its frozen snapshot)' })
  @ApiStandardResponse(QuotationResponseDto)
  async findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return new ApiResponse(await this.quotationsService.findByIdOrThrow(id, user));
  }

  @Post(':id/send')
  @HttpCode(200)
  @RequirePermissions(PERMISSIONS.QUOTATION_SEND)
  @ApiOperation({ summary: 'Send a quotation to the customer' })
  @ApiStandardResponse(QuotationResponseDto)
  async send(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return new ApiResponse(await this.quotationsService.send(id, user), 'Quotation sent');
  }

  @Post(':id/accept')
  @HttpCode(200)
  @RequirePermissions(PERMISSIONS.QUOTATION_ACCEPT)
  @ApiOperation({ summary: 'Mark a quotation accepted' })
  @ApiStandardResponse(QuotationResponseDto)
  async accept(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return new ApiResponse(await this.quotationsService.accept(id, user), 'Quotation accepted');
  }

  @Post(':id/reject')
  @HttpCode(200)
  @RequirePermissions(PERMISSIONS.QUOTATION_REJECT)
  @ApiOperation({ summary: 'Mark a quotation rejected' })
  @ApiStandardResponse(QuotationResponseDto)
  async reject(
    @Param('id') id: string,
    @Body() dto: RejectQuotationDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return new ApiResponse(await this.quotationsService.reject(id, dto, user), 'Quotation rejected');
  }
}
