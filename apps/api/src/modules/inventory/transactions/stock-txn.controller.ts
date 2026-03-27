import {
  Controller, Get, Post, Body, Query, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { StockTxnService } from './stock-txn.service';
import { StockTxnDto, AdjustTxnDto } from './dto/stock-txn.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePermissions, TenantSchema, CurrentUser } from '../../../common/decorators';

@ApiTags('inventory')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller({ path: 'inventory/transactions', version: '1' })
export class StockTxnController {
  constructor(private readonly svc: StockTxnService) {}

  @Get()
  @RequirePermissions('txn:view')
  @ApiOperation({ summary: 'List stock transactions' })
  findAll(
    @TenantSchema() schema: string,
    @Query('page') page = 1,
    @Query('perPage') perPage = 20,
    @Query('itemId') itemId?: string,
    @Query('warehouseId') warehouseId?: string,
    @Query('txnType') txnType?: string,
  ) {
    return this.svc.findAll(schema, {
      page: +page,
      perPage: +perPage,
      itemId,
      warehouseId,
      txnType,
    });
  }

  @Post('receive')
  @RequirePermissions('txn:create')
  @ApiOperation({ summary: 'Goods receipt — add stock' })
  receive(
    @TenantSchema() schema: string,
    @Body() dto: StockTxnDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.svc.receive(schema, dto, userId);
  }

  @Post('issue')
  @RequirePermissions('txn:create')
  @ApiOperation({ summary: 'Goods issue — deduct stock' })
  issue(
    @TenantSchema() schema: string,
    @Body() dto: StockTxnDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.svc.issue(schema, dto, userId);
  }

  @Post('adjust')
  @RequirePermissions('txn:create')
  @ApiOperation({ summary: 'Stock adjustment — set to specific quantity' })
  adjust(
    @TenantSchema() schema: string,
    @Body() dto: AdjustTxnDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.svc.adjust(schema, dto, userId);
  }
}
