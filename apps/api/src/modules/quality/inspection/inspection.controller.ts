import {
  Controller, Get, Post, Patch, Body, Param, Query, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { InspectionService } from './inspection.service';
import { CreateInspectionDto } from './dto/create-inspection.dto';
import { RecordResultDto } from './dto/record-result.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePermissions, CurrentUser, TenantSchema } from '../../../common/decorators';

@ApiTags('quality')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller({ path: 'quality/inspections', version: '1' })
export class InspectionController {
  constructor(private readonly svc: InspectionService) {}

  @Get()
  @RequirePermissions('inspection:view')
  @ApiOperation({ summary: 'List inspection orders' })
  findAll(
    @TenantSchema() schema: string,
    @Query('page') page = 1,
    @Query('perPage') perPage = 20,
    @Query('type') type?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    return this.svc.findAll(schema, { page: +page, perPage: +perPage, type, status, search });
  }

  @Get(':id')
  @RequirePermissions('inspection:view')
  @ApiOperation({ summary: 'Get inspection order' })
  findById(@TenantSchema() schema: string, @Param('id') id: string) {
    return this.svc.findById(schema, id);
  }

  @Post()
  @RequirePermissions('inspection:create')
  @ApiOperation({ summary: 'Create inspection order' })
  create(
    @TenantSchema() schema: string,
    @Body() dto: CreateInspectionDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.svc.create(schema, dto, userId);
  }

  @Patch(':id/start')
  @RequirePermissions('inspection:record')
  @ApiOperation({ summary: 'Start inspection (pending → in_progress)' })
  start(@TenantSchema() schema: string, @Param('id') id: string) {
    return this.svc.start(schema, id);
  }

  @Patch(':id/result')
  @RequirePermissions('inspection:record')
  @ApiOperation({ summary: 'Record inspection result' })
  recordResult(
    @TenantSchema() schema: string,
    @Param('id') id: string,
    @Body() dto: RecordResultDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.svc.recordResult(schema, id, dto, userId);
  }

  @Patch(':id/checklist/:itemId')
  @RequirePermissions('inspection:record')
  @ApiOperation({ summary: 'Update checklist item result' })
  updateChecklistItem(
    @TenantSchema() schema: string,
    @Param('id') ioId: string,
    @Param('itemId') itemId: string,
    @Body() body: { result: string; actualValue?: string; notes?: string },
  ) {
    return this.svc.updateChecklistItem(schema, ioId, itemId, body.result, body.actualValue, body.notes);
  }
}
