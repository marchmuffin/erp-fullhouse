import {
  IsString,
  IsOptional,
  IsArray,
  IsNumber,
  IsPositive,
  ValidateNested,
  IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateJeLineDto {
  @ApiProperty({ example: 1 })
  @IsNumber()
  @IsPositive()
  lineNo: number;

  @ApiPropertyOptional({ description: 'Account ID to debit' })
  @IsOptional()
  @IsString()
  debitAccountId?: string;

  @ApiPropertyOptional({ description: 'Account ID to credit' })
  @IsOptional()
  @IsString()
  creditAccountId?: string;

  @ApiProperty({ example: 1000.0 })
  @IsNumber()
  @IsPositive()
  amount: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;
}

export class CreateJeDto {
  @ApiProperty({ example: '2026-03-27T00:00:00.000Z' })
  @IsDateString()
  jeDate: string;

  @ApiProperty({ example: 'Monthly depreciation entry' })
  @IsString()
  description: string;

  @ApiPropertyOptional({ example: 'sales_order' })
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

  @ApiProperty({ type: [CreateJeLineDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateJeLineDto)
  lines: CreateJeLineDto[];
}
