import { IsString, IsOptional, IsEnum, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum AccountType {
  asset = 'asset',
  liability = 'liability',
  equity = 'equity',
  revenue = 'revenue',
  expense = 'expense',
}

export class CreateAccountDto {
  @ApiProperty({ example: '1001' })
  @IsString()
  code: string;

  @ApiProperty({ example: 'Cash and Cash Equivalents' })
  @IsString()
  name: string;

  @ApiProperty({ enum: AccountType })
  @IsEnum(AccountType)
  type: AccountType;

  @ApiPropertyOptional({ example: 'Current Assets' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
