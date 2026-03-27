import {
  IsString, IsOptional, IsIn, IsDateString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateActivityDto {
  @ApiProperty({ enum: ['call', 'email', 'meeting', 'note', 'task'] })
  @IsString()
  @IsIn(['call', 'email', 'meeting', 'note', 'task'])
  type: string;

  @ApiProperty({ example: 'Initial discovery call' })
  @IsString()
  subject: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  leadId?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  opportunityId?: string;

  @ApiPropertyOptional({ example: '2026-04-01T10:00:00Z' })
  @IsOptional() @IsDateString()
  scheduledAt?: string;
}
