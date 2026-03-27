import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SupplierService } from './supplier.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePermissions, CurrentUser, TenantSchema } from '../../../common/decorators';

@ApiTags('procurement')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller({ path: 'procurement/suppliers', version: '1' })
export class SupplierController {
  constructor(private readonly svc: SupplierService) {}

  @Get()
  @RequirePermissions('supplier:view')
  @ApiOperation({ summary: 'List suppliers' })
  findAll(@TenantSchema() schema: string, @Query('page') page = 1, @Query('perPage') perPage = 20, @Query('search') search?: string) {
    return this.svc.findAll(schema, { page: +page, perPage: +perPage, search });
  }

  @Get(':id')
  @RequirePermissions('supplier:view')
  @ApiOperation({ summary: 'Get supplier' })
  findById(@TenantSchema() schema: string, @Param('id') id: string) {
    return this.svc.findById(schema, id);
  }

  @Post()
  @RequirePermissions('supplier:create')
  @ApiOperation({ summary: 'Create supplier' })
  create(@TenantSchema() schema: string, @Body() dto: CreateSupplierDto, @CurrentUser('id') userId: string) {
    return this.svc.create(schema, dto, userId);
  }

  @Put(':id')
  @RequirePermissions('supplier:update')
  @ApiOperation({ summary: 'Update supplier' })
  update(@TenantSchema() schema: string, @Param('id') id: string, @Body() dto: CreateSupplierDto) {
    return this.svc.update(schema, id, dto);
  }

  @Delete(':id')
  @RequirePermissions('supplier:delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete supplier (soft)' })
  remove(@TenantSchema() schema: string, @Param('id') id: string) {
    return this.svc.remove(schema, id);
  }
}
