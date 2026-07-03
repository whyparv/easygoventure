import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsObject, IsOptional } from 'class-validator';

export class ExecutedActionDto {
  @ApiPropertyOptional({ default: true, description: 'Whether the client executed it successfully' })
  @IsBoolean()
  @IsOptional()
  success?: boolean;

  @ApiPropertyOptional({ type: Object, description: 'Execution result (e.g. created record id)' })
  @IsObject()
  @IsOptional()
  result?: Record<string, unknown>;
}
