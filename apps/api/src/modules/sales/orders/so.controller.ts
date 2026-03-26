import {
  Controller, Get, Post, Body, Param, Query, UseGuards,
  HttpCode, HttpStatus, Patch,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SalesOrderService } from './so.service';
import { CreateSalesOrderDto } from './dto/create-so.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePermissions, CurrentUser, TenantSchema } from '../../../common/decorators';

@ApiTags('sales')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller({ path: 'sales/orders', version: '1' })
export class SalesOrderController {
  constructor(private readonly soService: SalesOrderService) {}

  @Get()
  @RequirePermissions('so:view')
  @ApiOperation({ summary: 'List sales orders' })
  findAll(
    @TenantSchema() schema: string,
    @Query('page') page = 1,
    @Query('perPage') perPage = 20,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('customerId') customerId?: string,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
  ) {
    return this.soService.findAll(schema, {
      page: +page, perPage: +perPage, search, status, customerId, fromDate, toDate,
    });
  }

  @Get(':id')
  @RequirePermissions('so:view')
  @ApiOperation({ summary: 'Get sales order by ID' })
  findById(@TenantSchema() schema: string, @Param('id') id: string) {
    return this.soService.findById(schema, id);
  }

  @Post()
  @RequirePermissions('so:create')
  @ApiOperation({ summary: 'Create sales order' })
  create(
    @TenantSchema() schema: string,
    @Body() dto: CreateSalesOrderDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.soService.create(schema, dto, userId);
  }

  @Patch(':id/submit')
  @RequirePermissions('so:create')
  @ApiOperation({ summary: 'Submit order for approval' })
  submit(@TenantSchema() schema: string, @Param('id') id: string) {
    return this.soService.submit(schema, id);
  }

  @Patch(':id/approve')
  @RequirePermissions('so:approve')
  @ApiOperation({ summary: 'Approve a sales order' })
  approve(
    @TenantSchema() schema: string,
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.soService.approve(schema, id, userId);
  }

  @Patch(':id/cancel')
  @RequirePermissions('so:create')
  @ApiOperation({ summary: 'Cancel a sales order' })
  cancel(@TenantSchema() schema: string, @Param('id') id: string) {
    return this.soService.cancel(schema, id);
  }
}
