import { IsString, IsOptional, IsDateString, IsNumber, IsEnum, IsArray, ValidateNested } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CheckInDto {
  @ApiProperty()
  @IsString()
  employeeId: string;
}

export class CheckOutDto {
  @ApiProperty()
  @IsString()
  employeeId: string;
}

export class BulkAttendanceRecordDto {
  @ApiProperty()
  @IsString()
  employeeId: string;

  @ApiProperty()
  @IsDateString()
  date: string;

  @ApiPropertyOptional({ enum: ['present', 'absent', 'late', 'half_day', 'on_leave'] })
  @IsOptional()
  @IsEnum(['present', 'absent', 'late', 'half_day', 'on_leave'])
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  hoursWorked?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class BulkAttendanceDto {
  @ApiProperty({ type: [BulkAttendanceRecordDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BulkAttendanceRecordDto)
  records: BulkAttendanceRecordDto[];
}
