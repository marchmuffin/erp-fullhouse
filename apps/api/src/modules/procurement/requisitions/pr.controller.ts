import { Controller, Get, Post, Body, Param, Query, Patch, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PurchaseRequisitionService } from './pr.service';
import { CreatePRDto } from './dto/create-pr.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePermissions, CurrentUser, TenantSchema } from '../../../common/decorators';

@ApiTags('procurement')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller({ path: 'procurement/requisitions', version: '1' })
export class PurchaseRequisitionController {
  constructor(private readonly svc: PurchaseRequisitionService) {}

  @Get()
  @RequirePermissions('pr:view')
  @ApiOperation({ summary: 'List purchase requisitions' })
  findAll(@TenantSchema() schema: string, @Query('page') page = 1, @Query('perPage') perPage = 20, @Query('search') search?: string, @Query('status') status?: string) {
    return this.svc.findAll(schema, { page: +page, perPage: +perPage, search, status });
  }

  @Get(':id')
  @RequirePermissions('pr:view')
  @ApiOperation({ summary: 'Get PR by ID' })
  findById(@TenantSchema() schema: string, @Param('id') id: string) {
    return this.svc.findById(schema, id);
  }

  @Post()
  @RequirePermissions('pr:create')
  @ApiOperation({ summary: 'Create PR' })
  create(@TenantSchema() schema: string, @Body() dto: CreatePRDto, @CurrentUser('id') userId: string) {
    return this.svc.create(schema, dto, userId);
  }

  @Patch(':id/submit')
  @RequirePermissions('pr:create')
  @ApiOperation({ summary: 'Submit PR for approval' })
  submit(@TenantSchema() schema: string, @Param('id') id: string) {
    return this.svc.submit(schema, id);
  }

  @Patch(':id/approve')
  @RequirePermissions('pr:approve')
  @ApiOperation({ summary: 'Approve PR' })
  approve(@TenantSchema() schema: string, @Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.svc.approve(schema, id, userId);
  }

  @Patch(':id/reject')
  @RequirePermissions('pr:approve')
  @ApiOperation({ summary: 'Reject PR' })
  reject(@TenantSchema() schema: string, @Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.svc.reject(schema, id, userId);
  }

  @Patch(':id/cancel')
  @RequirePermissions('pr:create')
  @ApiOperation({ summary: 'Cancel PR' })
  cancel(@TenantSchema() schema: string, @Param('id') id: string) {
    return this.svc.cancel(schema, id);
  }
}
