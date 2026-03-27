import {
  IsString, IsOptional, IsNumber, IsBoolean, MaxLength, Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateItemDto {
  @ApiProperty({ example: 'ITEM001' })
  @IsString() @MaxLength(50)
  code: string;

  @ApiProperty({ example: 'Widget A' })
  @IsString() @MaxLength(200)
  name: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 'Raw Material' })
  @IsOptional() @IsString() @MaxLength(100)
  category?: string;

  @ApiPropertyOptional({ example: 'PCS' })
  @IsOptional() @IsString() @MaxLength(20)
  unit?: string;

  @ApiPropertyOptional({ example: 10.5 })
  @IsOptional() @IsNumber() @Min(0) @Type(() => Number)
  unitCost?: number;

  @ApiPropertyOptional({ example: 100 })
  @IsOptional() @IsNumber() @Min(0) @Type(() => Number)
  safetyStock?: number;

  @ApiPropertyOptional({ example: 50 })
  @IsOptional() @IsNumber() @Min(0) @Type(() => Number)
  reorderPoint?: number;

  @ApiPropertyOptional()
  @IsOptional() @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  notes?: string;
}
