import { IsOptional, IsNumber, IsString, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CloseSessionDto {
  @ApiPropertyOptional({ example: 4800 })
  @IsOptional() @IsNumber() @Min(0) @Type(() => Number)
  closingCash?: number;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  notes?: string;
}
