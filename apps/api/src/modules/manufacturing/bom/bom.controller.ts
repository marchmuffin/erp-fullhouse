import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { BomService } from './bom.service';
import { CreateBomDto } from './dto/create-bom.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePermissions, CurrentUser, TenantSchema } from '../../../common/decorators';

@ApiTags('manufacturing')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller({ path: 'manufacturing/boms', version: '1' })
export class BomController {
  constructor(private readonly svc: BomService) {}

  @Get()
  @RequirePermissions('bom:view')
  @ApiOperation({ summary: 'List BOMs' })
  findAll(
    @TenantSchema() schema: string,
    @Query('page') page = 1,
    @Query('perPage') perPage = 20,
    @Query('search') search?: string,
    @Query('itemId') itemId?: string,
  ) {
    return this.svc.findAll(schema, { page: +page, perPage: +perPage, search, itemId });
  }

  @Get(':id')
  @RequirePermissions('bom:view')
  @ApiOperation({ summary: 'Get BOM by ID' })
  findById(@TenantSchema() schema: string, @Param('id') id: string) {
    return this.svc.findById(schema, id);
  }

  @Post()
  @RequirePermissions('bom:create')
  @ApiOperation({ summary: 'Create BOM' })
  create(@TenantSchema() schema: string, @Body() dto: CreateBomDto) {
    return this.svc.create(schema, dto);
  }

  @Put(':id')
  @RequirePermissions('bom:update')
  @ApiOperation({ summary: 'Update BOM header and lines' })
  update(@TenantSchema() schema: string, @Param('id') id: string, @Body() dto: Partial<CreateBomDto>) {
    return this.svc.update(schema, id, dto);
  }

  @Delete(':id')
  @RequirePermissions('bom:delete')
  @ApiOperation({ summary: 'Deactivate BOM (soft delete)' })
  remove(@TenantSchema() schema: string, @Param('id') id: string) {
    return this.svc.remove(schema, id);
  }
}
