import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiResponse } from '../../common/dto/api-response.dto';
import { ApiStandardResponse } from '../../common/decorators/api-standard-response.decorator';
import { ApiStandardErrors } from '../../common/decorators/api-standard-errors.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { PERMISSIONS } from '../auth/rbac/permissions';
import type { AuthenticatedUser } from '../auth/auth.types';
import { InquiriesService } from './inquiries.service';
import { CreateInquiryDto } from './dto/create-inquiry.dto';
import { UpdateInquiryDto } from './dto/update-inquiry.dto';
import { QueryInquiryDto } from './dto/query-inquiry.dto';
import { TransitionInquiryDto } from './dto/transition-inquiry.dto';
import { DeletedResponseDto, InquiryResponseDto } from './dto/inquiry-response.dto';

@ApiTags('inquiries')
@ApiStandardErrors()
@Controller('inquiries')
export class InquiriesController {
  constructor(private readonly inquiriesService: InquiriesService) {}

  @Post()
  @RequirePermissions(PERMISSIONS.INQUIRY_CREATE)
  @ApiOperation({ summary: 'Create an inquiry (the first-class pipeline entry point)' })
  @ApiStandardResponse(InquiryResponseDto, { status: 201 })
  async create(@Body() dto: CreateInquiryDto, @CurrentUser() user: AuthenticatedUser) {
    return new ApiResponse(await this.inquiriesService.create(dto, user), 'Inquiry created');
  }

  @Get()
  @RequirePermissions(PERMISSIONS.INQUIRY_READ)
  @ApiOperation({ summary: 'List inquiries in your organization' })
  @ApiStandardResponse(InquiryResponseDto, { paginated: true })
  findAll(@Query() query: QueryInquiryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.inquiriesService.findAll(query, user);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.INQUIRY_READ)
  @ApiOperation({ summary: 'Get an inquiry by id' })
  @ApiStandardResponse(InquiryResponseDto)
  async findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return new ApiResponse(await this.inquiriesService.findByIdOrThrow(id, user));
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.INQUIRY_UPDATE)
  @ApiOperation({ summary: 'Update an inquiry' })
  @ApiStandardResponse(InquiryResponseDto)
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateInquiryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return new ApiResponse(await this.inquiriesService.update(id, dto, user), 'Inquiry updated');
  }

  @Post(':id/transition')
  @RequirePermissions(PERMISSIONS.INQUIRY_UPDATE)
  @ApiOperation({ summary: 'Move an inquiry along its lifecycle' })
  @ApiStandardResponse(InquiryResponseDto)
  async transition(
    @Param('id') id: string,
    @Body() dto: TransitionInquiryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return new ApiResponse(await this.inquiriesService.transition(id, dto, user), 'Inquiry updated');
  }

  @Post(':id/convert')
  @RequirePermissions(PERMISSIONS.INQUIRY_CONVERT)
  @ApiOperation({ summary: 'Convert an inquiry into a downstream lead' })
  async convert(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return new ApiResponse(await this.inquiriesService.convert(id, user), 'Inquiry converted to lead');
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.INQUIRY_DELETE)
  @ApiOperation({ summary: 'Delete an inquiry' })
  @ApiStandardResponse(DeletedResponseDto)
  async remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    await this.inquiriesService.remove(id, user);
    return new ApiResponse({ id }, 'Inquiry deleted');
  }
}
