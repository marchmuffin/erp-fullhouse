import {
  IsString, IsEmail, IsOptional, IsIn, IsNumber, Min, Max,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateLeadDto {
  @ApiProperty({ example: 'Wang Daming' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: 'ABC Corp' })
  @IsOptional() @IsString()
  company?: string;

  @ApiPropertyOptional({ example: 'wang@abc.com' })
  @IsOptional() @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: '+886-2-12345678' })
  @IsOptional() @IsString()
  phone?: string;

  @ApiPropertyOptional({ enum: ['website', 'referral', 'cold_call', 'exhibition', 'social_media'] })
  @IsOptional() @IsString()
  @IsIn(['website', 'referral', 'cold_call', 'exhibition', 'social_media'])
  source?: string;

  @ApiPropertyOptional({ example: 500000 })
  @IsOptional() @IsNumber() @Min(0) @Type(() => Number)
  estimatedValue?: number;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  assignedTo?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  notes?: string;
}
