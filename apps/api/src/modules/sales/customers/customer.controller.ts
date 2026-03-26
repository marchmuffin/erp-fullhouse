import {
  Controller, Get, Post, Put, Delete, Body, Param, Query,
  UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CustomerService } from './customer.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePermissions, CurrentUser, TenantSchema } from '../../../common/decorators';

@ApiTags('sales')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller({ path: 'sales/customers', version: '1' })
export class CustomerController {
  constructor(private readonly customerService: CustomerService) {}

  @Get()
  @RequirePermissions('customer:view')
  @ApiOperation({ summary: 'List customers' })
  findAll(
    @TenantSchema() schema: string,
    @Query('page') page = 1,
    @Query('perPage') perPage = 20,
    @Query('search') search?: string,
    @Query('isActive') isActive?: string,
  ) {
    return this.customerService.findAll(schema, {
      page: +page,
      perPage: +perPage,
      search,
      isActive: isActive !== undefined ? isActive === 'true' : undefined,
    });
  }

  @Get(':id')
  @RequirePermissions('customer:view')
  @ApiOperation({ summary: 'Get customer by ID' })
  findById(@TenantSchema() schema: string, @Param('id') id: string) {
    return this.customerService.findById(schema, id);
  }

  @Post()
  @RequirePermissions('customer:create')
  @ApiOperation({ summary: 'Create customer' })
  create(
    @TenantSchema() schema: string,
    @Body() dto: CreateCustomerDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.customerService.create(schema, dto, userId);
  }

  @Put(':id')
  @RequirePermissions('customer:update')
  @ApiOperation({ summary: 'Update customer' })
  update(
    @TenantSchema() schema: string,
    @Param('id') id: string,
    @Body() dto: UpdateCustomerDto,
  ) {
    return this.customerService.update(schema, id, dto);
  }

  @Delete(':id')
  @RequirePermissions('customer:delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete customer (soft)' })
  remove(@TenantSchema() schema: string, @Param('id') id: string) {
    return this.customerService.remove(schema, id);
  }
}
