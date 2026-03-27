import { IsString, IsOptional, IsNumber, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class StockTxnDto {
  @ApiProperty({ example: 'item-cuid-here' })
  @IsString()
  itemId: string;

  @ApiProperty({ example: 'warehouse-cuid-here' })
  @IsString()
  warehouseId: string;

  @ApiProperty({ example: 50 })
  @IsNumber() @Min(0.0001) @Type(() => Number)
  quantity: number;

  @ApiPropertyOptional({ example: 10.5 })
  @IsOptional() @IsNumber() @Min(0) @Type(() => Number)
  unitCost?: number;

  @ApiPropertyOptional({ example: 'PO' })
  @IsOptional() @IsString()
  refDocType?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  refDocId?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  refDocNo?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  notes?: string;
}

export class AdjustTxnDto {
  @ApiProperty({ example: 'item-cuid-here' })
  @IsString()
  itemId: string;

  @ApiProperty({ example: 'warehouse-cuid-here' })
  @IsString()
  warehouseId: string;

  @ApiProperty({ description: 'New absolute quantity to set', example: 100 })
  @IsNumber() @Min(0) @Type(() => Number)
  newQuantity: number;

  @ApiPropertyOptional({ example: 10.5 })
  @IsOptional() @IsNumber() @Min(0) @Type(() => Number)
  unitCost?: number;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  notes?: string;
}
