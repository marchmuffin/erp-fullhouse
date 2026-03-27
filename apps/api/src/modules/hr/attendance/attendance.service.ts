import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { CheckInDto, CheckOutDto, BulkAttendanceDto } from './dto/attendance.dto';

@Injectable()
export class AttendanceService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(schemaName: string, query: {
    page?: number;
    perPage?: number;
    employeeId?: string;
    fromDate?: string;
    toDate?: string;
    status?: string;
  }) {
    const { page = 1, perPage = 20, employeeId, fromDate, toDate, status } = query;
    const skip = (page - 1) * perPage;

    return this.prisma.withTenantSchema(schemaName, async (tx) => {
      const where: any = {};
      if (employeeId) where.employeeId = employeeId;
      if (status) where.status = status;
      if (fromDate || toDate) {
        where.date = {};
        if (fromDate) where.date.gte = new Date(fromDate);
        if (toDate) where.date.lte = new Date(toDate);
      }

      const [data, total] = await Promise.all([
        tx.attendance.findMany({
          where,
          skip,
          take: perPage,
          orderBy: { date: 'desc' },
          include: {
            employee: {
              select: { id: true, empNo: true, firstName: true, lastName: true, department: true },
            },
          },
        }),
        tx.attendance.count({ where }),
      ]);

      return {
        data,
        meta: { page, perPage, total, totalPages: Math.ceil(total / perPage) },
      };
    });
  }

  async checkIn(schemaName: string, dto: CheckInDto, userId: string) {
    return this.prisma.withTenantSchema(schemaName, async (tx) => {
      const employee = await tx.employee.findFirst({ where: { id: dto.employeeId } });
      if (!employee) throw new NotFoundException('Employee not found');

      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      const existing = await tx.attendance.findFirst({
        where: { employeeId: dto.employeeId, date: todayStart },
      });

      if (existing) {
        if (existing.checkIn) {
          throw new BadRequestException('Already checked in today');
        }
        return tx.attendance.update({
          where: { id: existing.id },
          data: { checkIn: now, status: 'present' },
        });
      }

      return tx.attendance.create({
        data: {
          employeeId: dto.employeeId,
          date: todayStart,
          checkIn: now,
          status: 'present',
        },
      });
    });
  }

  async checkOut(schemaName: string, dto: CheckOutDto, userId: string) {
    return this.prisma.withTenantSchema(schemaName, async (tx) => {
      const employee = await tx.employee.findFirst({ where: { id: dto.employeeId } });
      if (!employee) throw new NotFoundException('Employee not found');

      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      const attendance = await tx.attendance.findFirst({
        where: { employeeId: dto.employeeId, date: todayStart },
      });

      if (!attendance) throw new BadRequestException('No check-in record for today');
      if (!attendance.checkIn) throw new BadRequestException('Must check in before checking out');
      if (attendance.checkOut) throw new BadRequestException('Already checked out today');

      const hoursWorked = (now.getTime() - attendance.checkIn.getTime()) / (1000 * 60 * 60);

      return tx.attendance.update({
        where: { id: attendance.id },
        data: {
          checkOut: now,
          hoursWorked: Math.round(hoursWorked * 100) / 100,
        },
      });
    });
  }

  async bulkImport(schemaName: string, dto: BulkAttendanceDto) {
    return this.prisma.withTenantSchema(schemaName, async (tx) => {
      const results: any[] = [];

      for (const record of dto.records) {
        const date = new Date(record.date);
        const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());

        const upserted = await tx.attendance.upsert({
          where: {
            employeeId_date: {
              employeeId: record.employeeId,
              date: dayStart,
            },
          },
          update: {
            status: record.status ?? 'present',
            hoursWorked: record.hoursWorked,
            notes: record.notes,
          },
          create: {
            employeeId: record.employeeId,
            date: dayStart,
            status: record.status ?? 'present',
            hoursWorked: record.hoursWorked,
            notes: record.notes,
          },
        });
        results.push(upserted as any);
      }

      return { count: results.length, records: results };
    });
  }
}
