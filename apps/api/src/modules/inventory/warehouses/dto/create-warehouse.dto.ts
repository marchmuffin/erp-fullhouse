import { IsString, IsOptional, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateWarehouseDto {
  @ApiProperty({ example: 'WH001' })
  @IsString() @MaxLength(20)
  code: string;

  @ApiProperty({ example: 'Main Warehouse' })
  @IsString() @MaxLength(200)
  name: string;

  @ApiPropertyOptional({ example: 'Building A, Floor 1' })
  @IsOptional() @IsString()
  location?: string;
}
