import {
  IsString,
  IsOptional,
  IsArray,
  IsNumber,
  IsPositive,
  ValidateNested,
  IsDateString,
  IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum InvoiceType {
  ar = 'ar',
  ap = 'ap',
}

export class CreateInvoiceLineDto {
  @ApiProperty({ example: 1 })
  @IsNumber()
  @IsPositive()
  lineNo: number;

  @ApiProperty({ example: 'Professional services — March 2026' })
  @IsString()
  description: string;

  @ApiProperty({ example: 10 })
  @IsNumber()
  @IsPositive()
  quantity: number;

  @ApiProperty({ example: 500.0 })
  @IsNumber()
  @IsPositive()
  unitPrice: number;
}

export class CreateInvoiceDto {
  @ApiProperty({ enum: InvoiceType, description: 'ar = accounts receivable, ap = accounts payable' })
  @IsEnum(InvoiceType)
  type: InvoiceType;

  @ApiProperty({ example: 'cust-abc123', description: 'Customer or supplier ID' })
  @IsString()
  partyId: string;

  @ApiProperty({ example: 'Acme Corp' })
  @IsString()
  partyName: string;

  @ApiProperty({ example: '2026-03-27T00:00:00.000Z' })
  @IsDateString()
  invoiceDate: string;

  @ApiProperty({ example: '2026-04-26T00:00:00.000Z' })
  @IsDateString()
  dueDate: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  refDocType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  refDocId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  refDocNo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({ type: [CreateInvoiceLineDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateInvoiceLineDto)
  lines: CreateInvoiceLineDto[];
}
