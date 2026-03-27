import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SubmitWorkflowDto {
  @ApiPropertyOptional({ description: 'Definition ID for direct lookup' })
  @IsString()
  @IsOptional()
  definitionId?: string;

  @ApiProperty({ example: 'po', description: 'Used for auto-lookup if definitionId not provided' })
  @IsString()
  @IsNotEmpty()
  docType: string;

  @ApiProperty({ example: 'abc123' })
  @IsString()
  @IsNotEmpty()
  docId: string;

  @ApiProperty({ example: 'PO-20260327-0001' })
  @IsString()
  @IsNotEmpty()
  docNo: string;
}
