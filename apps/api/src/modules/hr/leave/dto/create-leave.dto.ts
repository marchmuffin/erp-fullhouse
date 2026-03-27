import { IsString, IsOptional, IsDateString, IsNumber, IsEnum, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateLeaveDto {
  @ApiProperty()
  @IsString()
  employeeId: string;

  @ApiProperty({ enum: ['annual', 'sick', 'personal', 'unpaid'] })
  @IsEnum(['annual', 'sick', 'personal', 'unpaid'])
  leaveType: string;

  @ApiProperty()
  @IsDateString()
  startDate: string;

  @ApiProperty()
  @IsDateString()
  endDate: string;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(0.5)
  days: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;
}
