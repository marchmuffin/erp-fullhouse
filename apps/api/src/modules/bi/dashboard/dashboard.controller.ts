import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePermissions, TenantSchema } from '../../../common/decorators';

@ApiTags('bi')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller({ path: 'bi', version: '1' })
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('summary/sales')
  @RequirePermissions('bi:view')
  @ApiOperation({ summary: 'Get sales summary KPIs' })
  getSalesSummary(@TenantSchema() schema: string) {
    return this.dashboardService.getSalesSummary(schema);
  }

  @Get('summary/procurement')
  @RequirePermissions('bi:view')
  @ApiOperation({ summary: 'Get procurement summary KPIs' })
  getProcurementSummary(@TenantSchema() schema: string) {
    return this.dashboardService.getProcurementSummary(schema);
  }

  @Get('summary/inventory')
  @RequirePermissions('bi:view')
  @ApiOperation({ summary: 'Get inventory summary KPIs' })
  getInventorySummary(@TenantSchema() schema: string) {
    return this.dashboardService.getInventorySummary(schema);
  }

  @Get('summary/finance')
  @RequirePermissions('bi:view')
  @ApiOperation({ summary: 'Get finance summary KPIs' })
  getFinanceSummary(@TenantSchema() schema: string) {
    return this.dashboardService.getFinanceSummary(schema);
  }

  @Get('summary/hr')
  @RequirePermissions('bi:view')
  @ApiOperation({ summary: 'Get HR summary KPIs' })
  getHrSummary(@TenantSchema() schema: string) {
    return this.dashboardService.getHrSummary(schema);
  }

  @Get('charts/monthly-sales')
  @RequirePermissions('bi:view')
  @ApiOperation({ summary: 'Get monthly sales trend (last 6 months)' })
  getMonthlySalesTrend(@TenantSchema() schema: string) {
    return this.dashboardService.getMonthlySalesTrend(schema);
  }

  @Get('charts/top-customers')
  @RequirePermissions('bi:view')
  @ApiOperation({ summary: 'Get top 5 customers by order value this year' })
  getTopCustomers(@TenantSchema() schema: string) {
    return this.dashboardService.getTopCustomers(schema);
  }

  @Get('charts/orders-by-status')
  @RequirePermissions('bi:view')
  @ApiOperation({ summary: 'Get sales order count grouped by status' })
  getOrdersByStatus(@TenantSchema() schema: string) {
    return this.dashboardService.getOrdersByStatus(schema);
  }
}
