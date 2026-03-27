import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { GoodsReceiptService } from './gr.service';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePermissions, CurrentUser, TenantSchema } from '../../../common/decorators';

@ApiTags('procurement')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller({ path: 'procurement/orders/:poId/receipts', version: '1' })
export class GoodsReceiptController {
  constructor(private readonly svc: GoodsReceiptService) {}

  @Get()
  @RequirePermissions('po:view')
  @ApiOperation({ summary: 'List goods receipts for a PO' })
  findByPO(@TenantSchema() schema: string, @Param('poId') poId: string) {
    return this.svc.findByPO(schema, poId);
  }

  @Post()
  @RequirePermissions('po:update')
  @ApiOperation({ summary: 'Create goods receipt' })
  create(
    @TenantSchema() schema: string,
    @Param('poId') poId: string,
    @Body() data: {
      grNo: string; receiveDate: string; notes?: string;
      lines: { poLineId: string; lineNo: number; itemCode: string; itemName: string; unit: string; orderedQty: number; receivedQty: number; notes?: string }[];
    },
    @CurrentUser('id') userId: string,
  ) {
    return this.svc.create(schema, poId, data, userId);
  }
}
