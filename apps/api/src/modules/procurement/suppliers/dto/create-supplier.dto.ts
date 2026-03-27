import {
  IsString, IsEmail, IsOptional, IsNumber, IsBoolean,
  MaxLength, Min, IsIn,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateSupplierDto {
  @ApiProperty({ example: 'SUP001' })
  @IsString() @MaxLength(20)
  code: string;

  @ApiProperty({ example: 'ABC Materials Co.' })
  @IsString() @MaxLength(200)
  name: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200)
  nameEn?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20)
  taxId?: string;

  @ApiPropertyOptional({ example: 30 })
  @IsOptional() @IsNumber() @Min(0) @Type(() => Number)
  paymentTerms?: number;

  @ApiPropertyOptional({ enum: ['A', 'B', 'C', 'D'] })
  @IsOptional() @IsString() @IsIn(['A', 'B', 'C', 'D'])
  grade?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100)
  contactName?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(50)
  contactPhone?: string;

  @ApiPropertyOptional() @IsOptional() @IsEmail()
  contactEmail?: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  address?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100)
  city?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2)
  country?: string;

  @ApiPropertyOptional({ example: 'TWD' })
  @IsOptional() @IsString() @MaxLength(3)
  currency?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100)
  bankName?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(50)
  bankAccount?: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  notes?: string;
}
