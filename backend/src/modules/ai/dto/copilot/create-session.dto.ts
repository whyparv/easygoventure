import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateSessionDto {
  @ApiPropertyOptional() @IsString() @IsOptional() @MaxLength(200) title?: string;

  @ApiPropertyOptional({ example: 'Inquiry', description: 'Context entity type' })
  @IsString()
  @IsOptional()
  contextType?: string;

  @ApiPropertyOptional({ description: 'Context entity id' })
  @IsString()
  @IsOptional()
  contextId?: string;

  @ApiPropertyOptional({ type: Object, description: 'Snapshot of the record for grounding' })
  @IsObject()
  @IsOptional()
  contextSnapshot?: Record<string, unknown>;
}
