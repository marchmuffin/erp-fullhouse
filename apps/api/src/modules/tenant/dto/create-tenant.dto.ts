import {
  IsString, IsEmail, IsOptional, IsEnum, IsArray, MinLength, MaxLength, Matches,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateTenantDto {
  @ApiProperty({ example: 'ACME001', description: 'Unique tenant code (max 20 chars)' })
  @IsString()
  @MaxLength(20)
  @Matches(/^[A-Z0-9_]+$/, { message: 'Code must be uppercase alphanumeric' })
  code: string;

  @ApiProperty({ example: 'ACME Corporation' })
  @IsString()
  @MaxLength(200)
  name: string;

  @ApiProperty({ example: 'admin@acme.com' })
  @IsEmail()
  contactEmail: string;

  @ApiPropertyOptional({ example: '+886-2-12345678' })
  @IsOptional()
  @IsString()
  contactPhone?: string;

  @ApiPropertyOptional({ enum: ['starter', 'professional', 'enterprise', 'custom'] })
  @IsOptional()
  @IsEnum(['starter', 'professional', 'enterprise', 'custom'])
  plan?: string;

  @ApiPropertyOptional({ type: [String], example: ['procurement', 'sales', 'inventory'] })
  @IsOptional()
  @IsArray()
  modules?: string[];

  @ApiPropertyOptional({ example: 'TW' })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional({ example: 'Asia/Taipei' })
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiPropertyOptional({ example: 'zh-TW' })
  @IsOptional()
  @IsString()
  locale?: string;

  // Initial admin user
  @ApiProperty({ example: 'admin@acme.com' })
  @IsEmail()
  adminEmail: string;

  @ApiProperty({ example: 'Admin@123456', minLength: 8 })
  @IsString()
  @MinLength(8)
  adminPassword: string;

  @ApiPropertyOptional({ example: 'System Administrator' })
  @IsOptional()
  @IsString()
  adminName?: string;
}
