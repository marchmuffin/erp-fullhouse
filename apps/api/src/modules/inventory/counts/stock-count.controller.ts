import {
  Controller, Get, Post, Patch, Body, Param, Query, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { StockCountService } from './stock-count.service';
import { CreateCountDto, UpdateCountLineDto } from './dto/create-count.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePermissions, TenantSchema, CurrentUser } from '../../../common/decorators';

@ApiTags('inventory')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller({ path: 'inventory/counts', version: '1' })
export class StockCountController {
  constructor(private readonly svc: StockCountService) {}

  @Get()
  @RequirePermissions('count:view')
  @ApiOperation({ summary: 'List stock counts' })
  findAll(
    @TenantSchema() schema: string,
    @Query('page') page = 1,
    @Query('perPage') perPage = 20,
    @Query('warehouseId') warehouseId?: string,
    @Query('status') status?: string,
  ) {
    return this.svc.findAll(schema, { page: +page, perPage: +perPage, warehouseId, status });
  }

  @Get(':id')
  @RequirePermissions('count:view')
  @ApiOperation({ summary: 'Get stock count by ID (with lines and items)' })
  findById(@TenantSchema() schema: string, @Param('id') id: string) {
    return this.svc.findById(schema, id);
  }

  @Post()
  @RequirePermissions('count:create')
  @ApiOperation({ summary: 'Create stock count (auto-populates lines from current stock levels)' })
  create(
    @TenantSchema() schema: string,
    @Body() dto: CreateCountDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.svc.create(schema, dto, userId);
  }

  @Patch(':id/lines/:lineId')
  @RequirePermissions('count:create')
  @ApiOperation({ summary: 'Update a count line with actual counted quantity' })
  updateLine(
    @TenantSchema() schema: string,
    @Param('id') countId: string,
    @Param('lineId') lineId: string,
    @Body() dto: UpdateCountLineDto,
  ) {
    return this.svc.updateLine(schema, countId, lineId, dto.countedQty, dto.notes);
  }

  @Patch(':id/complete')
  @RequirePermissions('count:complete')
  @ApiOperation({ summary: 'Complete stock count and post variance adjustments' })
  complete(
    @TenantSchema() schema: string,
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.svc.complete(schema, id, userId);
  }
}
