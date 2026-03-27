import { PartialType } from '@nestjs/swagger';
import { IsOptional, IsEnum, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { CreateEmployeeDto } from './create-employee.dto';

export class UpdateEmployeeDto extends PartialType(CreateEmployeeDto) {
  @ApiPropertyOptional({ enum: ['active', 'on_leave', 'terminated'] })
  @IsOptional()
  @IsEnum(['active', 'on_leave', 'terminated'])
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  terminateDate?: string;
}
