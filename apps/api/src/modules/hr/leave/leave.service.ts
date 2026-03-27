import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { CreateLeaveDto } from './dto/create-leave.dto';

@Injectable()
export class LeaveService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(schemaName: string, query: {
    page?: number;
    perPage?: number;
    employeeId?: string;
    status?: string;
  }) {
    const { page = 1, perPage = 20, employeeId, status } = query;
    const skip = (page - 1) * perPage;

    return this.prisma.withTenantSchema(schemaName, async (tx) => {
      const where: any = {};
      if (employeeId) where.employeeId = employeeId;
      if (status) where.status = status;

      const [data, total] = await Promise.all([
        tx.leaveRequest.findMany({
          where,
          skip,
          take: perPage,
          orderBy: { createdAt: 'desc' },
          include: {
            employee: {
              select: { id: true, empNo: true, firstName: true, lastName: true, department: true },
            },
          },
        }),
        tx.leaveRequest.count({ where }),
      ]);

      return {
        data,
        meta: { page, perPage, total, totalPages: Math.ceil(total / perPage) },
      };
    });
  }

  async create(schemaName: string, dto: CreateLeaveDto, userId: string) {
    return this.prisma.withTenantSchema(schemaName, async (tx) => {
      const employee = await tx.employee.findFirst({ where: { id: dto.employeeId } });
      if (!employee) throw new NotFoundException('Employee not found');

      return tx.leaveRequest.create({
        data: {
          employeeId: dto.employeeId,
          leaveType: dto.leaveType,
          startDate: new Date(dto.startDate),
          endDate: new Date(dto.endDate),
          days: dto.days,
          reason: dto.reason,
        },
        include: {
          employee: {
            select: { id: true, empNo: true, firstName: true, lastName: true },
          },
        },
      });
    });
  }

  async approve(schemaName: string, id: string, userId: string) {
    return this.prisma.withTenantSchema(schemaName, async (tx) => {
      const leave = await tx.leaveRequest.findFirst({ where: { id } });
      if (!leave) throw new NotFoundException('Leave request not found');
      if (leave.status !== 'pending') {
        throw new BadRequestException(`Cannot approve leave in status: ${leave.status}`);
      }

      return tx.leaveRequest.update({
        where: { id },
        data: {
          status: 'approved',
          approvedBy: userId,
          approvedAt: new Date(),
        },
      });
    });
  }

  async reject(schemaName: string, id: string, userId: string) {
    return this.prisma.withTenantSchema(schemaName, async (tx) => {
      const leave = await tx.leaveRequest.findFirst({ where: { id } });
      if (!leave) throw new NotFoundException('Leave request not found');
      if (leave.status !== 'pending') {
        throw new BadRequestException(`Cannot reject leave in status: ${leave.status}`);
      }

      return tx.leaveRequest.update({
        where: { id },
        data: {
          status: 'rejected',
          approvedBy: userId,
          approvedAt: new Date(),
        },
      });
    });
  }

  async cancel(schemaName: string, id: string) {
    return this.prisma.withTenantSchema(schemaName, async (tx) => {
      const leave = await tx.leaveRequest.findFirst({ where: { id } });
      if (!leave) throw new NotFoundException('Leave request not found');
      if (leave.status !== 'pending') {
        throw new BadRequestException(`Cannot cancel leave in status: ${leave.status}`);
      }

      return tx.leaveRequest.update({
        where: { id },
        data: { status: 'cancelled' },
      });
    });
  }
}
