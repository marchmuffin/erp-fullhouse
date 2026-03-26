import {
  Controller, Get, Post, Body, Param, Patch, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { DeliveryOrderService } from './do.service';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePermissions, CurrentUser, TenantSchema } from '../../../common/decorators';

@ApiTags('sales')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller({ path: 'sales/orders/:soId/deliveries', version: '1' })
export class DeliveryOrderController {
  constructor(private readonly doService: DeliveryOrderService) {}

  @Get()
  @RequirePermissions('so:view')
  @ApiOperation({ summary: 'List delivery orders for a sales order' })
  findBySalesOrder(@TenantSchema() schema: string, @Param('soId') soId: string) {
    return this.doService.findBySalesOrder(schema, soId);
  }

  @Post()
  @RequirePermissions('so:create')
  @ApiOperation({ summary: 'Create delivery order' })
  create(
    @TenantSchema() schema: string,
    @Param('soId') soId: string,
    @Body() data: {
      doNo: string;
      shipDate?: string;
      carrier?: string;
      trackingNo?: string;
      notes?: string;
    },
    @CurrentUser('id') userId: string,
  ) {
    return this.doService.create(schema, soId, data, userId);
  }

  @Patch(':id/ship')
  @RequirePermissions('so:create')
  @ApiOperation({ summary: 'Mark delivery order as shipped' })
  ship(@TenantSchema() schema: string, @Param('id') id: string) {
    return this.doService.ship(schema, id);
  }
}
