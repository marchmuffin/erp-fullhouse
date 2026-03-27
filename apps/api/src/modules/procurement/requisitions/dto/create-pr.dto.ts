import { IsString, IsDateString, IsOptional, IsArray, ValidateNested, IsNumber, Min, MaxLength, ArrayMinSize } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PRLineDto {
  @ApiProperty({ example: 1 }) @IsNumber() lineNo: number;
  @ApiProperty({ example: 'RAW-001' }) @IsString() @MaxLength(30) itemCode: string;
  @ApiProperty({ example: 'Steel Plate' }) @IsString() @MaxLength(200) itemName: string;
  @ApiPropertyOptional() @IsOptional() @IsString() spec?: string;
  @ApiProperty({ example: 'KG' }) @IsString() @MaxLength(20) unit: string;
  @ApiProperty({ example: 500 }) @IsNumber() @Min(0.0001) @Type(() => Number) quantity: number;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
}

export class CreatePRDto {
  @ApiProperty({ example: 'PR-2024-0001' }) @IsString() @MaxLength(30) prNo: string;
  @ApiProperty({ example: '2024-12-01' }) @IsDateString() requestDate: string;
  @ApiPropertyOptional({ example: '2024-12-15' }) @IsOptional() @IsDateString() requiredDate?: string;
  @ApiPropertyOptional({ example: 'Production' }) @IsOptional() @IsString() @MaxLength(100) department?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() purpose?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
  @ApiProperty({ type: [PRLineDto] }) @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => PRLineDto) lines: PRLineDto[];
}
