import { IsString, IsDateString, IsOptional, IsArray, ValidateNested, IsNumber, Min, MaxLength, ArrayMinSize } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class POLineDto {
  @ApiProperty() @IsNumber() lineNo: number;
  @ApiProperty() @IsString() @MaxLength(30) itemCode: string;
  @ApiProperty() @IsString() @MaxLength(200) itemName: string;
  @ApiPropertyOptional() @IsOptional() @IsString() spec?: string;
  @ApiProperty() @IsString() @MaxLength(20) unit: string;
  @ApiProperty() @IsNumber() @Min(0.0001) @Type(() => Number) quantity: number;
  @ApiProperty() @IsNumber() @Min(0) @Type(() => Number) unitPrice: number;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
}

export class CreatePODto {
  @ApiProperty({ example: 'PO-2024-0001' }) @IsString() @MaxLength(30) poNo: string;
  @ApiProperty({ description: 'Supplier ID' }) @IsString() supplierId: string;
  @ApiPropertyOptional({ description: 'Source PR ID' }) @IsOptional() @IsString() prId?: string;
  @ApiProperty({ example: '2024-12-01' }) @IsDateString() orderDate: string;
  @ApiPropertyOptional({ example: '2024-12-20' }) @IsOptional() @IsDateString() expectedDate?: string;
  @ApiPropertyOptional({ example: 'TWD' }) @IsOptional() @IsString() @MaxLength(3) currency?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
  @ApiProperty({ type: [POLineDto] }) @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => POLineDto) lines: POLineDto[];
}
