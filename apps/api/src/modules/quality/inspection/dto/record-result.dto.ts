import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RecordResultDto {
  @ApiProperty({ enum: ['pass', 'fail', 'conditional'] })
  @IsEnum(['pass', 'fail', 'conditional'])
  result: string;

  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
}
