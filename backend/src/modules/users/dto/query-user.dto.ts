import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsMongoId, IsOptional } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { UserStatus } from '../schemas/user.schema';

export class QueryUserDto extends PaginationDto {
  @ApiPropertyOptional({ enum: UserStatus })
  @IsEnum(UserStatus)
  @IsOptional()
  status?: UserStatus;

  @ApiPropertyOptional()
  @IsMongoId()
  @IsOptional()
  departmentId?: string;
}
