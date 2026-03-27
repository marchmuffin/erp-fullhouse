import {
  IsString, IsOptional, IsNumber, IsArray, ValidateNested,
  Min, MaxLength, IsIn,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class PosOrderLineDto {
  @ApiPropertyOptional({ example: 'item-cuid-123' })
  @IsOptional() @IsString()
  itemId?: string;

  @ApiProperty({ example: 'ITEM001' })
  @IsString() @MaxLength(50)
  itemCode: string;

  @ApiProperty({ example: 'Widget A' })
  @IsString() @MaxLength(200)
  itemName: string;

  @ApiProperty({ example: 2 })
  @IsNumber() @Min(0.0001) @Type(() => Number)
  quantity: number;

  @ApiProperty({ example: 150 })
  @IsNumber() @Min(0) @Type(() => Number)
  unitPrice: number;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional() @IsNumber() @Min(0) @Type(() => Number)
  discount?: number;
}

export class CreateOrderDto {
  @ApiProperty({ example: 'session-cuid-123' })
  @IsString()
  sessionId: string;

  @ApiPropertyOptional({ example: 'cash', enum: ['cash', 'card', 'mobile'] })
  @IsOptional() @IsString() @IsIn(['cash', 'card', 'mobile'])
  paymentMethod?: string;

  @ApiProperty({ example: 500 })
  @IsNumber() @Min(0) @Type(() => Number)
  paidAmount: number;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  customerId?: string;

  @ApiProperty({ type: [PosOrderLineDto] })
  @IsArray() @ValidateNested({ each: true }) @Type(() => PosOrderLineDto)
  lines: PosOrderLineDto[];
}
