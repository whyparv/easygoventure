import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiResponse } from '../../common/dto/api-response.dto';
import { ApiStandardResponse } from '../../common/decorators/api-standard-response.decorator';
import { ApiStandardErrors } from '../../common/decorators/api-standard-errors.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { PERMISSIONS } from '../auth/rbac/permissions';
import { HotelsService } from './hotels.service';
import { HotelRecommendationService } from './hotel-recommendation.service';
import { QueryHotelDto } from './dto/query-hotel.dto';
import { RecommendHotelsDto } from './dto/recommend-hotels.dto';
import { HotelResponseDto } from './dto/hotel-response.dto';

@ApiTags('hotels')
@ApiStandardErrors()
@Controller('hotels')
export class HotelsController {
  constructor(
    private readonly hotelsService: HotelsService,
    private readonly recommendations: HotelRecommendationService,
  ) {}

  @Get()
  @RequirePermissions(PERMISSIONS.HOTEL_READ)
  @ApiOperation({ summary: 'List the hotel reference catalog (filter by star/area/city)' })
  @ApiStandardResponse(HotelResponseDto, { paginated: true })
  findAll(@Query() query: QueryHotelDto) {
    return this.hotelsService.findAll(query);
  }

  @Get('recommendations')
  @RequirePermissions(PERMISSIONS.HOTEL_READ)
  @ApiOperation({ summary: 'Ranked hotel recommendations by budget tier for a destination' })
  recommend(@Query() query: RecommendHotelsDto) {
    return new ApiResponse(this.recommendations.recommend(query));
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.HOTEL_READ)
  @ApiOperation({ summary: 'Get a hotel by id' })
  @ApiStandardResponse(HotelResponseDto)
  async findOne(@Param('id') id: string) {
    return new ApiResponse(await this.hotelsService.findByIdOrThrow(id));
  }
}
