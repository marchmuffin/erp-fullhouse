import {
  Controller, Get, Post, Body, Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AttendanceService } from './attendance.service';
import { CheckInDto, CheckOutDto, BulkAttendanceDto } from './dto/attendance.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePermissions, CurrentUser, TenantSchema } from '../../../common/decorators';

@ApiTags('hr')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller({ path: 'hr/attendance', version: '1' })
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Get()
  @RequirePermissions('attendance:view')
  @ApiOperation({ summary: 'List attendance records' })
  findAll(
    @TenantSchema() schema: string,
    @Query('page') page = 1,
    @Query('perPage') perPage = 20,
    @Query('employeeId') employeeId?: string,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
    @Query('status') status?: string,
  ) {
    return this.attendanceService.findAll(schema, {
      page: +page,
      perPage: +perPage,
      employeeId,
      fromDate,
      toDate,
      status,
    });
  }

  @Post('check-in')
  @RequirePermissions('attendance:record')
  @ApiOperation({ summary: 'Check in' })
  checkIn(
    @TenantSchema() schema: string,
    @Body() dto: CheckInDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.attendanceService.checkIn(schema, dto, userId);
  }

  @Post('check-out')
  @RequirePermissions('attendance:record')
  @ApiOperation({ summary: 'Check out' })
  checkOut(
    @TenantSchema() schema: string,
    @Body() dto: CheckOutDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.attendanceService.checkOut(schema, dto, userId);
  }

  @Post('bulk')
  @RequirePermissions('attendance:record')
  @ApiOperation({ summary: 'Bulk import attendance' })
  bulkImport(
    @TenantSchema() schema: string,
    @Body() dto: BulkAttendanceDto,
  ) {
    return this.attendanceService.bulkImport(schema, dto);
  }
}
