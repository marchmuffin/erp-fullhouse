import {
  Controller, Get, Post, Put, Delete, Body, Param, Query,
  UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ItemService } from './item.service';
import { CreateItemDto } from './dto/create-item.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePermissions, TenantSchema } from '../../../common/decorators';

@ApiTags('inventory')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller({ path: 'inventory/items', version: '1' })
export class ItemController {
  constructor(private readonly svc: ItemService) {}

  @Get()
  @RequirePermissions('item:view')
  @ApiOperation({ summary: 'List items' })
  findAll(
    @TenantSchema() schema: string,
    @Query('page') page = 1,
    @Query('perPage') perPage = 20,
    @Query('search') search?: string,
    @Query('category') category?: string,
  ) {
    return this.svc.findAll(schema, { page: +page, perPage: +perPage, search, category });
  }

  @Get('low-stock')
  @RequirePermissions('item:view')
  @ApiOperation({ summary: 'List items below safety stock' })
  findLowStock(@TenantSchema() schema: string) {
    return this.svc.findLowStock(schema);
  }

  @Get(':id')
  @RequirePermissions('item:view')
  @ApiOperation({ summary: 'Get item by ID (with stock levels)' })
  findById(@TenantSchema() schema: string, @Param('id') id: string) {
    return this.svc.findById(schema, id);
  }

  @Post()
  @RequirePermissions('item:create')
  @ApiOperation({ summary: 'Create item' })
  create(@TenantSchema() schema: string, @Body() dto: CreateItemDto) {
    return this.svc.create(schema, dto);
  }

  @Put(':id')
  @RequirePermissions('item:update')
  @ApiOperation({ summary: 'Update item' })
  update(
    @TenantSchema() schema: string,
    @Param('id') id: string,
    @Body() dto: CreateItemDto,
  ) {
    return this.svc.update(schema, id, dto);
  }

  @Delete(':id')
  @RequirePermissions('item:delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Deactivate item (soft delete)' })
  remove(@TenantSchema() schema: string, @Param('id') id: string) {
    return this.svc.remove(schema, id);
  }
}
