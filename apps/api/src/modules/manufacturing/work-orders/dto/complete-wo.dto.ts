import { IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class CompleteWoDto {
  @ApiProperty({ description: 'Actual quantity produced' })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  producedQty: number;
}
