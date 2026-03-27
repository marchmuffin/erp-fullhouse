import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ResolveNcrDto {
  @ApiProperty() @IsString() rootCause: string;
  @ApiProperty() @IsString() correctiveAction: string;
}
