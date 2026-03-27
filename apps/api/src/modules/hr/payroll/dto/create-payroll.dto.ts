import { IsString, IsOptional, IsArray, ValidateNested, IsNumber, Min, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class PayrollItemOverrideDto {
  @ApiProperty()
  @IsString()
  employeeId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  allowances?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  deductions?: number;
}

export class CreatePayrollDto {
  @ApiProperty({ example: '2024-01' })
  @IsString()
  @Matches(/^\d{4}-\d{2}$/, { message: 'Period must be in YYYY-MM format' })
  period: string;

  @ApiPropertyOptional({ type: [PayrollItemOverrideDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PayrollItemOverrideDto)
  items?: PayrollItemOverrideDto[];
}
