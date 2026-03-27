import {
  Controller, Get, Post, Patch, Body, Param, Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PayrollService } from './payroll.service';
import { CreatePayrollDto } from './dto/create-payroll.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePermissions, CurrentUser, TenantSchema } from '../../../common/decorators';

@ApiTags('hr')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller({ path: 'hr/payroll-runs', version: '1' })
export class PayrollController {
  constructor(private readonly payrollService: PayrollService) {}

  @Get()
  @RequirePermissions('payroll:view')
  @ApiOperation({ summary: 'List payroll runs' })
  findAll(
    @TenantSchema() schema: string,
    @Query('page') page = 1,
    @Query('perPage') perPage = 20,
    @Query('status') status?: string,
  ) {
    return this.payrollService.findAll(schema, {
      page: +page,
      perPage: +perPage,
      status,
    });
  }

  @Get(':id')
  @RequirePermissions('payroll:view')
  @ApiOperation({ summary: 'Get payroll run by ID' })
  findById(@TenantSchema() schema: string, @Param('id') id: string) {
    return this.payrollService.findById(schema, id);
  }

  @Post()
  @RequirePermissions('payroll:create')
  @ApiOperation({ summary: 'Create payroll run' })
  create(
    @TenantSchema() schema: string,
    @Body() dto: CreatePayrollDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.payrollService.create(schema, dto, userId);
  }

  @Patch(':id/approve')
  @RequirePermissions('payroll:approve')
  @ApiOperation({ summary: 'Approve payroll run' })
  approve(
    @TenantSchema() schema: string,
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.payrollService.approve(schema, id, userId);
  }

  @Patch(':id/mark-paid')
  @RequirePermissions('payroll:approve')
  @ApiOperation({ summary: 'Mark payroll run as paid' })
  markPaid(
    @TenantSchema() schema: string,
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.payrollService.markPaid(schema, id, userId);
  }
}
