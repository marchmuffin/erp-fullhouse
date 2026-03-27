import {
  Controller, Get, Post, Put, Delete, Body, Param, Query,
  UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { WarehouseService } from './warehouse.service';
import { CreateWarehouseDto } from './dto/create-warehouse.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePermissions, TenantSchema } from '../../../common/decorators';

@ApiTags('inventory')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller({ path: 'inventory/warehouses', version: '1' })
export class WarehouseController {
  constructor(private readonly svc: WarehouseService) {}

  @Get()
  @RequirePermissions('warehouse:view')
  @ApiOperation({ summary: 'List warehouses' })
  findAll(
    @TenantSchema() schema: string,
    @Query('page') page = 1,
    @Query('perPage') perPage = 20,
    @Query('search') search?: string,
  ) {
    return this.svc.findAll(schema, { page: +page, perPage: +perPage, search });
  }

  @Get(':id')
  @RequirePermissions('warehouse:view')
  @ApiOperation({ summary: 'Get warehouse by ID (with stock levels)' })
  findById(@TenantSchema() schema: string, @Param('id') id: string) {
    return this.svc.findById(schema, id);
  }

  @Post()
  @RequirePermissions('warehouse:create')
  @ApiOperation({ summary: 'Create warehouse' })
  create(@TenantSchema() schema: string, @Body() dto: CreateWarehouseDto) {
    return this.svc.create(schema, dto);
  }

  @Put(':id')
  @RequirePermissions('warehouse:update')
  @ApiOperation({ summary: 'Update warehouse' })
  update(
    @TenantSchema() schema: string,
    @Param('id') id: string,
    @Body() dto: CreateWarehouseDto,
  ) {
    return this.svc.update(schema, id, dto);
  }

  @Delete(':id')
  @RequirePermissions('warehouse:delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Deactivate warehouse (soft delete)' })
  remove(@TenantSchema() schema: string, @Param('id') id: string) {
    return this.svc.remove(schema, id);
  }
}
