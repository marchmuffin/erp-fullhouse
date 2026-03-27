import { IsString, IsNotEmpty, IsOptional, IsInt, Min, Max, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateDefinitionDto {
  @ApiProperty({ example: 'WF-PO-001' })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiProperty({ example: '採購單審核流程' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'procurement', enum: ['sales', 'procurement', 'hr', 'finance', 'manufacturing', 'quality'] })
  @IsString()
  @IsNotEmpty()
  module: string;

  @ApiProperty({ example: 'po', enum: ['so', 'po', 'pr', 'leave', 'payroll', 'wo', 'inspection'] })
  @IsString()
  @IsNotEmpty()
  docType: string;

  @ApiPropertyOptional({ example: 2, minimum: 1, maximum: 5 })
  @IsInt()
  @Min(1)
  @Max(5)
  @IsOptional()
  steps?: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
