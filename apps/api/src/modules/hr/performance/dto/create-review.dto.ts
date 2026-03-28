import { IsString, IsOptional, IsInt, IsEnum, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateReviewDto {
  @ApiProperty()
  @IsString()
  employeeId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reviewerId?: string;

  @ApiProperty({ example: '2026-Q1' })
  @IsString()
  period: string;

  @ApiPropertyOptional({ enum: ['annual', 'mid_year', 'probation', 'project'], default: 'annual' })
  @IsOptional()
  @IsEnum(['annual', 'mid_year', 'probation', 'project'])
  reviewType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  goals?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  comments?: string;
}

export class CompleteReviewDto {
  @ApiProperty({ minimum: 1, maximum: 5 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  overallScore: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  comments?: string;
}

export class UpdateReviewDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reviewerId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  period?: string;

  @ApiPropertyOptional({ enum: ['annual', 'mid_year', 'probation', 'project'] })
  @IsOptional()
  @IsEnum(['annual', 'mid_year', 'probation', 'project'])
  reviewType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  goals?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  comments?: string;
}
