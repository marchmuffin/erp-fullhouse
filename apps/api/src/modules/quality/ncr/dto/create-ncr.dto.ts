import { IsEnum, IsString, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateNcrDto {
  @ApiPropertyOptional() @IsOptional() @IsString() inspectionOrderId?: string;

  @ApiProperty({ enum: ['minor', 'major', 'critical'] })
  @IsEnum(['minor', 'major', 'critical'])
  severity: string;

  @ApiProperty() @IsString() description: string;
}
