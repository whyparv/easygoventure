import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BaseEntity } from '../../../common/entities/base.entity';

export class HotelResponseDto extends BaseEntity {
  @ApiProperty() name!: string;
  @ApiProperty({ example: 'HOTEL' }) category!: string;
  @ApiProperty({ enum: [3, 4, 5] }) starRating!: number;
  @ApiPropertyOptional() area?: string;
  @ApiProperty() city!: string;
  @ApiProperty() country!: string;
  @ApiProperty() isActive!: boolean;

  @ApiPropertyOptional({
    enum: ['file'],
    description: 'Present only when served from the JSON fallback (database unavailable)',
  })
  source?: 'file';
}
