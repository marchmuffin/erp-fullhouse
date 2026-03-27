import {
  Controller, Get, Post, Put, Delete, Body, Param, Query,
  UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { EmployeeService } from './employee.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePermissions, CurrentUser, TenantSchema } from '../../../common/decorators';

@ApiTags('hr')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller({ path: 'hr/employees', version: '1' })
export class EmployeeController {
  constructor(private readonly employeeService: EmployeeService) {}

  @Get()
  @RequirePermissions('employee:view')
  @ApiOperation({ summary: 'List employees' })
  findAll(
    @TenantSchema() schema: string,
    @Query('page') page = 1,
    @Query('perPage') perPage = 20,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('department') department?: string,
  ) {
    return this.employeeService.findAll(schema, {
      page: +page,
      perPage: +perPage,
      search,
      status,
      department,
    });
  }

  @Get(':id')
  @RequirePermissions('employee:view')
  @ApiOperation({ summary: 'Get employee by ID' })
  findById(@TenantSchema() schema: string, @Param('id') id: string) {
    return this.employeeService.findById(schema, id);
  }

  @Post()
  @RequirePermissions('employee:create')
  @ApiOperation({ summary: 'Create employee' })
  create(
    @TenantSchema() schema: string,
    @Body() dto: CreateEmployeeDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.employeeService.create(schema, dto, userId);
  }

  @Put(':id')
  @RequirePermissions('employee:update')
  @ApiOperation({ summary: 'Update employee' })
  update(
    @TenantSchema() schema: string,
    @Param('id') id: string,
    @Body() dto: UpdateEmployeeDto,
  ) {
    return this.employeeService.update(schema, id, dto);
  }

  @Delete(':id')
  @RequirePermissions('employee:delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Terminate employee' })
  remove(@TenantSchema() schema: string, @Param('id') id: string) {
    return this.employeeService.remove(schema, id);
  }
}
