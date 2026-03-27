import { IsString, IsOptional, IsDateString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCountDto {
  @ApiProperty({ example: 'SC-202603-0001' })
  @IsString() @MaxLength(30)
  countNo: string;

  @ApiProperty({ example: 'warehouse-cuid-here' })
  @IsString()
  warehouseId: string;

  @ApiProperty({ example: '2026-03-27T00:00:00Z' })
  @IsDateString()
  countDate: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  notes?: string;
}

export class UpdateCountLineDto {
  @ApiProperty({ description: 'Actual counted quantity', example: 98 })
  countedQty: number;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  notes?: string;
}
