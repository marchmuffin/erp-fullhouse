import { Controller, Get, Post, Body, Param, Query, Patch, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PurchaseOrderService } from './po.service';
import { CreatePODto } from './dto/create-po.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePermissions, CurrentUser, TenantSchema } from '../../../common/decorators';

@ApiTags('procurement')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller({ path: 'procurement/orders', version: '1' })
export class PurchaseOrderController {
  constructor(private readonly svc: PurchaseOrderService) {}

  @Get()
  @RequirePermissions('po:view')
  @ApiOperation({ summary: 'List purchase orders' })
  findAll(@TenantSchema() schema: string, @Query('page') page = 1, @Query('perPage') perPage = 20, @Query('search') search?: string, @Query('status') status?: string, @Query('supplierId') supplierId?: string) {
    return this.svc.findAll(schema, { page: +page, perPage: +perPage, search, status, supplierId });
  }

  @Get(':id')
  @RequirePermissions('po:view')
  @ApiOperation({ summary: 'Get PO by ID' })
  findById(@TenantSchema() schema: string, @Param('id') id: string) {
    return this.svc.findById(schema, id);
  }

  @Post()
  @RequirePermissions('po:create')
  @ApiOperation({ summary: 'Create purchase order' })
  create(@TenantSchema() schema: string, @Body() dto: CreatePODto, @CurrentUser('id') userId: string) {
    return this.svc.create(schema, dto, userId);
  }

  @Patch(':id/submit')
  @RequirePermissions('po:create')
  @ApiOperation({ summary: 'Submit PO for approval' })
  submit(@TenantSchema() schema: string, @Param('id') id: string) {
    return this.svc.submit(schema, id);
  }

  @Patch(':id/approve')
  @RequirePermissions('po:approve')
  @ApiOperation({ summary: 'Approve PO' })
  approve(@TenantSchema() schema: string, @Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.svc.approve(schema, id, userId);
  }

  @Patch(':id/cancel')
  @RequirePermissions('po:create')
  @ApiOperation({ summary: 'Cancel PO' })
  cancel(@TenantSchema() schema: string, @Param('id') id: string) {
    return this.svc.cancel(schema, id);
  }
}
