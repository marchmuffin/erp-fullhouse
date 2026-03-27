import {
  Controller, Get, Post, Patch, Body, Param, Query,
  UseGuards, Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { OrderService } from './order.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePermissions, TenantSchema } from '../../../common/decorators';
import { IsString, IsOptional } from 'class-validator';

class VoidOrderDto {
  @IsString() @IsOptional()
  reason?: string;
}

@ApiTags('pos')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller({ path: 'pos/orders', version: '1' })
export class OrderController {
  constructor(private readonly svc: OrderService) {}

  @Get()
  @RequirePermissions('pos:view')
  @ApiOperation({ summary: 'List POS orders' })
  findAll(
    @TenantSchema() schema: string,
    @Query('page') page = 1,
    @Query('perPage') perPage = 20,
    @Query('sessionId') sessionId?: string,
    @Query('status') status?: string,
  ) {
    return this.svc.findAll(schema, { page: +page, perPage: +perPage, sessionId, status });
  }

  @Get(':id')
  @RequirePermissions('pos:view')
  @ApiOperation({ summary: 'Get POS order by ID (with lines)' })
  findById(@TenantSchema() schema: string, @Param('id') id: string) {
    return this.svc.findById(schema, id);
  }

  @Post()
  @RequirePermissions('pos:cashier')
  @ApiOperation({ summary: 'Create a new POS order' })
  create(@TenantSchema() schema: string, @Body() dto: CreateOrderDto) {
    return this.svc.create(schema, dto);
  }

  @Patch(':id/void')
  @RequirePermissions('pos:cashier')
  @ApiOperation({ summary: 'Void a POS order' })
  void(
    @TenantSchema() schema: string,
    @Param('id') id: string,
    @Body() dto: VoidOrderDto,
  ) {
    return this.svc.void(schema, id, dto.reason ?? '');
  }
}
