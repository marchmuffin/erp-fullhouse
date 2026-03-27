import { Controller, Get, Post, Body, Param, Query, Patch, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { WoService } from './wo.service';
import { CreateWoDto } from './dto/create-wo.dto';
import { CompleteWoDto } from './dto/complete-wo.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePermissions, CurrentUser, TenantSchema } from '../../../common/decorators';

@ApiTags('manufacturing')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller({ path: 'manufacturing/work-orders', version: '1' })
export class WoController {
  constructor(private readonly svc: WoService) {}

  @Get()
  @RequirePermissions('wo:view')
  @ApiOperation({ summary: 'List work orders' })
  findAll(
    @TenantSchema() schema: string,
    @Query('page') page = 1,
    @Query('perPage') perPage = 20,
    @Query('status') status?: string,
    @Query('itemId') itemId?: string,
  ) {
    return this.svc.findAll(schema, { page: +page, perPage: +perPage, status, itemId });
  }

  @Get(':id')
  @RequirePermissions('wo:view')
  @ApiOperation({ summary: 'Get work order by ID' })
  findById(@TenantSchema() schema: string, @Param('id') id: string) {
    return this.svc.findById(schema, id);
  }

  @Post()
  @RequirePermissions('wo:create')
  @ApiOperation({ summary: 'Create work order' })
  create(
    @TenantSchema() schema: string,
    @Body() dto: CreateWoDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.svc.create(schema, dto, userId);
  }

  @Patch(':id/release')
  @RequirePermissions('wo:release')
  @ApiOperation({ summary: 'Release work order (draft → released)' })
  release(@TenantSchema() schema: string, @Param('id') id: string) {
    return this.svc.release(schema, id);
  }

  @Patch(':id/start')
  @RequirePermissions('wo:release')
  @ApiOperation({ summary: 'Start work order (released → in_progress)' })
  start(@TenantSchema() schema: string, @Param('id') id: string) {
    return this.svc.start(schema, id);
  }

  @Patch(':id/complete')
  @RequirePermissions('wo:complete')
  @ApiOperation({ summary: 'Complete work order (in_progress → completed)' })
  complete(
    @TenantSchema() schema: string,
    @Param('id') id: string,
    @Body() dto: CompleteWoDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.svc.complete(schema, id, dto, userId);
  }

  @Patch(':id/cancel')
  @RequirePermissions('wo:release')
  @ApiOperation({ summary: 'Cancel work order (draft/released → cancelled)' })
  cancel(@TenantSchema() schema: string, @Param('id') id: string) {
    return this.svc.cancel(schema, id);
  }

  @Post(':id/issue-materials')
  @RequirePermissions('wo:release')
  @ApiOperation({ summary: 'Issue all pending materials to the work order' })
  issueMaterials(
    @TenantSchema() schema: string,
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.svc.issueMaterials(schema, id, userId);
  }

  @Patch(':id/operations/:opId/complete')
  @RequirePermissions('wo:complete')
  @ApiOperation({ summary: 'Complete a work order operation' })
  completeOperation(
    @TenantSchema() schema: string,
    @Param('id') id: string,
    @Param('opId') opId: string,
    @Body('actualHours') actualHours?: number,
  ) {
    return this.svc.completeOperation(schema, id, opId, actualHours ? Number(actualHours) : undefined);
  }
}
