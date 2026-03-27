import { IsEnum, IsString, IsOptional, IsNumber, IsArray, ValidateNested, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class ChecklistItemDto {
  @ApiProperty() @IsInt() @Min(1) itemNo: number;
  @ApiProperty() @IsString() checkPoint: string;
  @ApiPropertyOptional() @IsOptional() @IsString() criteria?: string;
}

export class CreateInspectionDto {
  @ApiProperty({ enum: ['incoming', 'in_process', 'outgoing'] })
  @IsEnum(['incoming', 'in_process', 'outgoing'])
  type: string;

  @ApiPropertyOptional() @IsOptional() @IsString() refDocType?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() refDocId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() refDocNo?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() itemId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() itemName?: string;

  @ApiProperty() @IsNumber() @Min(0) quantity: number;

  @ApiPropertyOptional() @IsOptional() @IsString() inspector?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;

  @ApiPropertyOptional({ type: [ChecklistItemDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChecklistItemDto)
  checklistItems?: ChecklistItemDto[];
}
