import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { PERMISSIONS } from '../auth/rbac/permissions';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { ApiResponse } from '../../common/dto/api-response.dto';
import { ApiStandardResponse } from '../../common/decorators/api-standard-response.decorator';
import { ApiStandardErrors } from '../../common/decorators/api-standard-errors.decorator';
import { ProposalsService } from './proposals.service';
import { CreateProposalDto } from './dto/create-proposal.dto';
import { UpdateProposalDto } from './dto/update-proposal.dto';
import { QueryProposalDto } from './dto/query-proposal.dto';
import { RejectProposalDto } from './dto/reject-proposal.dto';
import { AcceptProposalResponseDto, ProposalResponseDto } from './dto/proposal-response.dto';

@ApiTags('proposals')
@ApiStandardErrors()
@Controller('proposals')
export class ProposalsController {
  constructor(private readonly proposalsService: ProposalsService) {}

  @Post()
  @RequirePermissions(PERMISSIONS.PROPOSAL_CREATE)
  @ApiOperation({ summary: 'Create a proposal for a lead (auto-generates a token)' })
  @ApiStandardResponse(ProposalResponseDto, { status: 201 })
  async create(@Body() dto: CreateProposalDto, @CurrentUser() user: AuthenticatedUser) {
    const proposal = await this.proposalsService.create(dto, user);
    return new ApiResponse(proposal, 'Proposal created');
  }

  @Get()
  @RequirePermissions(PERMISSIONS.PROPOSAL_READ)
  @ApiOperation({ summary: 'List proposals (paginated, filterable)' })
  @ApiStandardResponse(ProposalResponseDto, { paginated: true })
  findAll(@Query() query: QueryProposalDto, @CurrentUser() user: AuthenticatedUser) {
    return this.proposalsService.findAll(query, user);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.PROPOSAL_READ)
  @ApiOperation({ summary: 'Get a proposal by id' })
  @ApiStandardResponse(ProposalResponseDto)
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.proposalsService.findByIdOrThrow(id, user);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.PROPOSAL_UPDATE)
  @ApiOperation({ summary: 'Update a draft/sent proposal' })
  @ApiStandardResponse(ProposalResponseDto)
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateProposalDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const proposal = await this.proposalsService.update(id, dto, user);
    return new ApiResponse(proposal, 'Proposal updated');
  }

  @Post(':id/send')
  @HttpCode(200)
  @RequirePermissions(PERMISSIONS.PROPOSAL_SEND)
  @ApiOperation({ summary: 'Mark a proposal as sent to the client' })
  @ApiStandardResponse(ProposalResponseDto)
  async send(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    const proposal = await this.proposalsService.send(id, user);
    return new ApiResponse(proposal, 'Proposal sent');
  }

  @Post(':id/accept')
  @HttpCode(200)
  @RequirePermissions(PERMISSIONS.PROPOSAL_ACCEPT)
  @ApiOperation({ summary: 'Accept a proposal (creates a fulfillment record)' })
  @ApiStandardResponse(AcceptProposalResponseDto)
  async accept(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    const result = await this.proposalsService.accept(id, user);
    return new ApiResponse(result, 'Proposal accepted');
  }

  @Post(':id/reject')
  @HttpCode(200)
  @RequirePermissions(PERMISSIONS.PROPOSAL_REJECT)
  @ApiOperation({ summary: 'Reject a proposal' })
  @ApiStandardResponse(ProposalResponseDto)
  async reject(
    @Param('id') id: string,
    @Body() dto: RejectProposalDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const proposal = await this.proposalsService.reject(id, dto, user);
    return new ApiResponse(proposal, 'Proposal rejected');
  }
}
