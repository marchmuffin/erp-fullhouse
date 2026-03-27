import {
  IsString, IsOptional, IsIn, IsNumber, IsDateString, Min, Max,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateOpportunityDto {
  @ApiProperty({ example: 'ABC Corp CRM Implementation' })
  @IsString()
  title: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  leadId?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  customerId?: string;

  @ApiPropertyOptional({
    enum: ['prospecting', 'qualification', 'proposal', 'negotiation', 'closed_won', 'closed_lost'],
    default: 'prospecting',
  })
  @IsOptional() @IsString()
  @IsIn(['prospecting', 'qualification', 'proposal', 'negotiation', 'closed_won', 'closed_lost'])
  stage?: string;

  @ApiPropertyOptional({ example: 50, description: '0-100' })
  @IsOptional() @IsNumber() @Min(0) @Max(100) @Type(() => Number)
  probability?: number;

  @ApiPropertyOptional({ example: 500000 })
  @IsOptional() @IsNumber() @Min(0) @Type(() => Number)
  value?: number;

  @ApiPropertyOptional({ example: '2026-06-30' })
  @IsOptional() @IsDateString()
  expectedClose?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  assignedTo?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  notes?: string;
}
