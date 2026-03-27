import {
  Controller, Get, Post, Patch, Body, Param, Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { LeaveService } from './leave.service';
import { CreateLeaveDto } from './dto/create-leave.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePermissions, CurrentUser, TenantSchema } from '../../../common/decorators';

@ApiTags('hr')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller({ path: 'hr/leave-requests', version: '1' })
export class LeaveController {
  constructor(private readonly leaveService: LeaveService) {}

  @Get()
  @RequirePermissions('leave:view')
  @ApiOperation({ summary: 'List leave requests' })
  findAll(
    @TenantSchema() schema: string,
    @Query('page') page = 1,
    @Query('perPage') perPage = 20,
    @Query('employeeId') employeeId?: string,
    @Query('status') status?: string,
  ) {
    return this.leaveService.findAll(schema, {
      page: +page,
      perPage: +perPage,
      employeeId,
      status,
    });
  }

  @Post()
  @RequirePermissions('leave:create')
  @ApiOperation({ summary: 'Create leave request' })
  create(
    @TenantSchema() schema: string,
    @Body() dto: CreateLeaveDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.leaveService.create(schema, dto, userId);
  }

  @Patch(':id/approve')
  @RequirePermissions('leave:approve')
  @ApiOperation({ summary: 'Approve leave request' })
  approve(
    @TenantSchema() schema: string,
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.leaveService.approve(schema, id, userId);
  }

  @Patch(':id/reject')
  @RequirePermissions('leave:approve')
  @ApiOperation({ summary: 'Reject leave request' })
  reject(
    @TenantSchema() schema: string,
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.leaveService.reject(schema, id, userId);
  }

  @Patch(':id/cancel')
  @RequirePermissions('leave:create')
  @ApiOperation({ summary: 'Cancel leave request' })
  cancel(@TenantSchema() schema: string, @Param('id') id: string) {
    return this.leaveService.cancel(schema, id);
  }
}
