import { IsString, IsOptional, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateMrpDto {
  planningDate: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  horizon?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
