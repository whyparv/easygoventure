import { ApiProperty } from '@nestjs/swagger';
import { ArrayUnique, IsArray, IsMongoId } from 'class-validator';

export class AssignRolesDto {
  @ApiProperty({ type: [String], description: 'The complete set of role ids for the user' })
  @IsArray()
  @ArrayUnique()
  @IsMongoId({ each: true })
  roleIds!: string[];
}
