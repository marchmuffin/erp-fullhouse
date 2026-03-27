import { IsString, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ActWorkflowDto {
  @ApiPropertyOptional({ example: '已確認，核准通過' })
  @IsString()
  @IsOptional()
  comment?: string;
}
