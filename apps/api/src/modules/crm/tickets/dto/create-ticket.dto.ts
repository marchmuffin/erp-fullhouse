import { IsString, IsOptional, IsIn } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateTicketDto {
  @ApiProperty({ example: '產品無法開機' })
  @IsString()
  title: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: ['complaint', 'inquiry', 'repair', 'return', 'other'] })
  @IsOptional() @IsString()
  @IsIn(['complaint', 'inquiry', 'repair', 'return', 'other'])
  type?: string;

  @ApiPropertyOptional({ enum: ['low', 'medium', 'high', 'urgent'] })
  @IsOptional() @IsString()
  @IsIn(['low', 'medium', 'high', 'urgent'])
  priority?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  customerId?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  leadId?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  assignedTo?: string;
}
