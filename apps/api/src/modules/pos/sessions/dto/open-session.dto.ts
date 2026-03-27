import { IsString, IsOptional, IsNumber, Min, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class OpenSessionDto {
  @ApiProperty({ example: '王小明' })
  @IsString() @MaxLength(100)
  cashierName: string;

  @ApiPropertyOptional({ example: 5000 })
  @IsOptional() @IsNumber() @Min(0) @Type(() => Number)
  openingCash?: number;
}
