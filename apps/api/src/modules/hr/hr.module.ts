import { Module } from '@nestjs/common';
import { EmployeeController } from './employees/employee.controller';
import { EmployeeService } from './employees/employee.service';
import { LeaveController } from './leave/leave.controller';
import { LeaveService } from './leave/leave.service';
import { AttendanceController } from './attendance/attendance.controller';
import { AttendanceService } from './attendance/attendance.service';
import { PayrollController } from './payroll/payroll.controller';
import { PayrollService } from './payroll/payroll.service';

@Module({
  controllers: [
    EmployeeController,
    LeaveController,
    AttendanceController,
    PayrollController,
  ],
  providers: [
    EmployeeService,
    LeaveService,
    AttendanceService,
    PayrollService,
  ],
  exports: [EmployeeService, LeaveService, AttendanceService, PayrollService],
})
export class HrModule {}
