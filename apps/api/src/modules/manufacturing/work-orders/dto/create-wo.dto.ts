import { IsString, IsOptional, IsArray, ValidateNested, IsNumber, Min, IsDateString, ArrayMinSize } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class WoOperationDto {
  @ApiProperty({ description: 'Step number' })
  @IsNumber()
  stepNo: number;

  @ApiProperty({ description: 'Operation name' })
  @IsString()
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Planned hours' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  plannedHours?: number;
}

export class CreateWoDto {
  @ApiProperty({ example: 'WO-2024-0001' })
  @IsString()
  woNo: string;

  @ApiProperty({ description: 'Finished item ID' })
  @IsString()
  itemId: string;

  @ApiPropertyOptional({ description: 'BOM ID to use' })
  @IsOptional()
  @IsString()
  bomId?: string;

  @ApiProperty({ description: 'Planned production quantity' })
  @IsNumber()
  @Min(0.0001)
  @Type(() => Number)
  plannedQty: number;

  @ApiPropertyOptional({ description: 'Target warehouse ID for finished goods' })
  @IsOptional()
  @IsString()
  warehouseId?: string;

  @ApiPropertyOptional({ example: '2024-12-01T08:00:00Z' })
  @IsOptional()
  @IsDateString()
  plannedStart?: string;

  @ApiPropertyOptional({ example: '2024-12-05T17:00:00Z' })
  @IsOptional()
  @IsDateString()
  plannedEnd?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ type: [WoOperationDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WoOperationDto)
  operations?: WoOperationDto[];
}
