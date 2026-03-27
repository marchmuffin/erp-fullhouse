import {
  Controller, Get, Post, Patch, Body, Param, Query, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { NcrService } from './ncr.service';
import { CreateNcrDto } from './dto/create-ncr.dto';
import { ResolveNcrDto } from './dto/resolve-ncr.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePermissions, CurrentUser, TenantSchema } from '../../../common/decorators';

@ApiTags('quality')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller({ path: 'quality/ncrs', version: '1' })
export class NcrController {
  constructor(private readonly svc: NcrService) {}

  @Get()
  @RequirePermissions('ncr:view')
  @ApiOperation({ summary: 'List NCRs' })
  findAll(
    @TenantSchema() schema: string,
    @Query('page') page = 1,
    @Query('perPage') perPage = 20,
    @Query('status') status?: string,
    @Query('severity') severity?: string,
    @Query('search') search?: string,
  ) {
    return this.svc.findAll(schema, { page: +page, perPage: +perPage, status, severity, search });
  }

  @Get(':id')
  @RequirePermissions('ncr:view')
  @ApiOperation({ summary: 'Get NCR' })
  findById(@TenantSchema() schema: string, @Param('id') id: string) {
    return this.svc.findById(schema, id);
  }

  @Post()
  @RequirePermissions('ncr:create')
  @ApiOperation({ summary: 'Create NCR' })
  create(
    @TenantSchema() schema: string,
    @Body() dto: CreateNcrDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.svc.create(schema, dto, userId);
  }

  @Patch(':id/in-review')
  @RequirePermissions('ncr:resolve')
  @ApiOperation({ summary: 'Mark NCR as in_review' })
  markInReview(@TenantSchema() schema: string, @Param('id') id: string) {
    return this.svc.markInReview(schema, id);
  }

  @Patch(':id/resolve')
  @RequirePermissions('ncr:resolve')
  @ApiOperation({ summary: 'Resolve NCR' })
  resolve(
    @TenantSchema() schema: string,
    @Param('id') id: string,
    @Body() dto: ResolveNcrDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.svc.resolve(schema, id, dto, userId);
  }

  @Patch(':id/close')
  @RequirePermissions('ncr:resolve')
  @ApiOperation({ summary: 'Close NCR' })
  close(@TenantSchema() schema: string, @Param('id') id: string) {
    return this.svc.close(schema, id);
  }
}
