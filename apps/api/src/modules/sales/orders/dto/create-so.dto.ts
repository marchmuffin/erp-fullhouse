import {
  IsString, IsDateString, IsOptional, IsArray, ValidateNested,
  IsNumber, Min, MaxLength, ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SalesOrderLineDto {
  @ApiProperty({ example: 1 })
  @IsNumber()
  lineNo: number;

  @ApiProperty({ example: 'ITEM-001' })
  @IsString()
  @MaxLength(30)
  itemCode: string;

  @ApiProperty({ example: 'Widget A' })
  @IsString()
  @MaxLength(200)
  itemName: string;

  @ApiPropertyOptional({ example: 'Red, Large' })
  @IsOptional()
  @IsString()
  spec?: string;

  @ApiProperty({ example: 'PCS' })
  @IsString()
  @MaxLength(20)
  unit: string;

  @ApiProperty({ example: 100 })
  @IsNumber()
  @Min(0.0001)
  @Type(() => Number)
  quantity: number;

  @ApiProperty({ example: 250.00 })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  unitPrice: number;

  @ApiPropertyOptional({ example: 0, description: 'Discount percentage (0-100)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  discount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateSalesOrderDto {
  @ApiProperty({ example: 'SO-2024-0001' })
  @IsString()
  @MaxLength(30)
  orderNo: string;

  @ApiProperty({ example: 'uuid-of-customer' })
  @IsString()
  customerId: string;

  @ApiProperty({ example: '2024-12-01' })
  @IsDateString()
  orderDate: string;

  @ApiPropertyOptional({ example: '2024-12-15' })
  @IsOptional()
  @IsDateString()
  requestedDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  shippingAddress?: string;

  @ApiPropertyOptional({ example: 'TWD' })
  @IsOptional()
  @IsString()
  @MaxLength(3)
  currency?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({ type: [SalesOrderLineDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SalesOrderLineDto)
  lines: SalesOrderLineDto[];
}
