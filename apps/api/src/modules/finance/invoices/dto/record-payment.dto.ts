import { IsString, IsOptional, IsNumber, IsPositive, IsDateString, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum PaymentMethod {
  cash = 'cash',
  bank_transfer = 'bank_transfer',
  cheque = 'cheque',
  credit_card = 'credit_card',
}

export class RecordPaymentDto {
  @ApiProperty({ example: '2026-03-27T00:00:00.000Z' })
  @IsDateString()
  paymentDate: string;

  @ApiProperty({ example: 5250.0 })
  @IsNumber()
  @IsPositive()
  amount: number;

  @ApiProperty({ enum: PaymentMethod })
  @IsEnum(PaymentMethod)
  method: PaymentMethod;

  @ApiPropertyOptional({ example: 'TRF-20260327-001' })
  @IsOptional()
  @IsString()
  reference?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
